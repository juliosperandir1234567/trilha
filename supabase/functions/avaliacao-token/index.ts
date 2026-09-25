import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Mesmos limites de src/lib/escala.ts — se mudar lá, mudar aqui.
const NOTA_MAXIMA = 5;
const NOTA_MAXIMA_INDICACAO = 3;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  async function buscarLink(token: string) {
    const { data: link } = await supabase
      .from("links_avaliacao")
      .select(
        "token, expira_em, usado_em, avaliacao_id, avaliacoes(id, marco, status, rascunho, rascunho_salvo_em, colaboradores(nome, cargo_id))"
      )
      .eq("token", token)
      .maybeSingle();
    return link;
  }

  // Treinamentos que o gestor pode indicar: os do cargo do colaborador mais
  // os de "Todos os cargos" (cargo_id vazio). Sem cargo, só os gerais.
  function treinamentosDoCargo(cargoId: string | null, colunas: string) {
    const query = supabase.from("treinamentos").select(colunas).eq("ativo", true).order("nome");
    return cargoId ? query.or(`cargo_id.is.null,cargo_id.eq.${cargoId}`) : query.is("cargo_id", null);
  }

  if (req.method === "GET") {
    const token = new URL(req.url).searchParams.get("token");
    if (!token) return json({ error: "Token não informado" }, 400);

    const link = await buscarLink(token);
    if (!link) return json({ error: "Link inválido" }, 404);

    const avaliacao = link.avaliacoes as unknown as {
      id: string;
      marco: number;
      status: string;
      rascunho: unknown;
      rascunho_salvo_em: string | null;
      colaboradores: { nome: string; cargo_id: string | null } | null;
    };

    if (new Date(link.expira_em) < new Date()) {
      if (avaliacao.status === "enviada" || avaliacao.status === "pendente") {
        await supabase.from("avaliacoes").update({ status: "expirada" }).eq("id", avaliacao.id);
      }
      return json({ error: "Este link expirou." }, 410);
    }

    if (link.usado_em || avaliacao.status === "respondida") {
      return json({ error: "Esta avaliação já foi respondida." }, 409);
    }

    const cargoId = avaliacao.colaboradores?.cargo_id ?? null;

    // Colaborador com cargo só recebe as perguntas daquele cargo; sem cargo,
    // só as gerais. Não soma os dois — cada cargo tem seu próprio conjunto
    // completo de perguntas.
    let perguntasQuery = supabase
      .from("perguntas")
      .select("id, texto, categoria_sugerida_id")
      .eq("marco", avaliacao.marco)
      .eq("ativo", true)
      .order("ordem");
    perguntasQuery = cargoId
      ? perguntasQuery.eq("cargo_id", cargoId)
      : perguntasQuery.is("cargo_id", null);

    const [{ data: perguntas }, { data: categorias }, { data: treinamentos }] = await Promise.all([
      perguntasQuery,
      supabase
        .from("categorias_treinamento")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome"),
      treinamentosDoCargo(cargoId, "id, categoria_id, nome"),
    ]);

    return json({
      colaborador_nome: avaliacao.colaboradores?.nome ?? "",
      marco: avaliacao.marco,
      perguntas: perguntas ?? [],
      categorias: categorias ?? [],
      treinamentos: treinamentos ?? [],
      rascunho: avaliacao.rascunho ?? null,
      rascunho_salvo_em: avaliacao.rascunho_salvo_em,
    });
  }

  if (req.method === "POST") {
    const body = await req.json().catch(() => null);
    const token = body?.token as string | undefined;
    const ehRascunho = body?.rascunho === true;
    const respostas = body?.respostas as
      | {
          pergunta_id: string;
          nota: number | null;
          categoria_final_id?: string | null;
          treinamento_final_id?: string | null;
          comentario?: string;
        }[]
      | undefined;

    if (!token || !Array.isArray(respostas) || respostas.length === 0) {
      return json({ error: "Requisição inválida" }, 400);
    }

    const link = await buscarLink(token);
    if (!link) return json({ error: "Link inválido" }, 404);

    const avaliacao = link.avaliacoes as unknown as {
      id: string;
      marco: number;
      status: string;
      colaboradores: { cargo_id: string | null } | null;
    };

    if (new Date(link.expira_em) < new Date()) {
      return json({ error: "Este link expirou." }, 410);
    }
    if (link.usado_em || avaliacao.status === "respondida") {
      return json({ error: "Esta avaliação já foi respondida." }, 409);
    }

    const cargoId = avaliacao.colaboradores?.cargo_id ?? null;
    let perguntasValidasQuery = supabase
      .from("perguntas")
      .select("id, categoria_sugerida_id")
      .eq("marco", avaliacao.marco)
      .eq("ativo", true);
    perguntasValidasQuery = cargoId
      ? perguntasValidasQuery.eq("cargo_id", cargoId)
      : perguntasValidasQuery.is("cargo_id", null);

    const [{ data: perguntasValidas }, { data: treinamentosValidos }] = await Promise.all([
      perguntasValidasQuery,
      treinamentosDoCargo(cargoId, "id"),
    ]);

    const perguntasPorId = new Map((perguntasValidas ?? []).map((p) => [p.id, p]));
    const idsTreinamentosValidos = new Set(
      ((treinamentosValidos ?? []) as unknown as { id: string }[]).map((t) => t.id)
    );

    const notaValida = (nota: unknown) =>
      Number.isInteger(nota) && (nota as number) >= 1 && (nota as number) <= NOTA_MAXIMA;

    // Rascunho: guarda o que já foi preenchido (pode ter pergunta sem nota)
    // e não mexe no status — o link continua valendo até o prazo.
    if (ehRascunho) {
      const rascunho = respostas
        .filter((r) => perguntasPorId.has(r.pergunta_id))
        .map((r) => ({
          pergunta_id: r.pergunta_id,
          nota: notaValida(r.nota) ? r.nota : null,
          categoria_final_id: r.categoria_final_id ?? null,
          treinamento_final_id:
            r.treinamento_final_id && idsTreinamentosValidos.has(r.treinamento_final_id)
              ? r.treinamento_final_id
              : null,
          comentario: typeof r.comentario === "string" ? r.comentario.slice(0, 2000) : null,
        }));
      const salvoEm = new Date().toISOString();
      const { error: erroRascunho } = await supabase
        .from("avaliacoes")
        .update({ rascunho, rascunho_salvo_em: salvoEm })
        .eq("id", avaliacao.id);
      if (erroRascunho) return json({ error: "Não foi possível salvar o rascunho." }, 500);
      return json({ success: true, salvo_em: salvoEm });
    }

    for (const resposta of respostas) {
      if (!perguntasPorId.has(resposta.pergunta_id)) {
        return json({ error: "Pergunta inválida para este período." }, 400);
      }
      if (!notaValida(resposta.nota)) {
        return json({ error: `Nota inválida (use 1 a ${NOTA_MAXIMA}).` }, 400);
      }
    }

    // Indicação de treinamento só até NOTA_MAXIMA_INDICACAO (1 a 3). Nota
    // acima disso nunca grava categoria/treinamento, mesmo que o cliente mande.
    const linhas = respostas.map((resposta) => {
      const pergunta = perguntasPorId.get(resposta.pergunta_id)!;
      const notaBaixa = (resposta.nota as number) <= NOTA_MAXIMA_INDICACAO;
      return {
        avaliacao_id: avaliacao.id,
        pergunta_id: resposta.pergunta_id,
        nota: resposta.nota,
        categoria_sugerida_id: notaBaixa ? pergunta.categoria_sugerida_id : null,
        categoria_final_id: notaBaixa
          ? resposta.categoria_final_id ?? pergunta.categoria_sugerida_id ?? null
          : null,
        // Treinamento de outro cargo não é gravado.
        treinamento_final_id:
          notaBaixa && resposta.treinamento_final_id && idsTreinamentosValidos.has(resposta.treinamento_final_id)
            ? resposta.treinamento_final_id
            : null,
        comentario: resposta.comentario || null,
      };
    });

    const { error: erroRespostas } = await supabase.from("respostas").insert(linhas);
    if (erroRespostas) return json({ error: "Não foi possível salvar as respostas." }, 500);

    await supabase
      .from("avaliacoes")
      .update({
        status: "respondida",
        data_resposta: new Date().toISOString(),
        rascunho: null,
        rascunho_salvo_em: null,
      })
      .eq("id", avaliacao.id);
    await supabase.from("links_avaliacao").update({ usado_em: new Date().toISOString() }).eq("token", token);

    return json({ success: true });
  }

  return json({ error: "Método não suportado" }, 405);
});
