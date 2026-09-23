import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/supabase/dal";
import { logout } from "@/lib/actions/auth";

export default async function Home() {
  const { user, perfil } = await getUsuarioAtual();

  if (perfil?.papel === "admin" || perfil?.papel === "analista") {
    redirect("/admin");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-primary-soft p-6 dark:bg-background">
      <h1 className="text-2xl font-semibold text-primary">Trilha Desenvolve+</h1>

      <p className="max-w-sm text-center text-sm text-zinc-600 dark:text-zinc-400">
        Login autenticado ({user.email}), mas ainda não existe um cadastro em
        &quot;usuarios&quot; vinculado a esta conta.
      </p>

      <form action={logout}>
        <button
          type="submit"
          className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium hover:border-primary hover:text-primary dark:border-white/20"
        >
          Sair
        </button>
      </form>
    </div>
  );
}
