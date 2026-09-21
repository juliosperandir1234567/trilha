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

      <div className="overflow-x-auto rounded-lg border border-primary-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b-2 border-primary-border bg-primary-soft/40 text-primary">
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Descrição</th>
              <th className="whitespace-nowrap px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {(categorias ?? []).map((categoria) => (
              <tr
                key={categoria.id}
                className="border-b border-primary-border/40 align-top last:border-b-0 hover:bg-primary-soft/20"
              >
                <td className="px-4 py-3 font-medium">{categoria.nome}</td>
                <td className="px-4 py-3 text-zinc-500">{categoria.descricao}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  {categoria.ativo ? "Ativa" : "Inativa"}
                </td>
                <td className="px-4 py-3 text-right">
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
                <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                  Nenhuma categoria cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
