"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Search } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  pendente: "Não enviada",
  enviada: "Aguardando resposta",
  respondida: "Respondida",
  expirada: "Expirada",
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
};

export function AvaliacoesTable({ avaliacoes }: { avaliacoes: AvaliacaoLinha[] }) {
  const [busca, setBusca] = useState("");

  const termo = busca.trim().toLowerCase();
  const filtradas = termo
    ? avaliacoes.filter(
        (a) =>
          a.colaboradorNome.toLowerCase().includes(termo) ||
          (a.matricula ?? "").toLowerCase().includes(termo) ||
          a.gestorNome.toLowerCase().includes(termo)
      )
    : avaliacoes;
  const [expandida, setExpandida] = useState(false);
  // Até 5 linhas a tabela já cabe inteira, sem rolagem.
  const podeExpandir = filtradas.length > 5;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, matrícula ou gestor..."
          className="w-full rounded-md border border-black/15 py-1.5 pl-9 pr-3 text-sm outline-none focus:border-primary"
        />
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
              <th className="px-2.5 py-2">Expira / respondida em</th>
              <th className="whitespace-nowrap px-2.5 py-2">Prazo</th>
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
                </td>
                <td className="whitespace-nowrap px-2.5 py-2 text-zinc-500">
                  {avaliacao.previstaPara
                    ? `Período em ${new Date(avaliacao.previstaPara + "T00:00:00").toLocaleDateString("pt-BR")}`
                    : avaliacao.status === "respondida"
                    ? avaliacao.dataResposta
                      ? new Date(avaliacao.dataResposta).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
                      : "-"
                    : avaliacao.expiraEm
                      ? new Date(avaliacao.expiraEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
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
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-zinc-500">
                  {avaliacoes.length === 0
                    ? "Nenhuma avaliação encontrada."
                    : "Nenhum resultado pra essa busca."}
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
