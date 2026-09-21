"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/lib/actions/auth";

export default function EsqueciSenhaPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);
  const sent = state !== undefined && !state.error;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-primary-soft p-6 dark:bg-background">
      <h1 className="text-xl font-semibold">Recuperar senha</h1>

      {sent ? (
        <p className="max-w-sm text-center text-sm text-zinc-600 dark:text-zinc-400">
          Se o e-mail existir na base, enviamos um link de redefinição de senha.
        </p>
      ) : (
        <form action={action} className="flex w-full max-w-sm flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm font-medium">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-primary dark:border-white/20"
            />
          </div>

          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
          >
            {pending ? "Enviando..." : "Enviar link de recuperação"}
          </button>
        </form>
      )}

      <Link href="/login" className="text-sm text-primary underline underline-offset-2">
        Voltar para o login
      </Link>
    </div>
  );
}
