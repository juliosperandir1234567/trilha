"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createCategoria } from "@/lib/actions/categorias";

export function CategoriaForm() {
  const [state, action, pending] = useActionState(createCategoria, undefined);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="nome" className="text-sm font-medium">
          Nome
        </label>
        <input
          id="nome"
          name="nome"
          required
          className="rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-primary dark:border-white/20"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="descricao" className="text-sm font-medium">
          Descrição
        </label>
        <input
          id="descricao"
          name="descricao"
          className="w-64 rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-primary dark:border-white/20"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
      >
        <Plus className="h-4 w-4" />
        {pending ? "Adicionando..." : "Adicionar"}
      </button>
      {state?.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
