"use client";

import { useActionState, useState } from "react";
import { Send, Copy, Check } from "lucide-react";
import { enviarAvaliacaoAgora } from "@/lib/actions/avaliacoes";

export function EnviarAgoraButton({
  colaboradorId,
  marco,
  rotulo = "Forçar envio do e-mail",
}: {
  colaboradorId: string;
  marco: number;
  rotulo?: string;
}) {
  const [state, action, pending] = useActionState(enviarAvaliacaoAgora, undefined);
  const [copiado, setCopiado] = useState(false);

  async function copiarLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // clipboard indisponível (ex: contexto não seguro); o link já está visível pra copiar manualmente
    }
  }

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
        {pending ? "Enviando..." : rotulo}
      </button>

      {state?.success && state.emailEnviado && (
        <p className="text-xs text-primary">Enviado para {state.enviadoPara}.</p>
      )}
      {state?.success && !state.emailEnviado && state.aviso && (
        <p className="max-w-[220px] text-right text-xs text-amber-600">{state.aviso}</p>
      )}
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}

      {state?.link && (
        <button
          type="button"
          onClick={() => copiarLink(state.link!)}
          className="flex items-center gap-1.5 rounded-md border border-primary-border px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-primary-soft dark:text-zinc-300"
        >
          {copiado ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copiado ? "Link copiado!" : "Copiar link (WhatsApp/e-mail manual)"}
        </button>
      )}
    </form>
  );
}
