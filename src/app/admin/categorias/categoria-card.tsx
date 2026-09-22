"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Pencil, Power, Trash2 } from "lucide-react";
import {
  toggleCategoriaAtiva,
  updateCategoria,
  deleteCategoria,
} from "@/lib/actions/categorias";
import { AcoesMenu } from "@/components/acoes-menu";

type Categoria = { id: string; nome: string; descricao: string | null; ativo: boolean };

export function CategoriaCard({
  categoria,
  podeExcluir,
  children,
}: {
  categoria: Categoria;
  podeExcluir: boolean;
  children: ReactNode;
}) {
  const [editando, setEditando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  const [editState, editAction, editPending] = useActionState(updateCategoria, undefined);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteCategoria, undefined);

  const [editStateVisto, setEditStateVisto] = useState(editState);
  if (editState !== editStateVisto) {
    setEditStateVisto(editState);
    if (editState?.success) setEditando(false);
  }

  return (
    <div className="overflow-hidden rounded-lg border border-primary-border">
      {editando ? (
        <form
          action={editAction}
          className="flex flex-col gap-3 border-b border-primary-border bg-primary-soft/40 p-4 sm:flex-row sm:flex-wrap sm:items-end"
        >
          <input type="hidden" name="id" value={categoria.id} />
          <div className="flex flex-1 flex-col gap-1.5 sm:min-w-[180px]">
            <label className="text-xs font-medium">Nome</label>
            <input
              name="nome"
              defaultValue={categoria.nome}
              required
              className="w-full rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-primary dark:border-white/20"
            />
          </div>
          <div className="flex flex-[2] flex-col gap-1.5 sm:min-w-[220px]">
            <label className="text-xs font-medium">Descrição</label>
            <input
              name="descricao"
              defaultValue={categoria.descricao ?? ""}
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
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary-border bg-primary-soft/40 px-4 py-3">
          <div>
            <p className="font-medium">{categoria.nome}</p>
            {categoria.descricao && <p className="text-sm text-zinc-500">{categoria.descricao}</p>}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-500">{categoria.ativo ? "Ativa" : "Inativa"}</span>

            <AcoesMenu label="Ações da categoria" onClose={() => setConfirmandoExclusao(false)}>
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
                    <form action={toggleCategoriaAtiva} onSubmit={fechar}>
                      <input type="hidden" name="id" value={categoria.id} />
                      <input type="hidden" name="ativo" value={String(categoria.ativo)} />
                      <button
                        type="submit"
                        className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-primary/10"
                      >
                        <Power className="h-4 w-4" />
                        {categoria.ativo ? "Desativar" : "Ativar"}
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
                    <input type="hidden" name="id" value={categoria.id} />
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
                    {deleteState?.error && (
                      <p className="text-xs text-red-600">{deleteState.error}</p>
                    )}
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
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
