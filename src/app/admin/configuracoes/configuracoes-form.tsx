"use client";

import { useActionState } from "react";
import { Save } from "lucide-react";
import { updateConfiguracoes } from "@/lib/actions/configuracoes";

type Config = {
  imagem_login_url: string | null;
  logo_usina_url: string | null;
  email_remetente: string | null;
  nome_remetente: string | null;
  validade_link_horas: number;
};

export function ConfiguracoesForm({ config }: { config: Config }) {
  const [state, action, pending] = useActionState(updateConfiguracoes, undefined);

  return (
    <form action={action} className="flex max-w-lg flex-col gap-5">
      <div className="flex flex-col gap-1">
        <label htmlFor="logo_usina" className="text-sm font-medium">
          Logo da usina
        </label>
        {config.logo_usina_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={config.logo_usina_url}
            alt="Logo atual da usina"
            className="h-20 w-20 rounded-md border border-primary-border object-contain"
          />
        )}
        <input id="logo_usina" name="logo_usina" type="file" accept="image/*" className="text-sm" />
        <p className="text-xs text-zinc-500">Aparece no menu do painel admin e na tela de login.</p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="imagem_login" className="text-sm font-medium">
          Imagem da tela de login
        </label>
        {config.imagem_login_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={config.imagem_login_url}
            alt="Imagem atual do login"
            className="h-20 w-20 rounded-md border border-primary-border object-contain"
          />
        )}
        <input
          id="imagem_login"
          name="imagem_login"
          type="file"
          accept="image/*"
          className="text-sm"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="nome_remetente" className="text-sm font-medium">
          Nome do remetente dos e-mails
        </label>
        <input
          id="nome_remetente"
          name="nome_remetente"
          defaultValue={config.nome_remetente ?? ""}
          placeholder="Trilha 30-60-90"
          className="rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-primary dark:border-white/20"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="email_remetente" className="text-sm font-medium">
          E-mail remetente
        </label>
        <input
          id="email_remetente"
          name="email_remetente"
          type="email"
          defaultValue={config.email_remetente ?? ""}
          placeholder="avaliacoes@empresa.com.br"
          className="rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-primary dark:border-white/20"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="validade_link_dias" className="text-sm font-medium">
          Validade do link de avaliação (dias)
        </label>
        <input
          id="validade_link_dias"
          name="validade_link_dias"
          type="number"
          min={1}
          step={1}
          defaultValue={Math.round(config.validade_link_horas / 24)}
          className="w-32 rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-primary dark:border-white/20"
        />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.success && <p className="text-sm text-primary">Configurações salvas.</p>}

      <button
        type="submit"
        disabled={pending}
        className="flex w-fit items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
      >
        <Save className="h-4 w-4" />
        {pending ? "Salvando..." : "Salvar configurações"}
      </button>
    </form>
  );
}
