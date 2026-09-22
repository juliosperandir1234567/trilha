import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer/mod.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Método não suportado" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Não autenticado" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabaseComoChamador = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user: chamador },
  } = await supabaseComoChamador.auth.getUser();
  if (!chamador) return json({ error: "Não autenticado" }, 401);

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: perfilChamador } = await supabase
    .from("usuarios")
    .select("papel")
    .eq("id", chamador.id)
    .single();

  if (perfilChamador?.papel !== "admin" && perfilChamador?.papel !== "analista") {
    return json({ error: "Sem permissão" }, 403);
  }

  const body = await req.json().catch(() => null);
  const colaboradorId = body?.colaborador_id as string | undefined;
  const marco = body?.marco as number | undefined;

  if (!colaboradorId || ![30, 60, 90].includes(marco as number)) {
    return json({ error: "Dados inválidos" }, 400);
  }

  const { data: colaborador } = await supabase
    .from("colaboradores")
    .select("id, nome, gestor_nome, gestor_email")
    .eq("id", colaboradorId)
    .single();

  if (!colaborador) return json({ error: "Colaborador não encontrado" }, 404);

  const { data: config } = await supabase
    .from("configuracoes_sistema")
    .select("email_remetente, nome_remetente, validade_link_horas")
    .eq("id", 1)
    .single();

  const gmailUser = Deno.env.get("GMAIL_USER");
  const gmailAppPassword = Deno.env.get("GMAIL_APP_PASSWORD");
  const siteUrl = Deno.env.get("SITE_URL") ?? "http://localhost:3000";
  const validadeHoras = config?.validade_link_horas ?? 120;
  const emailRemetente = config?.email_remetente;
  const nomeRemetente = config?.nome_remetente ?? "Trilha 30-60-90";

  let { data: avaliacao } = await supabase
    .from("avaliacoes")
    .select("id, status")
    .eq("colaborador_id", colaboradorId)
    .eq("marco", marco)
    .maybeSingle();

  if (avaliacao?.status === "respondida") {
    return json({ error: "Esta avaliação já foi respondida, não é possível reenviar." }, 400);
  }

  if (!avaliacao) {
    const { data: novaAvaliacao, error: erroAvaliacao } = await supabase
      .from("avaliacoes")
      .insert({
        colaborador_id: colaboradorId,
        marco,
        status: "pendente",
        data_referencia: new Date().toISOString().slice(0, 10),
      })
      .select("id, status")
      .single();

    if (erroAvaliacao || !novaAvaliacao) {
      return json({ error: "Não foi possível criar a avaliação." }, 500);
    }
    avaliacao = novaAvaliacao;
  }

  const expiraEm = new Date(Date.now() + validadeHoras * 60 * 60 * 1000).toISOString();
  const { data: link, error: erroLink } = await supabase
    .from("links_avaliacao")
    .insert({ avaliacao_id: avaliacao.id, expira_em: expiraEm })
    .select("token")
    .single();

  if (erroLink || !link) {
    return json({ error: "Não foi possível gerar o link de avaliação." }, 500);
  }

  const urlAvaliacao = `${siteUrl}/avaliar/${link.token}`;

  if (!gmailUser || !gmailAppPassword || !emailRemetente) {
    return json({
      success: true,
      email_enviado: false,
      link: urlAvaliacao,
      aviso: "Link gerado, mas e-mail não enviado: credenciais SMTP (Gmail) não configuradas.",
    });
  }

  // Porta 465 + tls:true (TLS implícito) evita um bug conhecido do Deno/
  // denomailer com STARTTLS na porta 587 (InvalidContentType).
  const smtpClient = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: { username: gmailUser, password: gmailAppPassword },
    },
  });

  let emailEnviado = false;
  let detalheErro = "";
  try {
    await smtpClient.send({
      from: `${nomeRemetente} <${emailRemetente}>`,
      to: colaborador.gestor_email,
      subject: `Avaliação de ${marco} dias — ${colaborador.nome}`,
      html: `<p>Olá, ${colaborador.gestor_nome}.</p><p>É hora de avaliar <strong>${colaborador.nome}</strong> no marco de <strong>${marco} dias</strong>.</p><p><a href="${urlAvaliacao}">Responder avaliação</a></p><p>Este link expira em ${validadeHoras} horas.</p>`,
    });
    emailEnviado = true;
  } catch (erro) {
    detalheErro = String(erro);
  } finally {
    try {
      await smtpClient.close();
    } catch {
      // conexão já pode ter sido encerrada pelo servidor SMTP
    }
  }

  if (!emailEnviado) {
    return json({
      success: true,
      email_enviado: false,
      link: urlAvaliacao,
      aviso: `Link gerado, mas falha ao enviar e-mail via SMTP (Gmail): ${detalheErro}`,
    });
  }

  await supabase
    .from("avaliacoes")
    .update({ status: "enviada", data_envio: new Date().toISOString() })
    .eq("id", avaliacao.id);

  return json({
    success: true,
    email_enviado: true,
    link: urlAvaliacao,
    enviado_para: colaborador.gestor_email,
  });
});
