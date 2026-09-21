"use client";

import { useActionState } from "react";
import { UserPlus } from "lucide-react";
import { createColaborador } from "@/lib/actions/colaboradores";

export function ColaboradorForm() {
  const [state, action, pending] = useActionState(createColaborador, undefined);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="matricula" className="text-sm font-medium">
          Matrícula do colaborador
        </label>
        <input
          id="matricula"
          name="matricula"
          required
          className="rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-primary dark:border-white/20"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="nome" className="text-sm font-medium">
          Nome do colaborador
        </label>
        <input
          id="nome"
          name="nome"
          required
          className="rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-primary dark:border-white/20"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="data_admissao" className="text-sm font-medium">
          Data de admissão
        </label>
        <input
          id="data_admissao"
          name="data_admissao"
          type="date"
          required
          className="rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-primary dark:border-white/20"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="tipo" className="text-sm font-medium">
          Tipo
        </label>
        <select
          id="tipo"
          name="tipo"
          defaultValue="novato"
          className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20"
        >
          <option value="novato">Novato</option>
          <option value="capacitacao">Em capacitação</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="gestor_matricula" className="text-sm font-medium">
          Matrícula do gestor
        </label>
        <input
          id="gestor_matricula"
          name="gestor_matricula"
          required
          className="rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-primary dark:border-white/20"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="gestor_nome" className="text-sm font-medium">
          Nome do gestor
        </label>
        <input
          id="gestor_nome"
          name="gestor_nome"
          required
          className="rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-primary dark:border-white/20"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="gestor_email" className="text-sm font-medium">
          E-mail do gestor
        </label>
        <input
          id="gestor_email"
          name="gestor_email"
          type="email"
          required
          className="rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-primary dark:border-white/20"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
      >
        <UserPlus className="h-4 w-4" />
        {pending ? "Cadastrando..." : "Cadastrar colaborador"}
      </button>

      {state?.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
