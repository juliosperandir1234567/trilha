"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";
import { createPergunta } from "@/lib/actions/perguntas";

type Categoria = { id: string; nome: string };
type Cargo = { id: string; nome: string; marcos: number[] };

const TODOS_OS_MARCOS = [30, 60, 90, 120, 180, 270] as const;

export function PerguntaForm({
  categorias,
  cargos,
}: {
  categorias: Categoria[];
  cargos: Cargo[];
}) {
  const [state, action, pending] = useActionState(createPergunta, undefined);
  const [cargoSelecionado, setCargoSelecionado] = useState("");

  const cargoAtual = cargos.find((cargo) => cargo.id === cargoSelecionado);
  // Sem cargo escolhido ("Todos os cargos"), a pergunta pode valer pra
  // qualquer marco. Com um cargo escolhido, só mostra os marcos que esse
  // cargo de fato usa (configurados na tela de Cargos).
  const marcosDisponiveis = cargoAtual ? cargoAtual.marcos : [...TODOS_OS_MARCOS];
  const [marcoSelecionado, setMarcoSelecionado] = useState<number>(30);
  const marcoValido = marcosDisponiveis.includes(marcoSelecionado)
    ? marcoSelecionado
    : marcosDisponiveis[0];

  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-lg border border-primary-border p-4 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <div className="flex flex-col gap-1.5 sm:min-w-[160px]">
        <label htmlFor="cargo_id" className="text-sm font-medium">
          Cargo
        </label>
        <select
          id="cargo_id"
          name="cargo_id"
          value={cargoSelecionado}
          onChange={(e) => setCargoSelecionado(e.target.value)}
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
        <label htmlFor="marco" className="text-sm font-medium">
          Marco
        </label>
        <select
          id="marco"
          name="marco"
          value={marcoValido}
          onChange={(e) => setMarcoSelecionado(Number(e.target.value))}
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
        <label htmlFor="texto" className="text-sm font-medium">
          Pergunta
        </label>
        <input
          id="texto"
          name="texto"
          required
          className="w-full rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-primary dark:border-white/20"
        />
      </div>

      <div className="flex flex-1 flex-col gap-1.5 sm:min-w-[200px]">
        <label htmlFor="categoria_sugerida_id" className="text-sm font-medium">
          Competência sugerida (nota baixa)
        </label>
        <select
          id="categoria_sugerida_id"
          name="categoria_sugerida_id"
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
