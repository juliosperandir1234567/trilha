"use client";

import { useActionState, useState } from "react";
import { Pencil, Power, Trash2 } from "lucide-react";
import { togglePerguntaAtiva, updatePergunta, deletePergunta } from "@/lib/actions/perguntas";
import { AcoesMenu } from "@/components/acoes-menu";

type Categoria = { id: string; nome: string };
type Cargo = { id: string; nome: string; marcos: number[] };
type Pergunta = {
  id: string;
  marco: number;
  texto: string;
  ativo: boolean;
  cargo_id: string | null;
  categoria_sugerida_id: string | null;
  cargoNome: string;
  categoriaNome: string;
};

const TODOS_OS_MARCOS = [30, 60, 90, 120, 180, 270] as const;

export function PerguntaRow({
  pergunta,
  categorias,
  cargos,
  podeExcluir,
}: {
  pergunta: Pergunta;
  categorias: Categoria[];
  cargos: Cargo[];
  podeExcluir: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [cargoEdit, setCargoEdit] = useState(pergunta.cargo_id ?? "");
  const [marcoEdit, setMarcoEdit] = useState(pergunta.marco);

  const [editState, editAction, editPending] = useActionState(updatePergunta, undefined);
  const [deleteState, deleteAction, deletePending] = useActionState(deletePergunta, undefined);

  const [editStateVisto, setEditStateVisto] = useState(editState);
  if (editState !== editStateVisto) {
    setEditStateVisto(editState);
    if (editState?.success) setEditando(false);
  }

  const cargoAtual = cargos.find((c) => c.id === cargoEdit);
  const marcosDisponiveis = cargoAtual ? cargoAtual.marcos : [...TODOS_OS_MARCOS];
  const marcoValido = marcosDisponiveis.includes(marcoEdit) ? marcoEdit : marcosDisponiveis[0];

  if (editando) {
    return (
      <tr className="border-b border-primary-border/40 last:border-b-0">
        <td colSpan={5} className="px-4 py-3">
          <form action={editAction} className="flex flex-col gap-3">
            <input type="hidden" name="id" value={pergunta.id} />
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="flex flex-col gap-1.5 sm:min-w-[160px]">
                <label className="text-xs font-medium">Cargo</label>
                <select
                  name="cargo_id"
                  value={cargoEdit}
                  onChange={(e) => setCargoEdit(e.target.value)}
                  className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20"
                >
                  <option value="">Todos os cargos</option>
                  {cargos.map((cargo) => (
                    <option key={cargo.id} value={cargo.id}>
                      {cargo.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5 sm:min-w-[120px]">
                <label className="text-xs font-medium">Marco</label>
                <select
                  name="marco"
                  value={marcoValido}
                  onChange={(e) => setMarcoEdit(Number(e.target.value))}
                  className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20"
                >
                  {marcosDisponiveis.map((marco) => (
                    <option key={marco} value={marco}>
                      {marco} dias
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-1 flex-col gap-1.5 sm:min-w-[220px]">
                <label className="text-xs font-medium">Pergunta</label>
                <input
                  name="texto"
                  defaultValue={pergunta.texto}
                  required
                  className="w-full rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-primary dark:border-white/20"
                />
              </div>

              <div className="flex flex-1 flex-col gap-1.5 sm:min-w-[200px]">
                <label className="text-xs font-medium">Competência sugerida</label>
                <select
                  name="categoria_sugerida_id"
                  defaultValue={pergunta.categoria_sugerida_id ?? ""}
                  className="w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20"
                >
                  <option value="">Nenhuma</option>
                  {categorias.map((categoria) => (
                    <option key={categoria.id} value={categoria.id}>
                      {categoria.nome}
                    </option>
                  ))}
                </select>
              </div>
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
      <td className="px-4 py-3">{pergunta.texto}</td>
      <td className="px-4 py-3 text-zinc-500">{pergunta.cargoNome}</td>
      <td className="px-4 py-3 text-zinc-500">{pergunta.categoriaNome}</td>
      <td className="whitespace-nowrap px-4 py-3">{pergunta.ativo ? "Ativa" : "Inativa"}</td>
      <td className="px-4 py-3 text-right">
        <AcoesMenu label="Ações da pergunta" onClose={() => setConfirmandoExclusao(false)}>
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
                <form action={togglePerguntaAtiva} onSubmit={fechar}>
                  <input type="hidden" name="id" value={pergunta.id} />
                  <input type="hidden" name="ativo" value={String(pergunta.ativo)} />
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-primary/10"
                  >
                    <Power className="h-4 w-4" />
                    {pergunta.ativo ? "Desativar" : "Ativar"}
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
                <input type="hidden" name="id" value={pergunta.id} />
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
