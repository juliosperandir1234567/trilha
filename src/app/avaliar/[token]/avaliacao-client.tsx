"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";

type Pergunta = { id: string; texto: string; categoria_sugerida_id: string | null };
type Categoria = { id: string; nome: string };
type Treinamento = { id: string; categoria_id: string; nome: string };
type DadosAvaliacao = {
  colaborador_nome: string;
  marco: number;
  perguntas: Pergunta[];
  categorias: Categoria[];
  treinamentos: Treinamento[];
};
type RespostaEstado = {
  nota: number | null;
  categoria_final_id: string;
  treinamento_final_id: string;
  comentario: string;
};

const FUNCTIONS_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/avaliacao-token`;
const API_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

export function AvaliacaoClient({ token }: { token: string }) {
  const [dados, setDados] = useState<DadosAvaliacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [respostas, setRespostas] = useState<Record<string, RespostaEstado>>({});
  const [enviando, setEnviando] = useState(false);
  const [concluido, setConcluido] = useState(false);

  useEffect(() => {
    async function carregar() {
      try {
        const resp = await fetch(`${FUNCTIONS_URL}?token=${encodeURIComponent(token)}`, {
          headers: { apikey: API_KEY, Authorization: `Bearer ${API_KEY}` },
        });
        const json = await resp.json();
        if (!resp.ok) {
          setErro(json.error ?? "Não foi possível carregar a avaliação.");
          return;
        }
        setDados(json);
        const inicial: Record<string, RespostaEstado> = {};
        for (const pergunta of json.perguntas as Pergunta[]) {
          inicial[pergunta.id] = {
            nota: null,
            categoria_final_id: pergunta.categoria_sugerida_id ?? "",
            treinamento_final_id: "",
            comentario: "",
          };
        }
        setRespostas(inicial);
      } catch {
        setErro("Não foi possível carregar a avaliação.");
      } finally {
        setCarregando(false);
      }
    }
    carregar();
  }, [token]);

  function atualizarResposta(perguntaId: string, campo: keyof RespostaEstado, valor: string | number) {
    setRespostas((atual) => ({
      ...atual,
      [perguntaId]: { ...atual[perguntaId], [campo]: valor },
    }));
  }

  async function enviar() {
    if (!dados) return;

    const faltando = dados.perguntas.some((p) => !respostas[p.id]?.nota);
    if (faltando) {
      setErro("Responda todas as perguntas antes de enviar.");
      return;
    }

    setEnviando(true);
    setErro(null);

    try {
      const resp = await fetch(FUNCTIONS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: API_KEY,
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          token,
          respostas: dados.perguntas.map((p) => ({
            pergunta_id: p.id,
            nota: respostas[p.id].nota,
            categoria_final_id: respostas[p.id].categoria_final_id || null,
            treinamento_final_id: respostas[p.id].treinamento_final_id || null,
            comentario: respostas[p.id].comentario || undefined,
          })),
        }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        setErro(json.error ?? "Não foi possível enviar a avaliação.");
        return;
      }
      setConcluido(true);
    } catch {
      setErro("Não foi possível enviar a avaliação.");
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) {
    return <p className="text-center text-zinc-500">Carregando...</p>;
  }

  if (concluido) {
    return (
      <p className="max-w-sm text-center text-primary">
        Avaliação enviada com sucesso. Obrigado!
      </p>
    );
  }

  if (erro && !dados) {
    return <p className="max-w-sm text-center text-red-600">{erro}</p>;
  }

  if (!dados) return null;

  return (
    <div className="flex w-full max-w-xl flex-col gap-6">
      <div className="text-center">
        <h1 className="text-xl font-semibold">
          Avaliação de {dados.marco} dias — {dados.colaborador_nome}
        </h1>
        <p className="text-sm text-zinc-500">Escala: 1 (insatisfatório) a 4 (excelente)</p>
      </div>

      {dados.perguntas.map((pergunta) => {
        const resposta = respostas[pergunta.id];
        const notaBaixa = resposta?.nota === 1 || resposta?.nota === 2;

        return (
          <div key={pergunta.id} className="flex flex-col gap-2 border-b border-black/10 pb-4 dark:border-white/10">
            <p className="font-medium">{pergunta.texto}</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((valor) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => atualizarResposta(pergunta.id, "nota", valor)}
                  className={`h-10 w-10 rounded-full border text-sm font-medium transition-colors ${
                    resposta?.nota === valor
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-black/15 hover:border-primary dark:border-white/20"
                  }`}
                >
                  {valor}
                </button>
              ))}
            </div>

            {notaBaixa && (
              <div className="flex flex-col gap-2">
                {resposta.categoria_final_id && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-zinc-500">Competência de treinamento</label>
                    <p className="rounded-md border border-black/15 bg-black/[0.03] px-3 py-2 text-sm dark:border-white/20 dark:bg-white/[0.03]">
                      {dados.categorias.find((c) => c.id === resposta.categoria_final_id)?.nome ??
                        "Nenhuma"}
                    </p>
                  </div>
                )}

                {resposta.categoria_final_id &&
                  (() => {
                    const treinamentosDaCategoria = dados.treinamentos.filter(
                      (t) => t.categoria_id === resposta.categoria_final_id
                    );
                    if (treinamentosDaCategoria.length === 0) return null;

                    return (
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-zinc-500">
                          Treinamento específico (opcional)
                        </label>
                        <select
                          value={resposta.treinamento_final_id}
                          onChange={(e) =>
                            atualizarResposta(pergunta.id, "treinamento_final_id", e.target.value)
                          }
                          className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20"
                        >
                          <option value="">Nenhum específico</option>
                          {treinamentosDaCategoria.map((treinamento) => (
                            <option key={treinamento.id} value={treinamento.id}>
                              {treinamento.nome}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })()}
              </div>
            )}

            <textarea
              placeholder="Comentário (opcional)"
              value={resposta?.comentario ?? ""}
              onChange={(e) => atualizarResposta(pergunta.id, "comentario", e.target.value)}
              className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20"
              rows={2}
            />
          </div>
        );
      })}

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <button
        type="button"
        onClick={enviar}
        disabled={enviando}
        className="flex w-fit items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
      >
        <Send className="h-4 w-4" />
        {enviando ? "Enviando..." : "Enviar avaliação"}
      </button>
    </div>
  );
}
