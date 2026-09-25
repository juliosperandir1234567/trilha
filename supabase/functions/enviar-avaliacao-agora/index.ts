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
  // Reabrir: avaliação já respondida volta pro gestor com as respostas
  // anteriores preenchidas (como rascunho). Só admin.
  const reabrir = body?.reabrir === true;

  if (reabrir && perfilChamador?.papel !== "admin") {
    return json({ error: "Só o admin pode reabrir uma avaliação." }, 403);
  }

  // Mesma lista de src/lib/periodos.ts.
  if (!colaboradorId || ![30, 45, 60, 90, 120, 180, 270].includes(marco as number)) {
    return json({ error: "Dados inválidos" }, 400);
  }

  const { data: colaborador } = await supabase
    .from("colaboradores")
    .select("id, nome, gestor_nome, gestor_email, cargos(marcos)")
    .eq("id", colaboradorId)
    .single();

  if (!colaborador) return json({ error: "Colaborador não encontrado" }, 404);

  // Cada cargo define seus próprios marcos (ex: Gestor tem os 6, outros só
  // 30/60/90). Colaborador sem cargo cadastrado usa o padrão 30/60/90.
  const cargoDoColaborador = colaborador.cargos as unknown as { marcos: number[] } | null;
  const marcosDoColaborador = cargoDoColaborador?.marcos ?? [30, 60, 90];
  if (!marcosDoColaborador.includes(marco as number)) {
    return json({ error: "Esse marco não se aplica ao cargo deste colaborador." }, 400);
  }

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
  const nomeRemetente = config?.nome_remetente ?? "Trilha Desenvolve+";

  let { data: avaliacao } = await supabase
    .from("avaliacoes")
    .select("id, status, data_envio")
    .eq("colaborador_id", colaboradorId)
    .eq("marco", marco)
    .maybeSingle();

  if (reabrir) {
    // Também reabre a "não avaliada" (ex: afastado que voltou).
    if (avaliacao?.status !== "respondida" && avaliacao?.status !== "nao_avaliada") {
      return json({ error: "Só dá pra reabrir uma avaliação já respondida ou não avaliada." }, 400);
    }

    const { data: respostasAnteriores } = await supabase
      .from("respostas")
      .select("pergunta_id, nota, categoria_final_id, treinamento_final_id, comentario")
      .eq("avaliacao_id", avaliacao.id);

    const { error: erroApagar } = await supabase.from("respostas").delete().eq("avaliacao_id", avaliacao.id);
    if (erroApagar) return json({ error: "Não foi possível reabrir a avaliação." }, 500);

    await supabase
      .from("avaliacoes")
      .update({
        status: "pendente",
        data_resposta: null,
        rascunho: respostasAnteriores?.length ? respostasAnteriores : null,
        rascunho_salvo_em: respostasAnteriores?.length ? new Date().toISOString() : null,
        motivo_nao_avaliada: null,
        observacao_nao_avaliada: null,
        // Reaberta começa um ciclo novo de envio e lembretes.
        data_envio: null,
        lembretes_enviados: 0,
      })
      .eq("id", avaliacao.id);
    avaliacao = { ...avaliacao, status: "pendente", data_envio: null };
  } else if (avaliacao?.status === "respondida") {
    return json({ error: "Esta avaliação já foi respondida, não é possível reenviar." }, 400);
  } else if (avaliacao?.status === "nao_avaliada") {
    return json({ error: "Avaliação encerrada pelo gestor. Use \"Reabrir para o gestor\"." }, 400);
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
      .select("id, status, data_envio")
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
      subject: reabrir
        ? `Avaliação de ${marco} dias reaberta — ${colaborador.nome}`
        : `Avaliação de ${marco} dias — ${colaborador.nome}`,
      html: reabrir
        ? `<p>Olá, ${colaborador.gestor_nome}.</p><p>A avaliação de <strong>${colaborador.nome}</strong> no período de <strong>${marco} dias</strong> foi reaberta para ajustes. Suas respostas anteriores já estão preenchidas; altere o que precisar e envie de novo.</p><p><a href="${urlAvaliacao}">Revisar avaliação</a></p><p>Este link expira em ${validadeHoras} horas.</p>`
        : `<p>Olá, ${colaborador.gestor_nome}.</p><p>É hora de avaliar <strong>${colaborador.nome}</strong> no período de <strong>${marco} dias</strong>.</p><p><a href="${urlAvaliacao}">Responder avaliação</a></p><p>Este link expira em ${validadeHoras} horas.</p>`,
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
    .update({
      status: "enviada",
      // data_envio fica sendo o 1º envio (base do tempo médio de resposta);
      // ultimo_envio_em conta pro próximo lembrete automático (a cada 5 dias).
      data_envio: avaliacao.data_envio ?? new Date().toISOString(),
      ultimo_envio_em: new Date().toISOString(),
    })
    .eq("id", avaliacao.id);

  return json({
    success: true,
    email_enviado: true,
    link: urlAvaliacao,
    enviado_para: colaborador.gestor_email,
  });
});
