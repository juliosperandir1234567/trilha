"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ChevronRight, Save, Send } from "lucide-react";
import { NOTAS, NOTA_MAXIMA_INDICACAO } from "@/lib/escala";

type Pergunta = { id: string; texto: string; categoria_sugerida_id: string | null };
type Categoria = { id: string; nome: string };
type Treinamento = { id: string; categoria_id: string; nome: string };
type RespostaEnviada = {
  pergunta_id: string;
  nota: number | null;
  categoria_final_id: string | null;
  treinamento_final_id: string | null;
  comentario?: string | null;
};
type DadosAvaliacao = {
  colaborador_nome: string;
  marco: number;
  perguntas: Pergunta[];
  categorias: Categoria[];
  treinamentos: Treinamento[];
  rascunho: RespostaEnviada[] | null;
  rascunho_salvo_em: string | null;
};
type RespostaEstado = {
  nota: number | null;
  categoria_final_id: string;
  treinamento_final_id: string;
  comentario: string;
};

const FUNCTIONS_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/avaliacao-token`;
const API_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

function horaBR(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function AvaliacaoClient({ token }: { token: string }) {
  const [dados, setDados] = useState<DadosAvaliacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [respostas, setRespostas] = useState<Record<string, RespostaEstado>>({});
  // "preenchendo" → "revisando" (resumo antes do envio) → "concluido".
  const [etapa, setEtapa] = useState<"preenchendo" | "revisando" | "concluido">("preenchendo");
  const [enviando, setEnviando] = useState(false);
  const [salvandoRascunho, setSalvandoRascunho] = useState(false);
  const [rascunhoSalvoEm, setRascunhoSalvoEm] = useState<string | null>(null);

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
        const dadosCarregados = json as DadosAvaliacao;
        setDados(dadosCarregados);
        setRascunhoSalvoEm(dadosCarregados.rascunho_salvo_em);

        // Rascunho salvo (ou respostas de uma avaliação reaberta) volta
        // preenchido; pergunta que não estava no rascunho começa vazia.
        const salvas = new Map((dadosCarregados.rascunho ?? []).map((r) => [r.pergunta_id, r]));
        const inicial: Record<string, RespostaEstado> = {};
        for (const pergunta of dadosCarregados.perguntas) {
          const salva = salvas.get(pergunta.id);
          inicial[pergunta.id] = {
            nota: salva?.nota ?? null,
            categoria_final_id: salva?.categoria_final_id ?? pergunta.categoria_sugerida_id ?? "",
            treinamento_final_id: salva?.treinamento_final_id ?? "",
            comentario: salva?.comentario ?? "",
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

  function montarRespostas(): RespostaEnviada[] {
    return (dados?.perguntas ?? []).map((p) => ({
      pergunta_id: p.id,
      nota: respostas[p.id].nota,
      categoria_final_id: respostas[p.id].categoria_final_id || null,
      treinamento_final_id: respostas[p.id].treinamento_final_id || null,
      comentario: respostas[p.id].comentario || null,
    }));
  }

  async function chamarFuncao(corpo: object) {
    const resp = await fetch(FUNCTIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: API_KEY,
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ token, ...corpo }),
    });
    const json = await resp.json();
    return { ok: resp.ok, json };
  }

  async function salvarRascunho() {
    setSalvandoRascunho(true);
    setErro(null);
    try {
      const { ok, json } = await chamarFuncao({ rascunho: true, respostas: montarRespostas() });
      if (!ok) {
        setErro(json.error ?? "Não foi possível salvar o rascunho.");
        return;
      }
      setRascunhoSalvoEm(json.salvo_em);
    } catch {
      setErro("Não foi possível salvar o rascunho.");
    } finally {
      setSalvandoRascunho(false);
    }
  }

  function irParaRevisao() {
    if (!dados) return;
    const faltando = dados.perguntas.filter((p) => !respostas[p.id]?.nota).length;
    if (faltando > 0) {
      setErro(
        faltando === 1
          ? "Falta dar nota em 1 pergunta antes de enviar."
          : `Falta dar nota em ${faltando} perguntas antes de enviar.`
      );
      return;
    }
    setErro(null);
    setEtapa("revisando");
    window.scrollTo({ top: 0 });
  }

  async function confirmarEnvio() {
    setEnviando(true);
    setErro(null);
    try {
      const { ok, json } = await chamarFuncao({ respostas: montarRespostas() });
      if (!ok) {
        setErro(json.error ?? "Não foi possível enviar a avaliação.");
        return;
      }
      setEtapa("concluido");
    } catch {
      setErro("Não foi possível enviar a avaliação.");
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) {
    return <p className="text-center text-zinc-500">Carregando...</p>;
  }

  if (etapa === "concluido") {
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

  const nomeCategoria = (id: string) => dados.categorias.find((c) => c.id === id)?.nome;
  const nomeTreinamento = (id: string) => dados.treinamentos.find((t) => t.id === id)?.nome;

  const cabecalho = (
    <div className="text-center">
      <h1 className="text-xl font-semibold">
        Avaliação de {dados.marco} dias — {dados.colaborador_nome}
      </h1>
      {rascunhoSalvoEm && etapa === "preenchendo" && (
        <p className="mt-1 text-xs text-zinc-500">Rascunho salvo em {horaBR(rascunhoSalvoEm)}</p>
      )}
    </div>
  );

  if (etapa === "revisando") {
    return (
      <div className="flex w-full max-w-xl flex-col gap-5">
        {cabecalho}
        <div className="rounded-lg border border-primary-border bg-white p-4 dark:bg-background">
          <h2 className="font-medium">Confira antes de enviar</h2>
          <p className="text-sm text-zinc-500">
            Depois de enviada, a avaliação não pode mais ser alterada pelo link.
          </p>
        </div>

        <ol className="flex flex-col gap-3">
          {dados.perguntas.map((pergunta, i) => {
            const resposta = respostas[pergunta.id];
            const nota = NOTAS.find((n) => n.valor === resposta.nota);
            const indica = (resposta.nota ?? 99) <= NOTA_MAXIMA_INDICACAO;
            return (
              <li
                key={pergunta.id}
                className="flex flex-col gap-1.5 rounded-lg border border-black/10 bg-white p-3 text-sm dark:border-white/10 dark:bg-background"
              >
                <p className="font-medium">
                  {i + 1}. {pergunta.texto}
                </p>
                {nota && (
                  <p className="flex items-center gap-2">
                    <span
                      className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ background: nota.cor }}
                    >
                      {nota.valor}
                    </span>
                    <span className="font-medium" style={{ color: nota.cor }}>
                      {nota.nome}
                    </span>
                  </p>
                )}
                {indica && resposta.categoria_final_id && (
                  <p className="text-xs text-zinc-600">
                    Competência: {nomeCategoria(resposta.categoria_final_id) ?? "-"}
                    {resposta.treinamento_final_id &&
                      ` · Treinamento: ${nomeTreinamento(resposta.treinamento_final_id) ?? "-"}`}
                  </p>
                )}
                {resposta.comentario && (
                  <p className="text-xs italic text-zinc-500">&ldquo;{resposta.comentario}&rdquo;</p>
                )}
              </li>
            );
          })}
        </ol>

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setEtapa("preenchendo");
              window.scrollTo({ top: 0 });
            }}
            disabled={enviando}
            className="flex items-center gap-2 rounded-md border border-primary-border bg-white px-4 py-2 text-sm font-medium text-primary hover:bg-primary-soft disabled:opacity-60 dark:bg-background"
          >
            <ArrowLeft className="h-4 w-4" />
            Revisar
          </button>
          <button
            type="button"
            onClick={confirmarEnvio}
            disabled={enviando}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {enviando ? "Enviando..." : "Confirmar envio"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-xl flex-col gap-6">
      {cabecalho}

      {/* Régua de notas: fechada por padrão pra não empurrar as perguntas. */}
      <details className="group rounded-lg border border-primary-border bg-white p-3 text-sm dark:bg-background">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 font-medium text-primary">
          <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
          Como dar a nota (1 a 5)
        </summary>
        <ul className="mt-3 flex flex-col gap-2">
          {NOTAS.map((nota) => (
            <li key={nota.valor} className="flex gap-2.5">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ background: nota.cor }}
              >
                {nota.valor}
              </span>
              <span>
                <strong style={{ color: nota.cor }}>{nota.nome}</strong>
                <span className="block text-xs text-zinc-600">{nota.descricao}</span>
              </span>
            </li>
          ))}
        </ul>
      </details>

      {dados.perguntas.map((pergunta) => {
        const resposta = respostas[pergunta.id];
        const indica = resposta?.nota != null && resposta.nota <= NOTA_MAXIMA_INDICACAO;

        return (
          <div key={pergunta.id} className="flex flex-col gap-2 border-b border-black/10 pb-4 dark:border-white/10">
            <p className="font-medium">{pergunta.texto}</p>
            <div className="grid grid-cols-5 gap-1.5">
              {NOTAS.map((nota) => {
                const marcada = resposta?.nota === nota.valor;
                return (
                  <button
                    key={nota.valor}
                    type="button"
                    title={nota.descricao}
                    onClick={() => atualizarResposta(pergunta.id, "nota", nota.valor)}
                    className={`flex flex-col items-center gap-0.5 rounded-lg border-2 px-1 py-1.5 transition-colors ${
                      marcada ? "text-white" : "bg-white hover:brightness-95 dark:bg-background"
                    }`}
                    style={{
                      borderColor: nota.cor,
                      background: marcada ? nota.cor : undefined,
                    }}
                  >
                    <span className="text-base font-bold leading-none" style={{ color: marcada ? undefined : nota.cor }}>
                      {nota.valor}
                    </span>
                    <span
                      className="text-center text-[10px] leading-tight sm:text-[11px]"
                      style={{ color: marcada ? undefined : nota.cor }}
                    >
                      {nota.nome}
                    </span>
                  </button>
                );
              })}
            </div>
            {resposta?.nota != null && (
              <p className="text-xs text-zinc-500">
                {NOTAS.find((n) => n.valor === resposta.nota)?.descricao}
              </p>
            )}

            {indica && (
              <div className="flex flex-col gap-2">
                {resposta.categoria_final_id && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-zinc-500">Competência de treinamento</label>
                    <p className="rounded-md border border-black/15 bg-black/[0.03] px-3 py-2 text-sm dark:border-white/20 dark:bg-white/[0.03]">
                      {nomeCategoria(resposta.categoria_final_id) ?? "Nenhuma"}
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

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={salvarRascunho}
          disabled={salvandoRascunho}
          className="flex items-center gap-2 rounded-md border border-primary-border bg-white px-4 py-2 text-sm font-medium text-primary hover:bg-primary-soft disabled:opacity-60 dark:bg-background"
        >
          <Save className="h-4 w-4" />
          {salvandoRascunho ? "Salvando..." : "Salvar rascunho"}
        </button>
        <button
          type="button"
          onClick={irParaRevisao}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
        >
          <Send className="h-4 w-4" />
          Enviar
        </button>
      </div>
      <p className="-mt-3 text-xs text-zinc-500">
        O rascunho fica guardado neste link: dá pra fechar e continuar depois, dentro do prazo.
      </p>
    </div>
  );
}
