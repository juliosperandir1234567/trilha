"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileDown, Search } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  pendente: "Não enviada",
  enviada: "Aguardando resposta",
  respondida: "Respondida",
  expirada: "Expirada",
  nao_avaliada: "Não avaliada",
};

export type AvaliacaoLinha = {
  id: string;
  marco: number;
  status: string;
  dataResposta: string | null;
  expiraEm: string | null;
  notaCritica: boolean;
  colaboradorId: string | null;
  colaboradorNome: string;
  matricula: string | null;
  gestorNome: string;
  cargo: string | null;
  // Prazo de resposta de avaliação enviada/expirada; urgente fica vermelho.
  prazo: { texto: string; urgente: boolean } | null;
  // Período que já chegou mas a avaliação ainda não foi criada pela rotina
  // (data ISO do período). Entra na tabela como "Não enviada".
  previstaPara?: string;
  // Gestor encerrou pelo link sem notas: "afastado" ou "desligado".
  motivoNaoAvaliada?: string | null;
  observacaoNaoAvaliada?: string | null;
  // Treinamentos indicados pelo gestor e quantos o admin já marcou como feitos.
  treinamentosIndicados?: number;
  treinamentosFeitos?: number;
};

type Aba = "andamento" | "respondidas";

// Respondidas e não avaliadas já saíram das mãos do gestor; o resto ainda
// depende de alguém (envio, resposta).
const ehRespondida = (a: AvaliacaoLinha) => a.status === "respondida" || a.status === "nao_avaliada";

