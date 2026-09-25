import Image from "next/image";
import { TrendingUp, LogOut } from "lucide-react";
import { requireStaff } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/lib/actions/auth";
import { AdminNav } from "./admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { perfil } = await requireStaff();
  const supabase = await createClient();
  const { data: config } = await supabase
    .from("configuracoes_sistema")
    .select("logo_usina_url")
    .eq("id", 1)
    .single();

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <aside className="flex flex-row gap-1 overflow-x-auto bg-sidebar-bg p-4 text-sidebar-fg md:w-56 md:flex-col md:overflow-visible">
        <div className="mb-4 hidden items-center gap-2 md:flex">
          {config?.logo_usina_url ? (
            <Image
              src={config.logo_usina_url}
              alt="Logo"
              width={32}
              height={32}
              className="rounded bg-white/10 object-contain"
            />
          ) : (
            <TrendingUp className="h-6 w-6 shrink-0" />
          )}
          <div>
            <p className="text-sm font-semibold">Trilha Desenvolve+</p>
            <p className="text-xs text-sidebar-fg-muted">{perfil?.nome}</p>
          </div>
        </div>
        <AdminNav />
        <form action={logout} className="mt-auto hidden md:block">
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-md border border-white/25 px-3 py-2 text-left text-sm hover:border-white hover:bg-white/10"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </form>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between bg-primary px-6 py-3 text-primary-foreground">
          <span className="flex items-center gap-2 font-semibold">
            <TrendingUp className="h-5 w-5" />
            Trilha Desenvolve+
          </span>
          <span className="text-sm opacity-90">
            {perfil?.nome} · {perfil?.papel}
          </span>
        </header>
        <main className="flex-1 p-4 sm:p-6">
          <div className="mx-auto w-full max-w-[1440px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
