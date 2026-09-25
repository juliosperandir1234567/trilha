import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer/mod.ts";

const MARCOS_PADRAO = [30, 60, 90];
const DIAS_RETENTATIVA = 3;
const DIAS_CATCHUP = 30;
// Gestor que não respondeu recebe o link de novo a cada DIAS_LEMBRETE dias,
// até responder. A folga cobre a rotina rodar alguns minutos antes do
// horário do envio anterior (senão o lembrete escorregaria um dia).
const DIAS_LEMBRETE = 5;
const FOLGA_LEMBRETE_HORAS = 2;

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function agoraISO(): string {
  return new Date().toISOString();
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
  const nomeRemetente = config?.nome_remetente ?? "Trilha Desenvolve+";

  const hoje = hojeISO();
  const dataLimiteCatchup = somarDias(hoje, -DIAS_CATCHUP);

  const { data: colaboradores, error: erroColaboradores } = await supabase
    .from("colaboradores")
    .select("id, nome, data_admissao, gestor_nome, gestor_email, cargos(marcos)")
    .eq("ativo", true);

  if (erroColaboradores) {
    return new Response(JSON.stringify({ error: erroColaboradores.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const resultado = { criadas: 0, enviadas: 0, falhasEnvio: 0, reenviadas: 0, lembretes: 0, expiradas: 0 };

  async function enviarEmail(params: {
    nome: string;
    gestorNome: string;
    gestorEmail: string;
    marco: number;
    token: string;
    lembrete?: boolean;
  }): Promise<boolean> {
    if (!smtpClient || !emailRemetente) return false;
    const urlAvaliacao = `${siteUrl}/avaliar/${params.token}`;
    try {
      await smtpClient.send({
        from: `${nomeRemetente} <${emailRemetente}>`,
        to: params.gestorEmail,
        subject: params.lembrete
          ? `Lembrete: avaliação de ${params.marco} dias — ${params.nome}`
          : `Avaliação de ${params.marco} dias — ${params.nome}`,
        html: params.lembrete
          ? `<p>Olá, ${params.gestorNome}.</p><p>A avaliação de <strong>${params.nome}</strong> no período de <strong>${params.marco} dias</strong> ainda está esperando sua resposta.</p><p><a href="${urlAvaliacao}">Responder avaliação</a></p><p>Este link expira em ${validadeHoras} horas. Enquanto não houver resposta, um novo lembrete é enviado a cada ${DIAS_LEMBRETE} dias.</p>`
          : `<p>Olá, ${params.gestorNome}.</p><p>É hora de avaliar <strong>${params.nome}</strong> no período de <strong>${params.marco} dias</strong>.</p><p><a href="${urlAvaliacao}">Responder avaliação</a></p><p>Este link expira em ${validadeHoras} horas.</p>`,
      });
      return true;
    } catch {
      return false;
    }
  }

  for (const colaborador of colaboradores ?? []) {
    // Cada cargo define seus próprios marcos (ex: Gestor tem os 6, outros só
    // 30/60/90). Colaborador sem cargo cadastrado usa o padrão 30/60/90.
    const cargo = colaborador.cargos as unknown as { marcos: number[] } | null;
    const marcosDoColaborador = cargo?.marcos ?? MARCOS_PADRAO;

    for (const marco of marcosDoColaborador) {
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
          .update({ status: "enviada", data_envio: agoraISO(), ultimo_envio_em: agoraISO() })
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
        .update({ status: "enviada", data_envio: agoraISO(), ultimo_envio_em: agoraISO() })
        .eq("id", pendente.id);
    } else {
      resultado.falhasEnvio += 1;
    }
  }

  // Lembrete: avaliação enviada (ou que chegou a expirar) sem resposta há
  // DIAS_LEMBRETE dias ou mais recebe um link novo e outro e-mail. Colaborador
  // inativo fica de fora. O rascunho do gestor fica na avaliação, não no
  // link, então continua lá no link novo.
  // Compara em milissegundos: o banco devolve "+00:00" e o JS gera "Z", então
  // comparar as strings pode errar.
  const limiteLembrete = Date.now() - (DIAS_LEMBRETE * 24 - FOLGA_LEMBRETE_HORAS) * 60 * 60 * 1000;
  const { data: semResposta } = await supabase
    .from("avaliacoes")
    .select(
      "id, marco, data_envio, ultimo_envio_em, lembretes_enviados, colaboradores!inner(nome, gestor_nome, gestor_email, ativo)"
    )
    .in("status", ["enviada", "expirada"])
    .eq("colaboradores.ativo", true);

  for (const avaliacao of semResposta ?? []) {
    const ultimoEnvio = avaliacao.ultimo_envio_em ?? avaliacao.data_envio;
    if (!ultimoEnvio || new Date(ultimoEnvio).getTime() > limiteLembrete) continue;

    const colaborador = avaliacao.colaboradores as unknown as {
      nome: string;
      gestor_nome: string;
      gestor_email: string;
    };

    const expiraEm = new Date(Date.now() + validadeHoras * 60 * 60 * 1000).toISOString();
    const { data: novoLink } = await supabase
      .from("links_avaliacao")
      .insert({ avaliacao_id: avaliacao.id, expira_em: expiraEm })
      .select("token")
      .single();
    if (!novoLink) continue;

    const emailEnviado = await enviarEmail({
      nome: colaborador.nome,
      gestorNome: colaborador.gestor_nome,
      gestorEmail: colaborador.gestor_email,
      marco: avaliacao.marco,
      token: novoLink.token,
      lembrete: true,
    });

    if (emailEnviado) {
      resultado.lembretes += 1;
      await supabase
        .from("avaliacoes")
        .update({
          status: "enviada",
          ultimo_envio_em: agoraISO(),
          lembretes_enviados: (avaliacao.lembretes_enviados ?? 0) + 1,
        })
        .eq("id", avaliacao.id);
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

  // Expira só quem não tem NENHUM link ainda válido — depois de um lembrete
  // ou "Forçar envio" o link antigo vence, mas o novo continua valendo.
  const { data: enviadas } = await supabase
    .from("avaliacoes")
    .select("id, links_avaliacao(expira_em, usado_em)")
    .eq("status", "enviada");

  const agora = Date.now();
  for (const avaliacao of enviadas ?? []) {
    const links = (avaliacao.links_avaliacao ?? []) as { expira_em: string; usado_em: string | null }[];
    const temLinkValido = links.some((l) => !l.usado_em && new Date(l.expira_em).getTime() > agora);
    if (links.length === 0 || temLinkValido) continue;
    await supabase.from("avaliacoes").update({ status: "expirada" }).eq("id", avaliacao.id);
    resultado.expiradas += 1;
  }

  return new Response(JSON.stringify(resultado), {
    headers: { "Content-Type": "application/json" },
  });
});
