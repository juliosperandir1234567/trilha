"use client";

import { useActionState, useState } from "react";
import { Power, Trash2 } from "lucide-react";
import { togglePerguntaAtiva, deletePergunta } from "@/lib/actions/perguntas";
import { AcoesMenu } from "@/components/acoes-menu";

export function PerguntaRowActions({
  id,
  ativo,
  podeExcluir,
}: {
  id: string;
  ativo: boolean;
  podeExcluir: boolean;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [state, action, pending] = useActionState(deletePergunta, undefined);

  return (
    <AcoesMenu onClose={() => setConfirmando(false)}>
      {(fechar) =>
        !confirmando ? (
          <>
            <form action={togglePerguntaAtiva} onSubmit={fechar}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="ativo" value={String(ativo)} />
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-primary/10"
              >
                <Power className="h-4 w-4" />
                {ativo ? "Desativar" : "Ativar"}
              </button>
            </form>
            {podeExcluir && (
              <button
                type="button"
                onClick={() => setConfirmando(true)}
                className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
              >
                <Trash2 className="h-4 w-4" />
                Excluir
              </button>
            )}
          </>
        ) : (
          <form action={action} className="flex flex-col gap-2 p-2">
            <input type="hidden" name="id" value={id} />
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
            {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={pending}
                className="flex-1 rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                {pending ? "Excluindo..." : "Confirmar"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmando(false)}
                className="flex-1 rounded border border-black/15 px-2 py-1 text-xs dark:border-white/20"
              >
                Cancelar
              </button>
            </div>
          </form>
        )
      }
    </AcoesMenu>
  );
}