// Finalizada: respondida e com todo treinamento indicado já feito.
const ehFinalizada = (a: AvaliacaoLinha) =>
  a.status === "respondida" && (a.treinamentosFeitos ?? 0) >= (a.treinamentosIndicados ?? 0);

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function AvaliacoesTable({
  avaliacoes,
  abaInicial = "andamento",
}: {
  avaliacoes: AvaliacaoLinha[];
  abaInicial?: Aba;
}) {
  const [busca, setBusca] = useState("");
  const [aba, setAba] = useState<Aba>(abaInicial);
  const [expandida, setExpandida] = useState(false);

  const termo = busca.trim().toLowerCase();
  const buscadas = termo
    ? avaliacoes.filter(
        (a) =>
          a.colaboradorNome.toLowerCase().includes(termo) ||
          (a.matricula ?? "").toLowerCase().includes(termo) ||
          a.gestorNome.toLowerCase().includes(termo)
      )
    : avaliacoes;
  const emAndamento = buscadas.filter((a) => !ehRespondida(a));
  const respondidas = buscadas.filter(ehRespondida);
  const filtradas = aba === "andamento" ? emAndamento : respondidas;
  const finalizadas = respondidas.filter(ehFinalizada);

  // Até 5 linhas a tabela já cabe inteira, sem rolagem.
  const podeExpandir = filtradas.length > 5;

  const abas: { chave: Aba; rotulo: string; total: number }[] = [
    { chave: "andamento", rotulo: "Em andamento", total: emAndamento.length },
    { chave: "respondidas", rotulo: "Respondidas", total: respondidas.length },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" className="flex overflow-hidden rounded-lg border border-primary-border text-xs font-medium">
          {abas.map((opcao) => (
            <button
              key={opcao.chave}
              type="button"
              role="tab"
              aria-selected={aba === opcao.chave}
              onClick={() => {
                setAba(opcao.chave);
                setExpandida(false);
              }}
              className={`flex items-center gap-1.5 border-r border-primary-border px-3 py-2 transition-colors last:border-r-0 ${
                aba === opcao.chave ? "bg-primary text-primary-foreground" : "text-primary hover:bg-primary-soft"
              }`}
            >
              {opcao.rotulo}
              <span
                className={`rounded-full px-1.5 text-[10px] tabular-nums ${
                  aba === opcao.chave ? "bg-white/25" : "bg-primary-soft"
                }`}
              >
                {opcao.total}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, matrícula ou gestor..."
            className="w-full rounded-md border border-black/15 py-1.5 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>

        {/* PDF em massa: um arquivo por avaliação finalizada da lista atual
            (filtros da página + busca), tudo num .zip. POST porque a lista
            de ids pode ser grande demais pra URL. */}
        {aba === "respondidas" && finalizadas.length > 0 && (
          <form method="post" action="/admin/avaliacoes/pdf" className="ml-auto">
            <input type="hidden" name="ids" value={finalizadas.map((a) => a.id).join(",")} />
            <button
              type="submit"
              className="flex items-center gap-2 rounded-md border border-primary-border px-3 py-1.5 text-sm text-primary hover:bg-primary-soft"
            >
              <FileDown className="h-4 w-4" />
              Exportar finalizadas em PDF ({finalizadas.length})
            </button>
          </form>
        )}
      </div>

      {/* ~5 linhas visíveis; a partir daí rola, com o cabeçalho fixo. Um
          clique em qualquer lugar da tabela abre ela inteira. */}
      <div
        onClick={() => podeExpandir && setExpandida(true)}
        className={`overflow-auto rounded-lg border border-primary-border ${
          expandida ? "" : "max-h-[252px]"
        } ${podeExpandir && !expandida ? "cursor-pointer" : ""}`}
      >
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="border-b-2 border-primary-border bg-primary-soft/40 text-primary">
              {/* Matrícula e Gestor saem no celular pra Status caber; a busca continua achando por eles. */}
              <th className="hidden whitespace-nowrap px-2.5 py-2 sm:table-cell">Matrícula</th>
              <th className="px-2.5 py-2">Colaborador</th>
              <th className="whitespace-nowrap px-2.5 py-2">Período</th>
              <th className="hidden px-2.5 py-2 sm:table-cell">Gestor</th>
              <th className="whitespace-nowrap px-2.5 py-2">Status</th>
              {aba === "andamento" ? (
                <>
                  <th className="px-2.5 py-2">Expira em</th>
                  <th className="whitespace-nowrap px-2.5 py-2">Prazo</th>
                </>
              ) : (
                <>
                  <th className="px-2.5 py-2">Respondida em</th>
                  <th className="whitespace-nowrap px-2.5 py-2">Treinamentos</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {filtradas.map((avaliacao) => (
              <tr
                key={avaliacao.id}
                className={`border-b border-primary-border/40 last:border-b-0 hover:bg-primary-soft/20 ${avaliacao.notaCritica ? "bg-red-50" : ""}`}
              >
                <td className="hidden whitespace-nowrap px-2.5 py-2 text-zinc-500 sm:table-cell">{avaliacao.matricula}</td>
                <td className="px-2.5 py-2">
                  <Link
                    href={`/admin/colaboradores/${avaliacao.colaboradorId}`}
                    className="text-primary underline underline-offset-2"
                  >
                    {avaliacao.colaboradorNome}
                  </Link>
                  {avaliacao.notaCritica && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                      <AlertTriangle className="h-3 w-3" />
                      Atenção
                    </span>
                  )}
                  {avaliacao.cargo && (
                    <span className="block text-[11px] text-zinc-500">{avaliacao.cargo}</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-2.5 py-2">{avaliacao.marco} dias</td>
                <td className="hidden px-2.5 py-2 text-zinc-500 sm:table-cell">{avaliacao.gestorNome}</td>
                <td className="whitespace-nowrap px-2.5 py-2">
                  <span className={avaliacao.status === "expirada" ? "text-red-600" : ""}>
                    {STATUS_LABEL[avaliacao.status] ?? avaliacao.status}
                  </span>
                  {avaliacao.previstaPara && (
                    <span className="block text-xs text-zinc-400">ainda não criada</span>
                  )}
                  {avaliacao.motivoNaoAvaliada && (
                    <span
                      className="block text-xs text-zinc-500"
                      title={avaliacao.observacaoNaoAvaliada ?? undefined}
                    >
                      {avaliacao.motivoNaoAvaliada === "desligado" ? "Desligado" : "Afastado"}
                      {avaliacao.observacaoNaoAvaliada ? " · ver obs." : ""}
                    </span>
                  )}
                </td>
                {aba === "andamento" ? (
                  <>
                    <td className="whitespace-nowrap px-2.5 py-2 text-zinc-500">
                      {avaliacao.previstaPara
                        ? `Período em ${new Date(avaliacao.previstaPara + "T00:00:00").toLocaleDateString("pt-BR")}`
                        : avaliacao.expiraEm
                          ? dataHora(avaliacao.expiraEm)
                          : "-"}
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-2">
                      {avaliacao.prazo ? (
                        <span className={avaliacao.prazo.urgente ? "font-medium text-red-600" : "text-zinc-600"}>
                          {avaliacao.prazo.texto}
                        </span>
                      ) : (
                        <span className="text-zinc-300">-</span>
                      )}
                    </td>
                  </>
                ) : (
                  <>
                    <td className="whitespace-nowrap px-2.5 py-2 text-zinc-500">
                      {avaliacao.dataResposta ? dataHora(avaliacao.dataResposta) : "-"}
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-2">
                      {avaliacao.status !== "respondida" ? (
                        <span className="text-zinc-300">-</span>
                      ) : ehFinalizada(avaliacao) ? (
                        <span className="flex items-center gap-2">
                          <span className="flex items-center gap-1 font-medium text-green-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {avaliacao.treinamentosIndicados ? "Finalizada" : "Finalizada (sem indicação)"}
                          </span>
                          <a
                            href={`/admin/avaliacoes/pdf?id=${avaliacao.id}`}
                            onClick={(e) => e.stopPropagation()}
                            title="Baixar PDF desta avaliação"
                            className="text-primary hover:underline"
                          >
                            PDF
                          </a>
                        </span>
                      ) : (
                        <Link
                          href={`/admin/colaboradores/${avaliacao.colaboradorId}`}
                          className="text-amber-700 hover:underline"
                          title="Marcar os treinamentos feitos na página do colaborador"
                        >
                          {avaliacao.treinamentosFeitos ?? 0} de {avaliacao.treinamentosIndicados} feitos
                        </Link>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-zinc-500">
                  {termo
                    ? "Nenhum resultado pra essa busca."
                    : aba === "andamento"
                      ? "Nenhuma avaliação em andamento."
                      : "Nenhuma avaliação respondida."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {podeExpandir && (
        <button
          type="button"
          onClick={() => setExpandida(!expandida)}
          className="w-fit text-xs text-primary underline underline-offset-2"
        >
          {expandida ? "Recolher" : `Mostrar todas (${filtradas.length})`}
        </button>
      )}
    </div>
  );
}
