import { createClient } from "@/lib/supabase/server";
import { getUsuarioAtual } from "@/lib/supabase/dal";
import { UsuarioForm } from "./usuario-form";

export default async function UsuariosPage() {
  const { perfil } = await getUsuarioAtual();
  const supabase = await createClient();
  const { data: usuarios } = await supabase
    .from("usuarios")
    .select("id, nome, email, papel, ativo")
    .order("nome");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Usuários</h1>

      {perfil?.papel === "admin" ? (
        <UsuarioForm />
      ) : (
        <p className="text-sm text-zinc-500">
          Apenas administradores podem criar novos usuários.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border border-primary-border">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b-2 border-primary-border bg-primary-soft/40 text-primary">
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="whitespace-nowrap px-4 py-3">Papel</th>
              <th className="whitespace-nowrap px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {(usuarios ?? []).map((usuario) => (
              <tr
                key={usuario.id}
                className="border-b border-primary-border/40 last:border-b-0 hover:bg-primary-soft/20"
              >
                <td className="px-4 py-3">{usuario.nome}</td>
                <td className="px-4 py-3 text-zinc-500">{usuario.email}</td>
                <td className="whitespace-nowrap px-4 py-3">{usuario.papel}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  {usuario.ativo ? "Ativo" : "Inativo"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
