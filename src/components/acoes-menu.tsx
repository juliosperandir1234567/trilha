"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";

/**
 * Menu de ações (⋮) que abre num portal fixado por coordenadas, em vez de
 * um <div absolute> dentro do fluxo normal. Várias tabelas do admin ficam
 * dentro de um wrapper com overflow-x-auto (pra rolar em telas estreitas),
 * e isso corta qualquer conteúdo que vaze verticalmente pra fora dele —
 * inclusive um menu absolute, escondendo os últimos itens (ex: "Excluir").
 * O portal escapa desse corte.
 */
export function AcoesMenu({
  label = "Ações",
  onClose,
  children,
}: {
  label?: string;
  /** Chamado toda vez que o menu fecha, por qualquer motivo (clique fora,
   *  scroll, resize, ou fechar() chamado de dentro do conteúdo) — útil pra
   *  resetar estado local do consumidor (ex: um passo de confirmação). */
  onClose?: () => void;
  children: (fechar: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  function abrir() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen(true);
  }

  function fechar() {
    setOpen(false);
    onClose?.();
  }

  useEffect(() => {
    if (!open) return;
    function fecharAoRolarOuRedimensionar() {
      fechar();
    }
    window.addEventListener("scroll", fecharAoRolarOuRedimensionar, true);
    window.addEventListener("resize", fecharAoRolarOuRedimensionar);
    return () => {
      window.removeEventListener("scroll", fecharAoRolarOuRedimensionar, true);
      window.removeEventListener("resize", fecharAoRolarOuRedimensionar);
    };
  }, [open]);

  return (
    <div className="relative inline-block text-left">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? fechar() : abrir())}
        className="rounded p-1.5 hover:bg-primary/10"
        aria-label={label}
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open &&
        pos &&
        createPortal(
          <>
            <button
              type="button"
              aria-label="Fechar menu"
              onClick={fechar}
              className="fixed inset-0 z-40 cursor-default"
            />
            <div
              style={{ top: pos.top, right: pos.right }}
              className="fixed z-50 w-64 rounded-md border border-black/10 bg-white p-1 text-left shadow-lg dark:border-white/10 dark:bg-zinc-900"
            >
              {children(fechar)}
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
