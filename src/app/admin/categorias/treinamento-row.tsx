"use client";

import { useActionState, useState } from "react";
import { Pencil, Power, Trash2 } from "lucide-react";
import {
  toggleTreinamentoAtivo,
  updateTreinamento,
  deleteTreinamento,
} from "@/lib/actions/treinamentos";
import { AcoesMenu } from "@/components/acoes-menu";

type Categoria = { id: string; nome: string };
type Cargo = { id: string; nome: string };
type Treinamento = {
  id: string;
  categoria_id: string;
  cargo_id: string | null;
  nome: string;
  ativo: boolean;
};

export function TreinamentoRow({
  treinamento,
  categorias,
  cargos,
  podeExcluir,
}: {
  treinamento: Treinamento;
  categorias: Categoria[];
  cargos: Cargo[];
  podeExcluir: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  const [editState, editAction, editPending] = useActionState(updateTreinamento, undefined);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteTreinamento, undefined);

  const [editStateVisto, setEditStateVisto] = useState(editState);
  if (editState !== editStateVisto) {
    setEditStateVisto(editState);
    if (editState?.success) setEditando(false);
  }

  if (editando) {
    return (
      <tr className="border-b border-primary-border/40 last:border-b-0">
        <td colSpan={3} className="px-4 py-3">
          <form action={editAction} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <input type="hidden" name="id" value={treinamento.id} />
            <div className="flex flex-col gap-1.5 sm:min-w-[180px]">
              <label className="text-xs font-medium">Competência</label>
              <select
                name="categoria_id"
                defaultValue={treinamento.categoria_id}
                required
                className="w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20"
              >
                {categorias.map((categoria) => (
                  <option key={categoria.id} value={categoria.id}>
                    {categoria.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5 sm:min-w-[160px]">
              <label className="text-xs font-medium">Cargo</label>
              <select
                name="cargo_id"
                defaultValue={treinamento.cargo_id ?? ""}
                className="w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20"
              >
                <option value="">Todos os cargos</option>
                {cargos.map((cargo) => (
                  <option key={cargo.id} value={cargo.id}>
                    {cargo.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-1 flex-col gap-1.5 sm:min-w-[160px]">
              <label className="text-xs font-medium">Nome</label>
              <input
                name="nome"
                defaultValue={treinamento.nome}
                required
                className="w-full rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-primary dark:border-white/20"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={editPending}
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
              >
                {editPending ? "Salvando..." : "Salvar"}
              </button>
              <button
                type="button"
                onClick={() => setEditando(false)}
                className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20"
              >
                Cancelar
              </button>
            </div>
            {editState?.error && <p className="w-full text-sm text-red-600">{editState.error}</p>}
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-primary-border/40 align-top last:border-b-0 hover:bg-primary-soft/20">
      <td className="px-4 py-3">{treinamento.nome}</td>
      <td className="whitespace-nowrap px-4 py-3">{treinamento.ativo ? "Ativo" : "Inativo"}</td>
      <td className="px-4 py-3 text-right">
        <AcoesMenu label="Ações do treinamento" onClose={() => setConfirmandoExclusao(false)}>
          {(fechar) =>
            !confirmandoExclusao ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditando(true);
                    fechar();
                  }}
                  className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-primary/10"
                >
                  <Pencil className="h-4 w-4" />
                  Editar
                </button>
                <form action={toggleTreinamentoAtivo} onSubmit={fechar}>
                  <input type="hidden" name="id" value={treinamento.id} />
                  <input type="hidden" name="ativo" value={String(treinamento.ativo)} />
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-primary/10"
                  >
                    <Power className="h-4 w-4" />
                    {treinamento.ativo ? "Desativar" : "Ativar"}
                  </button>
                </form>
                {podeExcluir && (
                  <button
                    type="button"
                    onClick={() => setConfirmandoExclusao(true)}
                    className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    <Trash2 className="h-4 w-4" />
                    Excluir
                  </button>
                )}
              </>
            ) : (
              <form action={deleteAction} className="flex flex-col gap-2 p-2">
                <input type="hidden" name="id" value={treinamento.id} />
                <label className="text-xs text-zinc-500">
                  Confirme sua senha de admin para excluir
                </label>
                <input
                  type="password"
                  name="senha"
                  required
                  autoFocus
                  className="rounded border border-black/15 px-2 py-1 text-sm dark:border-white/20"
                />
                {deleteState?.error && <p className="text-xs text-red-600">{deleteState.error}</p>}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={deletePending}
                    className="flex-1 rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {deletePending ? "Excluindo..." : "Confirmar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmandoExclusao(false)}
                    className="flex-1 rounded border border-black/15 px-2 py-1 text-xs dark:border-white/20"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )
          }
        </AcoesMenu>
      </td>
    </tr>
  );
}
