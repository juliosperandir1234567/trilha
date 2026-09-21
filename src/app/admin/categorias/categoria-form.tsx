"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createCategoria } from "@/lib/actions/categorias";

export function CategoriaForm() {
  const [state, action, pending] = useActionState(createCategoria, undefined);

  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-lg border border-primary-border p-4 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <div className="flex flex-1 flex-col gap-1.5 sm:min-w-[200px]">
        <label htmlFor="nome" className="text-sm font-medium">
          Nome
        </label>
        <input
          id="nome"
          name="nome"
          required
          className="w-full rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-primary dark:border-white/20"
        />
      </div>
      <div className="flex flex-[2] flex-col gap-1.5 sm:min-w-[280px]">
        <label htmlFor="descricao" className="text-sm font-medium">
          Descrição
        </label>
        <input
          id="descricao"
          name="descricao"
          className="w-full rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-primary dark:border-white/20"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
      >
        <Plus className="h-4 w-4" />
        {pending ? "Adicionando..." : "Adicionar"}
      </button>
      {state?.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
