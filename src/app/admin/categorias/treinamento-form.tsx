"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createTreinamento } from "@/lib/actions/treinamentos";

type Categoria = { id: string; nome: string };
type Cargo = { id: string; nome: string };

export function TreinamentoForm({ categorias, cargos }: { categorias: Categoria[]; cargos: Cargo[] }) {
  const [state, action, pending] = useActionState(createTreinamento, undefined);

  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-lg border border-primary-border p-4 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <div className="flex flex-1 flex-col gap-1.5 sm:min-w-[220px]">
        <label htmlFor="categoria_id" className="text-sm font-medium">
          Competência
        </label>
        <select
          id="categoria_id"
          name="categoria_id"
          required
          className="w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20"
        >
          <option value="">Selecione...</option>
          {categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-[2] flex-col gap-1.5 sm:min-w-[240px]">
        <label htmlFor="nome_treinamento" className="text-sm font-medium">
          Nome do treinamento
        </label>
        <input
          id="nome_treinamento"
          name="nome"
          required
          className="w-full rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-primary dark:border-white/20"
        />
      </div>

      {/* Atalho de cadastro: cada cargo marcado vira um treinamento separado
          (mesmo nome e descrição), que depois se edita sozinho. */}
      <fieldset className="flex w-full flex-col gap-1.5">
        <legend className="text-sm font-medium">Cargos</legend>
        <p className="text-xs text-zinc-500">
          Cada cargo marcado ganha o seu próprio treinamento. Nenhum marcado = vale pra todos os cargos.
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
          {cargos.map((cargo) => (
            <label key={cargo.id} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" name="cargo_ids" value={cargo.id} className="h-4 w-4 accent-primary" />
              {cargo.nome}
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
      >
        <Plus className="h-4 w-4" />
        {pending ? "Adicionando..." : "Adicionar treinamento"}
      </button>
      {state?.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="w-full text-sm text-primary">{state.success}</p>}
    </form>
  );
}
