"use client";

import { useActionState } from "react";
import { UserPlus } from "lucide-react";
import { criarUsuario } from "@/lib/actions/usuarios";

export function UsuarioForm() {
  const [state, action, pending] = useActionState(criarUsuario, undefined);

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
        <label htmlFor="email" className="text-sm font-medium">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-primary dark:border-white/20"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="senha" className="text-sm font-medium">
          Senha provisória
        </label>
        <input
          id="senha"
          name="senha"
          type="password"
          required
          minLength={8}
          className="rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-primary dark:border-white/20"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="papel" className="text-sm font-medium">
          Papel
        </label>
        <select
          id="papel"
          name="papel"
          className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20"
        >
          <option value="analista">Analista</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
      >
        <UserPlus className="h-4 w-4" />
        {pending ? "Criando..." : "Criar usuário"}
      </button>

      {state?.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
