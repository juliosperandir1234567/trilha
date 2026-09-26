"use client";

import { useState } from "react";
import { ArrowDown, Building2, Clock, LayoutGrid, Moon, Sun, Sunset, UserX, type LucideIcon } from "lucide-react";

export type LinhaEstrutura = {
  nome: string;
  // false = colaboradores sem estrutura ("Não informada"), sempre por último.
  informada: boolean;
  total: number;
  // Quantos em cada turno, pela chave do turno ("" = sem turno).
  turnos: Record<string, number>;
};

// Cor e ícone de cada turno, na ordem das colunas.
const COLUNAS_TURNO: { valor: string; nome: string; icone: LucideIcon; icone_cor: string; fundo: string }[] = [
  { valor: "diurno", nome: "Diurno", icone: Sun, icone_cor: "text-amber-500", fundo: "bg-amber-50" },
  { valor: "vespertino", nome: "Vespertino", icone: Sunset, icone_cor: "text-orange-500", fundo: "bg-orange-50" },
  { valor: "noturno", nome: "Noturno", icone: Moon, icone_cor: "text-blue-600", fundo: "bg-blue-50" },
  { valor: "fixo", nome: "Fixo", icone: Clock, icone_cor: "text-emerald-700", fundo: "bg-emerald-50" },
];
const SEM_TURNO = { valor: "", nome: "Sem turno", icone: UserX, icone_cor: "text-zinc-400", fundo: "bg-zinc-50" };

const LINHAS_VISIVEIS = 8;

export function EstruturasCard({
  linhas,
  sufixoTitulo = "",
}: {
  linhas: LinhaEstrutura[];
  // Filtro de status clicado nos cards (ex: " — Aguardando resposta").
  sufixoTitulo?: string;
}) {
  const [filtro, setFiltro] = useState("");
  const [todas, setTodas] = useState(false);

  // Coluna "Sem turno" só aparece se alguém estiver sem turno.
  const colunas = linhas.some((l) => l.turnos[""]) ? [...COLUNAS_TURNO, SEM_TURNO] : COLUNAS_TURNO;
  const filtradas = filtro ? linhas.filter((l) => l.nome === filtro) : linhas;
  const visiveis = todas || filtro ? filtradas : filtradas.slice(0, LINHAS_VISIVEIS);
  const maior = Math.max(1, ...linhas.map((l) => l.total));
  const totalEstruturas = linhas.filter((l) => l.informada).length;

  return (
    <div className="flex h-full flex-col rounded-xl border border-primary-border bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4 pb-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Building2 className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold leading-tight">Colaboradores por estrutura{sufixoTitulo}</h2>
            <p className="text-xs text-zinc-500">Quantidade de colaboradores em cada estrutura</p>
          </div>
        </div>
        {linhas.length > 1 && (
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            aria-label="Filtrar estrutura"
            className="rounded-md border border-black/15 px-2.5 py-1.5 text-sm text-zinc-700"
          >
            <option value="">Todas as estruturas</option>
            {linhas.map((l) => (
              <option key={l.nome} value={l.nome}>
                {l.nome}
              </option>
            ))}
          </select>
        )}
      </div>

      {linhas.length === 0 ? (
        <p className="px-4 pb-4 text-center text-xs text-zinc-500">Nenhum colaborador com esses filtros.</p>
      ) : (
        <div className="overflow-x-auto px-2">
          <table className="w-full min-w-[520px] border-separate border-spacing-x-1 border-spacing-y-1.5 text-sm">
            <thead>
              <tr className="bg-primary-soft/40 text-xs text-primary">
                <th className="rounded-l-md px-2 py-2.5 text-left font-semibold">Estrutura</th>
                <th className="px-2 py-2.5 text-left font-semibold">
                  <span className="inline-flex items-center gap-1">
                    Total <ArrowDown className="h-3 w-3" />
                  </span>
                </th>
                {colunas.map((coluna, i) => {
                  const Icone = coluna.icone;
                  return (
                    <th
                      key={coluna.valor || "sem"}
                      className={`px-1 py-2.5 font-medium text-zinc-700 ${i === colunas.length - 1 ? "rounded-r-md" : ""}`}
                    >
                      <span className="inline-flex items-center gap-1">
                        <Icone className={`h-4 w-4 ${coluna.icone_cor}`} />
                        {coluna.nome}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visiveis.map((linha) => (
                <tr key={linha.nome}>
                  <td
                    className={`whitespace-nowrap px-2 py-1.5 text-xs font-medium ${
                      linha.informada ? "text-zinc-900" : "text-zinc-400"
                    }`}
                  >
                    {linha.nome}
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-6 text-base font-bold tabular-nums text-zinc-900">{linha.total}</span>
                      <div className="h-3 w-20 overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${(linha.total / maior) * 100}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  {colunas.map((coluna) => {
                    const valor = linha.turnos[coluna.valor] ?? 0;
                    return (
                      <td
                        key={coluna.valor || "sem"}
                        className={`rounded-md px-1 py-1.5 text-center text-sm tabular-nums ${coluna.fundo} ${
                          valor ? "font-semibold text-zinc-900" : "text-zinc-400"
                        }`}
                      >
                        {valor}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 px-4 py-3 text-sm">
        <span className="flex items-center gap-1.5 text-zinc-500">
          <LayoutGrid className="h-4 w-4 text-primary" />
          {totalEstruturas} estrutura{totalEstruturas === 1 ? "" : "s"}
        </span>
        {!filtro && filtradas.length > LINHAS_VISIVEIS && (
          <button
            type="button"
            onClick={() => setTodas(!todas)}
            className="font-medium text-primary underline underline-offset-2"
          >
            {todas ? "Ver menos" : "Ver todas as estruturas →"}
          </button>
        )}
      </div>
    </div>
  );
}
