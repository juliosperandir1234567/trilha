"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { nomeDoTurno } from "@/lib/turnos";
import { Trash2 } from "lucide-react";
import { deleteColaboradores } from "@/lib/actions/colaboradores";
import { EnviarAgoraButton } from "./[id]/enviar-agora-button";

const STATUS_LABEL: Record<string, string> = {
  pendente: "Não enviada",
  enviada: "Aguardando resposta",
  expirada: "Expirada",
};

export type ColaboradorLinha = {
  id: string;
  matricula: string | null;
  nome: string;
  cargoNome: string | null;
  dataAdmissao: string;
  // novato: dataAdmissao é a admissão; capacitacao: a mudança de cargo.
  tipo: string;
  estruturaMacro: string | null;
  turno: string | null;
  gestorNome: string;
  gestorEmail: string;
  ativo: boolean;
  marcoPendente: number | null;
  statusMarcoPendente: string | null;
  // Todos os períodos do cargo fechados (finalizados ou não avaliados).
  trilhaConcluida: boolean;
  treinamentosPendentes: number;
};

export function ColaboradoresTable({
  colaboradores,
  podeExcluir,
}: {
  colaboradores: ColaboradorLinha[];
  podeExcluir: boolean;
}) {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [confirmando, setConfirmando] = useState(false);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteColaboradores, undefined);
  const estavaPendente = useRef(false);

  useEffect(() => {
    if (estavaPendente.current && !deletePending && !deleteState?.error) {
      setSelecionados(new Set());
      setConfirmando(false);
    }
    estavaPendente.current = deletePending;
  }, [deletePending, deleteState]);

  function alternar(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function alternarTodos() {
    setSelecionados((atual) =>
      atual.size === colaboradores.length ? new Set() : new Set(colaboradores.map((c) => c.id))
    );
  }

  const totalColunas = podeExcluir ? 8 : 7;

  return (
    <div className="flex flex-col gap-3">
      {podeExcluir && selecionados.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50/60 px-4 py-3">
          {!confirmando ? (
            <>
              <span className="text-sm text-red-700">
                {selecionados.size} colaborador{selecionados.size === 1 ? "" : "es"} selecionado
                {selecionados.size === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={() => setConfirmando(true)}
                className="ml-auto flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir selecionados
              </button>
            </>
          ) : (
            <form action={deleteAction} className="flex w-full flex-wrap items-center gap-2">
              {[...selecionados].map((id) => (
                <input key={id} type="hidden" name="ids" value={id} />
              ))}
              <span className="text-sm text-red-700">
                Isso exclui {selecionados.size} colaborador{selecionados.size === 1 ? "" : "es"} e todo o
                histórico de avaliações deles, sem volta. Confirme sua senha de admin:
              </span>
              <input
                type="password"
                name="senha"
                required
                autoFocus
                placeholder="Senha"
                className="rounded border border-black/15 px-2 py-1 text-sm dark:border-white/20"
              />
              <button
                type="submit"
                disabled={deletePending}
                className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {deletePending ? "Excluindo..." : "Confirmar exclusão"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmando(false)}
                className="rounded border border-black/15 px-3 py-1.5 text-xs dark:border-white/20"
              >
                Cancelar
              </button>
              {deleteState?.error && <p className="w-full text-xs text-red-600">{deleteState.error}</p>}
            </form>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-primary-border">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b-2 border-primary-border bg-primary-soft/40 text-primary">
              {podeExcluir && (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={colaboradores.length > 0 && selecionados.size === colaboradores.length}
                    onChange={alternarTodos}
                    aria-label="Selecionar todos"
                  />
                </th>
              )}
              <th className="whitespace-nowrap px-4 py-3">Matrícula</th>
              <th className="whitespace-nowrap px-4 py-3">Nome</th>
              <th className="whitespace-nowrap px-4 py-3">Cargo</th>
              <th className="whitespace-nowrap px-4 py-3">Início</th>
              <th className="px-4 py-3">Gestor</th>
              <th className="whitespace-nowrap px-4 py-3">Status</th>
              <th className="px-4 py-3">Avaliação</th>
            </tr>
          </thead>
          <tbody>
            {colaboradores.map((colaborador) => (
              <tr
                key={colaborador.id}
                className={`border-b border-primary-border/40 align-top last:border-b-0 hover:bg-primary-soft/20 ${
                  selecionados.has(colaborador.id) ? "bg-primary-soft/30" : ""
                }`}
              >
                {podeExcluir && (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selecionados.has(colaborador.id)}
                      onChange={() => alternar(colaborador.id)}
                      aria-label={`Selecionar ${colaborador.nome}`}
                    />
                  </td>
                )}
                <td className="whitespace-nowrap px-4 py-3 text-zinc-500">{colaborador.matricula}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/colaboradores/${colaborador.id}`}
                    className="inline-flex items-center gap-1 text-primary underline underline-offset-2"
                  >
                    {colaborador.nome}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                  {colaborador.cargoNome ?? "-"}
                  {(colaborador.estruturaMacro || colaborador.turno) && (
                    <span className="block text-[11px]">
                      {[colaborador.estruturaMacro, nomeDoTurno(colaborador.turno)].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {new Date(colaborador.dataAdmissao + "T00:00:00").toLocaleDateString("pt-BR")}
                  <span className="block text-[11px] text-zinc-500">
                    {colaborador.tipo === "capacitacao" ? "Capacitação" : "Novato"}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-500">
                  <div className="flex flex-col">
                    <span>{colaborador.gestorNome}</span>
                    <span className="text-xs text-zinc-400">{colaborador.gestorEmail}</span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3">{colaborador.ativo ? "Ativo" : "Inativo"}</td>
                <td className="px-4 py-3">
                  {colaborador.marcoPendente ? (
                    <div className="flex flex-col items-start gap-2">
                      <span className="text-xs text-zinc-500">
                        {colaborador.marcoPendente} dias —{" "}
                        {STATUS_LABEL[colaborador.statusMarcoPendente ?? ""] ?? "Não enviada"}
                      </span>
                      <EnviarAgoraButton colaboradorId={colaborador.id} marco={colaborador.marcoPendente} />
                    </div>
                  ) : (
                    colaborador.trilhaConcluida ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        ✓ Trilha concluída
                      </span>
                    ) : (
                      <span className="text-xs text-amber-700">
                        Tudo respondido · {colaborador.treinamentosPendentes} treinamento(s) a fazer
                      </span>
                    )
                  )}
                </td>
              </tr>
            ))}
            {colaboradores.length === 0 && (
              <tr>
                <td colSpan={totalColunas} className="px-4 py-6 text-center text-zinc-500">
                  Nenhum colaborador importado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
