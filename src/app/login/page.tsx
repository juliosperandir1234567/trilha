import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const supabase = await createClient();
  const { data: config } = await supabase
    .from("configuracoes_sistema")
    .select("imagem_login_url, logo_usina_url")
    .eq("id", 1)
    .single();

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-primary-soft p-6 dark:bg-background">
      {config?.imagem_login_url && (
        <>
          <Image
            src={config.imagem_login_url}
            alt=""
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-black/45" />
        </>
      )}

      <div className="relative flex w-full max-w-sm flex-col items-center gap-6 rounded-xl bg-white p-8 shadow-xl dark:bg-zinc-900">
        {config?.logo_usina_url && (
          <Image
            src={config.logo_usina_url}
            alt="Logo da usina"
            width={64}
            height={64}
            className="rounded-md object-contain"
          />
        )}
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-semibold text-primary">Trilha 30·60·90</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Sistema de avaliação de colaboradores
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
