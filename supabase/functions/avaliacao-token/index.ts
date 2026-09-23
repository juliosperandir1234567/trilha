import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

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
        "token, expira_em, usado_em, avaliacao_id, avaliacoes(id, marco, status, colaboradores(nome, cargo_id))"
      )
      .eq("token", token)
      .maybeSingle();
    return link;
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

    // Uma pergunta sem cargo definido vale pra todo mundo; uma pergunta com
    // cargo só aparece pra colaboradores daquele cargo específico.
    let perguntasQuery = supabase
      .from("perguntas")
      .select("id, texto, categoria_sugerida_id")
      .eq("marco", avaliacao.marco)
      .eq("ativo", true)
      .order("ordem");
    perguntasQuery = cargoId
      ? perguntasQuery.or(`cargo_id.is.null,cargo_id.eq.${cargoId}`)
      : perguntasQuery.is("cargo_id", null);

    // Mesma regra de cargo vale pras competências disponíveis pro gestor
    // escolher como indicação de treinamento.
    let categoriasQuery = supabase
      .from("categorias_treinamento")
      .select("id, nome")
      .eq("ativo", true)
      .order("nome");
    categoriasQuery = cargoId
      ? categoriasQuery.or(`cargo_id.is.null,cargo_id.eq.${cargoId}`)
      : categoriasQuery.is("cargo_id", null);

    const [{ data: perguntas }, { data: categorias }, { data: treinamentos }] = await Promise.all([
      perguntasQuery,
      categoriasQuery,
      supabase
        .from("treinamentos")
        .select("id, categoria_id, nome")
        .eq("ativo", true)
        .order("nome"),
    ]);

    return json({
      colaborador_nome: avaliacao.colaboradores?.nome ?? "",
      marco: avaliacao.marco,
      perguntas: perguntas ?? [],
      categorias: categorias ?? [],
      treinamentos: treinamentos ?? [],
    });
  }

  if (req.method === "POST") {
    const body = await req.json().catch(() => null);
    const token = body?.token as string | undefined;
    const respostas = body?.respostas as
      | {
          pergunta_id: string;
          nota: number;
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
      ? perguntasValidasQuery.or(`cargo_id.is.null,cargo_id.eq.${cargoId}`)
      : perguntasValidasQuery.is("cargo_id", null);

    const { data: perguntasValidas } = await perguntasValidasQuery;

    const perguntasPorId = new Map((perguntasValidas ?? []).map((p) => [p.id, p]));

    for (const resposta of respostas) {
      if (!perguntasPorId.has(resposta.pergunta_id)) {
        return json({ error: "Pergunta inválida para este marco." }, 400);
      }
      if (!Number.isInteger(resposta.nota) || resposta.nota < 1 || resposta.nota > 4) {
        return json({ error: "Nota inválida (use 1 a 4)." }, 400);
      }
    }

    // Só existe indicação de treinamento quando a nota é baixa (1 ou 2).
    // Nota 3/4 nunca deve gravar categoria/treinamento, mesmo que o cliente mande algo.
    const linhas = respostas.map((resposta) => {
      const pergunta = perguntasPorId.get(resposta.pergunta_id)!;
      const notaBaixa = resposta.nota <= 2;
      return {
        avaliacao_id: avaliacao.id,
        pergunta_id: resposta.pergunta_id,
        nota: resposta.nota,
        categoria_sugerida_id: notaBaixa ? pergunta.categoria_sugerida_id : null,
        categoria_final_id: notaBaixa
          ? resposta.categoria_final_id ?? pergunta.categoria_sugerida_id ?? null
          : null,
        treinamento_final_id: notaBaixa ? resposta.treinamento_final_id ?? null : null,
        comentario: resposta.comentario || null,
      };
    });

    const { error: erroRespostas } = await supabase.from("respostas").insert(linhas);
    if (erroRespostas) return json({ error: "Não foi possível salvar as respostas." }, 500);

    await supabase
      .from("avaliacoes")
      .update({ status: "respondida", data_resposta: new Date().toISOString() })
      .eq("id", avaliacao.id);
    await supabase.from("links_avaliacao").update({ usado_em: new Date().toISOString() }).eq("token", token);

    return json({ success: true });
  }

  return json({ error: "Método não suportado" }, 405);
});
