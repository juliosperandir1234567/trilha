"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createPergunta } from "@/lib/actions/perguntas";

type Categoria = { id: string; nome: string };
type Cargo = { id: string; nome: string };

const MARCOS = [30, 60, 90, 120, 180, 270] as const;

export function PerguntaForm({
  categorias,
  cargos,
}: {
  categorias: Categoria[];
  cargos: Cargo[];
}) {
  const [state, action, pending] = useActionState(createPergunta, undefined);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="marco" className="text-sm font-medium">
          Marco
        </label>
        <select
          id="marco"
          name="marco"
          className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20"
        >
          {MARCOS.map((marco) => (
            <option key={marco} value={marco}>
              {marco} dias
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="cargo_id" className="text-sm font-medium">
          Cargo
        </label>
        <select
          id="cargo_id"
          name="cargo_id"
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

      <div className="flex flex-col gap-1">
        <label htmlFor="texto" className="text-sm font-medium">
          Pergunta
        </label>
        <input
          id="texto"
          name="texto"
          required
          className="w-80 rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-primary dark:border-white/20"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="categoria_sugerida_id" className="text-sm font-medium">
          Competência sugerida (nota baixa)
        </label>
        <select
          id="categoria_sugerida_id"
          name="categoria_sugerida_id"
          className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20"
        >
          <option value="">Nenhuma</option>
          {categorias.map((categoria) => (
            <option key={categoria.id} value={categoria.id}>
              {categoria.nome}
            </option>
          ))}
        </select>
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
