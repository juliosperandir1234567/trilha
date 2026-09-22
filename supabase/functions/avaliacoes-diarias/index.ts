import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer/mod.ts";

const MARCOS = [30, 60, 90] as const;
const DIAS_RETENTATIVA = 3;
const DIAS_CATCHUP = 30;

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function somarDias(dataISO: string, dias: number): string {
  const data = new Date(dataISO + "T00:00:00Z");
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

// Sem verify_jwt da plataforma: a autorização é feita aqui via segredo
// compartilhado (CRON_SECRET), já que quem chama esta função é o pg_cron,
// não um usuário autenticado.
Deno.serve(async (req: Request) => {
  const cronSecretEsperado = Deno.env.get("CRON_SECRET");
  const cronSecretRecebido = req.headers.get("x-cron-secret");
  if (!cronSecretEsperado || cronSecretRecebido !== cronSecretEsperado) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const gmailUser = Deno.env.get("GMAIL_USER");
  const gmailAppPassword = Deno.env.get("GMAIL_APP_PASSWORD");
  // Porta 465 + tls:true (TLS implícito) evita um bug conhecido do Deno/
  // denomailer com STARTTLS na porta 587 (InvalidContentType).
  const smtpClient =
    gmailUser && gmailAppPassword
      ? new SMTPClient({
          connection: {
            hostname: "smtp.gmail.com",
            port: 465,
            tls: true,
            auth: { username: gmailUser, password: gmailAppPassword },
          },
        })
      : null;

  const siteUrl = Deno.env.get("SITE_URL") ?? "http://localhost:3000";

  const { data: config } = await supabase
    .from("configuracoes_sistema")
    .select("email_remetente, nome_remetente, validade_link_horas")
    .eq("id", 1)
    .single();

  const validadeHoras = config?.validade_link_horas ?? 120;
  const emailRemetente = config?.email_remetente;
  const nomeRemetente = config?.nome_remetente ?? "Trilha 30-60-90";

  const hoje = hojeISO();
  const dataLimiteCatchup = somarDias(hoje, -DIAS_CATCHUP);

  const { data: colaboradores, error: erroColaboradores } = await supabase
    .from("colaboradores")
    .select("id, nome, data_admissao, gestor_nome, gestor_email")
    .eq("ativo", true);

  if (erroColaboradores) {
    return new Response(JSON.stringify({ error: erroColaboradores.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const resultado = { criadas: 0, enviadas: 0, falhasEnvio: 0, reenviadas: 0, expiradas: 0 };

  async function enviarEmail(params: {
    nome: string;
    gestorNome: string;
    gestorEmail: string;
    marco: number;
    token: string;
  }): Promise<boolean> {
    if (!smtpClient || !emailRemetente) return false;
    const urlAvaliacao = `${siteUrl}/avaliar/${params.token}`;
    try {
      await smtpClient.send({
        from: `${nomeRemetente} <${emailRemetente}>`,
        to: params.gestorEmail,
        subject: `Avaliação de ${params.marco} dias — ${params.nome}`,
        html: `<p>Olá, ${params.gestorNome}.</p><p>É hora de avaliar <strong>${params.nome}</strong> no marco de <strong>${params.marco} dias</strong>.</p><p><a href="${urlAvaliacao}">Responder avaliação</a></p><p>Este link expira em ${validadeHoras} horas.</p>`,
      });
      return true;
    } catch {
      return false;
    }
  }

  for (const colaborador of colaboradores ?? []) {
    for (const marco of MARCOS) {
      const dataAlvo = somarDias(colaborador.data_admissao, marco);
      // Não é só "bateu hoje": também cobre marco (colaborador cadastrado
      // depois que a data já tinha passado, ex: importação tardia). O
      // "if (existente) continue" logo abaixo evita duplicar quem já foi
      // criado antes. Data muito antiga (> DIAS_CATCHUP) é ignorada — é
      // mais provável erro de cadastro do que um marco de fato pendente.
      if (dataAlvo > hoje || dataAlvo < dataLimiteCatchup) continue;

      const { data: existente } = await supabase
        .from("avaliacoes")
        .select("id")
        .eq("colaborador_id", colaborador.id)
        .eq("marco", marco)
        .maybeSingle();

      if (existente) continue;

      const { data: avaliacao, error: erroAvaliacao } = await supabase
        .from("avaliacoes")
        .insert({
          colaborador_id: colaborador.id,
          marco,
          status: "pendente",
          data_referencia: hoje,
        })
        .select("id")
        .single();

      if (erroAvaliacao || !avaliacao) continue;
      resultado.criadas += 1;

      const expiraEm = new Date(Date.now() + validadeHoras * 60 * 60 * 1000).toISOString();
      const { data: link, error: erroLink } = await supabase
        .from("links_avaliacao")
        .insert({ avaliacao_id: avaliacao.id, expira_em: expiraEm })
        .select("token")
        .single();

      if (erroLink || !link) continue;

      const emailEnviado = await enviarEmail({
        nome: colaborador.nome,
        gestorNome: colaborador.gestor_nome,
        gestorEmail: colaborador.gestor_email,
        marco,
        token: link.token,
      });

      if (emailEnviado) {
        resultado.enviadas += 1;
        await supabase
          .from("avaliacoes")
          .update({ status: "enviada", data_envio: new Date().toISOString() })
          .eq("id", avaliacao.id);
      } else {
        resultado.falhasEnvio += 1;
      }
    }
  }

  // Retentativa: avaliações que ficaram "pendente" (e-mail nunca confirmado
  // como enviado, ex: SMTP fora do ar naquele dia) criadas nos últimos dias,
  // pra não depender de alguém notar e clicar em "Forçar envio" manualmente.
  // Só olha dias ANTERIORES a hoje pra não duplicar o envio que acabou de
  // ser tentado no loop acima.
  const dataLimiteRetentativa = somarDias(hoje, -DIAS_RETENTATIVA);
  const { data: pendentesAntigas } = await supabase
    .from("avaliacoes")
    .select("id, marco, colaboradores(nome, gestor_nome, gestor_email)")
    .eq("status", "pendente")
    .lt("data_referencia", hoje)
    .gte("data_referencia", dataLimiteRetentativa);

  for (const pendente of pendentesAntigas ?? []) {
    const colaborador = pendente.colaboradores as unknown as {
      nome: string;
      gestor_nome: string;
      gestor_email: string;
    } | null;
    if (!colaborador) continue;

    const { data: linkValido } = await supabase
      .from("links_avaliacao")
      .select("token")
      .eq("avaliacao_id", pendente.id)
      .is("usado_em", null)
      .gt("expira_em", new Date().toISOString())
      .order("expira_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    let token = linkValido?.token as string | undefined;

    if (!token) {
      const expiraEm = new Date(Date.now() + validadeHoras * 60 * 60 * 1000).toISOString();
      const { data: novoLink } = await supabase
        .from("links_avaliacao")
        .insert({ avaliacao_id: pendente.id, expira_em: expiraEm })
        .select("token")
        .single();
      token = novoLink?.token;
    }

    if (!token) continue;

    const emailEnviado = await enviarEmail({
      nome: colaborador.nome,
      gestorNome: colaborador.gestor_nome,
      gestorEmail: colaborador.gestor_email,
      marco: pendente.marco,
      token,
    });

    if (emailEnviado) {
      resultado.reenviadas += 1;
      await supabase
        .from("avaliacoes")
        .update({ status: "enviada", data_envio: new Date().toISOString() })
        .eq("id", pendente.id);
    } else {
      resultado.falhasEnvio += 1;
    }
  }

  if (smtpClient) {
    try {
      await smtpClient.close();
    } catch {
      // conexão já pode ter sido encerrada pelo servidor SMTP
    }
  }

  const { data: linksExpirados } = await supabase
    .from("links_avaliacao")
    .select("avaliacao_id, avaliacoes!inner(status)")
    .lt("expira_em", new Date().toISOString())
    .is("usado_em", null)
    .eq("avaliacoes.status", "enviada");

  for (const item of linksExpirados ?? []) {
    await supabase.from("avaliacoes").update({ status: "expirada" }).eq("id", item.avaliacao_id);
    resultado.expiradas += 1;
  }

  return new Response(JSON.stringify(resultado), {
    headers: { "Content-Type": "application/json" },
  });
});
