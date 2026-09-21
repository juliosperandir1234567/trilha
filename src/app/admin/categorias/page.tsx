import { createClient } from "@/lib/supabase/server";
import { toggleCategoriaAtiva } from "@/lib/actions/categorias";
import { CategoriaForm } from "./categoria-form";

export default async function CategoriasPage() {
  const supabase = await createClient();
  const { data: categorias } = await supabase
    .from("categorias_treinamento")
    .select("id, nome, descricao, ativo")
    .order("nome");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Categorias de treinamento</h1>

      <CategoriaForm />

      <table className="w-full max-w-2xl text-left text-sm">
        <thead>
          <tr className="border-b-2 border-primary-border text-primary">
            <th className="py-2">Nome</th>
            <th className="py-2">Descrição</th>
            <th className="py-2">Status</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {(categorias ?? []).map((categoria) => (
            <tr key={categoria.id} className="border-b border-primary-border/40">
              <td className="py-2">{categoria.nome}</td>
              <td className="py-2 text-zinc-500">{categoria.descricao}</td>
              <td className="py-2">{categoria.ativo ? "Ativa" : "Inativa"}</td>
              <td className="py-2 text-right">
                <form action={toggleCategoriaAtiva}>
                  <input type="hidden" name="id" value={categoria.id} />
                  <input type="hidden" name="ativo" value={String(categoria.ativo)} />
                  <button type="submit" className="text-sm text-primary underline underline-offset-2">
                    {categoria.ativo ? "Desativar" : "Ativar"}
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {(categorias ?? []).length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 text-center text-zinc-500">
                Nenhuma categoria cadastrada.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
