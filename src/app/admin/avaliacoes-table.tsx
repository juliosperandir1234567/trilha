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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, matrícula ou gestor..."
          className="w-full rounded-md border border-black/15 py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-primary-border">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="border-b-2 border-primary-border bg-primary-soft/40 text-primary">
              <th className="whitespace-nowrap px-3 py-3">Matrícula</th>
              <th className="px-3 py-3">Colaborador</th>
              <th className="whitespace-nowrap px-3 py-3">Período</th>
              <th className="px-3 py-3">Gestor</th>
              <th className="whitespace-nowrap px-3 py-3">Status</th>
              <th className="px-3 py-3">Expira / respondida em</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((avaliacao) => (
              <tr
                key={avaliacao.id}
                className={`border-b border-primary-border/40 last:border-b-0 hover:bg-primary-soft/20 ${avaliacao.notaCritica ? "bg-red-50" : ""}`}
              >
                <td className="whitespace-nowrap px-3 py-3 text-zinc-500">{avaliacao.matricula}</td>
                <td className="px-3 py-3">
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
                </td>
                <td className="whitespace-nowrap px-3 py-3">{avaliacao.marco} dias</td>
                <td className="px-3 py-3 text-zinc-500">{avaliacao.gestorNome}</td>
                <td className="whitespace-nowrap px-3 py-3">
                  <span className={avaliacao.status === "expirada" ? "text-red-600" : ""}>
                    {STATUS_LABEL[avaliacao.status] ?? avaliacao.status}
                  </span>
                  {avaliacao.previstaPara && (
                    <span className="block text-xs text-zinc-400">ainda não criada</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-zinc-500">
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
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                  {avaliacoes.length === 0
                    ? "Nenhuma avaliação encontrada."
                    : "Nenhum resultado pra essa busca."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
