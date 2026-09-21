"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { enviarAvaliacaoAgora } from "@/lib/actions/avaliacoes";

export function EnviarAgoraButton({
  colaboradorId,
  marco,
}: {
  colaboradorId: string;
  marco: number;
}) {
  const [state, action, pending] = useActionState(enviarAvaliacaoAgora, undefined);

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="colaborador_id" value={colaboradorId} />
      <input type="hidden" name="marco" value={marco} />
      <button
        type="submit"
        disabled={pending}
        className="flex items-center gap-1.5 rounded-md border border-primary-border px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary-soft disabled:opacity-60"
      >
        <Send className="h-3 w-3" />
        {pending ? "Enviando..." : "Forçar envio do e-mail"}
      </button>
      {state?.success && (
        <p className="text-xs text-primary">Enviado para {state.enviadoPara}.</p>
      )}
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
