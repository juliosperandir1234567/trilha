"use client";

import { useActionState, useState } from "react";
import { Send, Copy, Check, RotateCcw } from "lucide-react";
import { enviarAvaliacaoAgora } from "@/lib/actions/avaliacoes";

export function EnviarAgoraButton({
  colaboradorId,
  marco,
  rotulo = "Forçar envio do e-mail",
  reabrir = false,
}: {
  colaboradorId: string;
  marco: number;
  rotulo?: string;
  // Avaliação já respondida: pede confirmação e devolve pro gestor com as
  // respostas preenchidas (ver função enviar-avaliacao-agora).
  reabrir?: boolean;
}) {
  const [state, action, pending] = useActionState(enviarAvaliacaoAgora, undefined);
  const [copiado, setCopiado] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  async function copiarLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // clipboard indisponível (ex: contexto não seguro); o link já está visível pra copiar manualmente
    }
  }

  const Icone = reabrir ? RotateCcw : Send;

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="colaborador_id" value={colaboradorId} />
      <input type="hidden" name="marco" value={marco} />
      {reabrir && <input type="hidden" name="reabrir" value="1" />}

      {reabrir && !confirmando && !state?.success ? (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="flex items-center gap-1.5 rounded-md border border-primary-border px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary-soft"
        >
          <Icone className="h-3 w-3" />
          {rotulo}
        </button>
      ) : reabrir && confirmando && !state?.success ? (
        <div className="flex max-w-[260px] flex-col items-end gap-1.5 rounded-md border border-amber-300 bg-amber-50 p-2 text-right text-xs text-amber-800">
          <p>
            A avaliação volta pro gestor com as notas atuais preenchidas e sai um link novo por e-mail.
            Até ele enviar de novo, ela sai das Respondidas.
          </p>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              disabled={pending}
              className="rounded border border-black/15 bg-white px-2 py-0.5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded bg-primary px-2 py-0.5 font-medium text-primary-foreground disabled:opacity-60"
            >
              {pending ? "Reabrindo..." : "Confirmar"}
            </button>
          </div>
        </div>
      ) : (
        !reabrir && (
          <button
            type="submit"
            disabled={pending}
            className="flex items-center gap-1.5 rounded-md border border-primary-border px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary-soft disabled:opacity-60"
          >
            <Icone className="h-3 w-3" />
            {pending ? "Enviando..." : rotulo}
          </button>
        )
      )}

      {state?.success && state.emailEnviado && (
        <p className="text-xs text-primary">
          {reabrir ? "Reaberta e enviada" : "Enviado"} para {state.enviadoPara}.
        </p>
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
