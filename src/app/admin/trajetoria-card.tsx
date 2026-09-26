"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Ban,
  CalendarDays,
  Check,
  Hourglass,
  Mail,
  MailWarning,
  Search,
  TrendingUp,
  User,
  XCircle,
  type LucideIcon,
} from "lucide-react";

// Situação de um período na trajetória.
export type EstadoPeriodo =
  | "ok" // finalizada: respondida e treinamentos feitos
  | "treinamento" // respondida, falta treinamento
  | "aguardando" // e-mail enviado, esperando o gestor
  | "expirada" // prazo venceu sem resposta (volta com o lembrete)
  | "nao_enviada" // período chegou e o e-mail não saiu
  | "afastado"
  | "desligado"
  | "futuro"; // ainda não chegou

export type PeriodoTrajetoria = {
  marco: number;
  estado: EstadoPeriodo;
  // Data do período (futuro/não enviada) ou prazo do link (aguardando).
  data: string | null;
};

export type LinhaTrajetoria = {
  id: string;
  nome: string;
  detalhe: string;
  periodos: PeriodoTrajetoria[];
};

const VISUAL: Record<
  EstadoPeriodo,
  { icone: LucideIcon; bolinha: string; etiqueta: string; texto: (data: string | null) => string }
> = {
  ok: {
    icone: Check,
    bolinha: "bg-green-600 text-white",
    etiqueta: "bg-green-50 text-green-800",
    texto: () => "OK",
  },
  treinamento: {
    icone: Hourglass,
    bolinha: "bg-amber-400 text-amber-950",
    etiqueta: "bg-amber-50 text-amber-800",
    texto: () => "Treinamento",
  },
  aguardando: {
    icone: Mail,
    bolinha: "bg-orange-500 text-white",
    etiqueta: "bg-orange-50 text-orange-800",
    texto: (data) => (data ? `Prazo ${dataCurta(data)}` : "Aguardando"),
  },
  expirada: {
    icone: XCircle,
    bolinha: "bg-red-500 text-white",
    etiqueta: "bg-red-50 text-red-700",
    texto: () => "Expirada",
  },
  nao_enviada: {
    icone: MailWarning,
    bolinha: "bg-blue-600 text-white",
    etiqueta: "bg-blue-50 text-blue-800",
    texto: () => "Não enviada",
  },
  afastado: {
    icone: Ban,
    bolinha: "bg-zinc-400 text-white",
    etiqueta: "bg-zinc-100 text-zinc-600",
    texto: () => "Afastado",
  },
  desligado: {
    icone: Ban,
    bolinha: "bg-zinc-400 text-white",
    etiqueta: "bg-zinc-100 text-zinc-600",
    texto: () => "Desligado",
  },
  futuro: {
    icone: CalendarDays,
    bolinha: "border-2 border-zinc-300 bg-white text-zinc-400",
    etiqueta: "bg-zinc-50 text-zinc-600",
    texto: (data) => (data ? dataCurta(data) : "—"),
  },
};

function dataCurta(iso: string) {
  const data = iso.length === 10 ? new Date(iso + "T00:00:00") : new Date(iso);
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

const VISIVEIS = 5;

export function TrajetoriaCard({ linhas }: { linhas: LinhaTrajetoria[] }) {
  const [busca, setBusca] = useState("");
  const [todos, setTodos] = useState(false);

  const termo = busca.trim().toLowerCase();
  const filtradas = termo
    ? linhas.filter((l) => l.nome.toLowerCase().includes(termo) || l.detalhe.toLowerCase().includes(termo))
    : linhas;
  const visiveis = todos || termo ? filtradas : filtradas.slice(0, VISIVEIS);

  return (
    <div className="rounded-xl border border-primary-border bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4 pb-2">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <TrendingUp className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-semibold leading-tight">Trajetória do colaborador</h2>
            <p className="text-xs text-zinc-500">Jornada de cada colaborador pelos períodos do cargo</p>
          </div>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar colaborador..."
            className="w-full rounded-md border border-black/15 py-1.5 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
      </div>

      {filtradas.length === 0 ? (
        <p className="px-4 pb-4 pt-2 text-center text-xs text-zinc-500">
          {termo ? "Nenhum colaborador pra essa busca." : "Nenhum colaborador com esses filtros."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2 px-3 pb-3 pt-1">
          {visiveis.map((linha) => (
            <li key={linha.id} className="rounded-lg border border-primary-border/60 p-3">
              <Link
                href={`/admin/colaboradores/${linha.id}`}
                className="mb-2 flex w-fit items-center gap-2.5 hover:underline"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft">
                  <User className="h-5 w-5 text-primary" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-zinc-900">{linha.nome}</span>
                  <span className="block text-xs text-zinc-500">{linha.detalhe}</span>
                </span>
              </Link>

              {/* Linha do tempo: rola pro lado quando há muitos períodos. */}
              <div className="overflow-x-auto">
                <ol className="flex min-w-max">
                  {linha.periodos.map((periodo, i) => {
                    const visual = VISUAL[periodo.estado];
                    const Icone = visual.icone;
                    // Trecho da linha até o próximo período fica verde se este já está OK.
                    const proximoLigado = periodo.estado === "ok";
                    return (
                      <li key={periodo.marco} className="flex w-24 flex-col items-center gap-1 sm:w-28">
                        <span className="text-xs font-semibold leading-tight text-zinc-800">
                          {periodo.marco} dias
                        </span>
                        <div className="relative flex w-full items-center justify-center">
                          {i > 0 && (
                            <span
                              className={`absolute left-0 right-1/2 top-1/2 h-0.5 -translate-y-1/2 ${
                                linha.periodos[i - 1].estado === "ok" ? "bg-green-600" : "bg-zinc-200"
                              }`}
                            />
                          )}
                          {i < linha.periodos.length - 1 && (
                            <span
                              className={`absolute left-1/2 right-0 top-1/2 h-0.5 -translate-y-1/2 ${
                                proximoLigado ? "bg-green-600" : "bg-zinc-200"
                              }`}
                            />
                          )}
                          <span
                            className={`relative flex h-8 w-8 items-center justify-center rounded-full ${visual.bolinha}`}
                            title={visual.texto(periodo.data)}
                          >
                            <Icone className="h-4 w-4" strokeWidth={2.5} />
                          </span>
                        </div>
                        <span
                          className={`w-full max-w-[6rem] rounded-md px-1.5 py-1 text-center text-[11px] font-medium ${visual.etiqueta}`}
                        >
                          {visual.texto(periodo.data)}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!termo && filtradas.length > VISIVEIS && (
        <div className="flex justify-end px-4 pb-3">
          <button
            type="button"
            onClick={() => setTodos(!todos)}
            className="text-sm font-medium text-primary underline underline-offset-2"
          >
            {todos ? "Ver menos" : `Ver todos (${filtradas.length}) →`}
          </button>
        </div>
      )}
    </div>
  );
}
