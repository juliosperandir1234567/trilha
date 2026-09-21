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

      <table className="w-full max-w-2xl text-left text-sm">
        <thead>
          <tr className="border-b-2 border-primary-border text-primary">
            <th className="py-2">Nome</th>
            <th className="py-2">E-mail</th>
            <th className="py-2">Papel</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {(usuarios ?? []).map((usuario) => (
            <tr key={usuario.id} className="border-b border-primary-border/40">
              <td className="py-2">{usuario.nome}</td>
              <td className="py-2 text-zinc-500">{usuario.email}</td>
              <td className="py-2">{usuario.papel}</td>
              <td className="py-2">{usuario.ativo ? "Ativo" : "Inativo"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
