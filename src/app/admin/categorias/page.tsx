import { createClient } from "@/lib/supabase/server";
import { toggleCategoriaAtiva } from "@/lib/actions/categorias";
import { toggleTreinamentoAtivo } from "@/lib/actions/treinamentos";
import { CategoriaForm } from "./categoria-form";
import { TreinamentoForm } from "./treinamento-form";

export default async function CategoriasPage() {
  const supabase = await createClient();
  const [{ data: categorias }, { data: treinamentos }] = await Promise.all([
    supabase.from("categorias_treinamento").select("id, nome, descricao, ativo").order("nome"),
    supabase
      .from("treinamentos")
      .select("id, categoria_id, nome, descricao, ativo")
      .order("nome"),
  ]);

  type Treinamento = {
    id: string;
    categoria_id: string;
    nome: string;
    descricao: string | null;
    ativo: boolean;
  };

  const treinamentosPorCategoria = new Map<string, Treinamento[]>();
  for (const treinamento of treinamentos ?? []) {
    const lista = treinamentosPorCategoria.get(treinamento.categoria_id) ?? [];
    lista.push(treinamento);
    treinamentosPorCategoria.set(treinamento.categoria_id, lista);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Categorias de treinamento</h1>

      <CategoriaForm />
      <TreinamentoForm categorias={(categorias ?? []).filter((c) => c.ativo)} />

      <div className="flex flex-col gap-4">
        {(categorias ?? []).map((categoria) => {
          const lista = treinamentosPorCategoria.get(categoria.id) ?? [];

          return (
            <div key={categoria.id} className="overflow-hidden rounded-lg border border-primary-border">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary-border bg-primary-soft/40 px-4 py-3">
                <div>
                  <p className="font-medium">{categoria.nome}</p>
                  {categoria.descricao && (
                    <p className="text-sm text-zinc-500">{categoria.descricao}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-zinc-500">
                    {categoria.ativo ? "Ativa" : "Inativa"}
                  </span>
                  <form action={toggleCategoriaAtiva}>
                    <input type="hidden" name="id" value={categoria.id} />
                    <input type="hidden" name="ativo" value={String(categoria.ativo)} />
                    <button type="submit" className="text-sm text-primary underline underline-offset-2">
                      {categoria.ativo ? "Desativar" : "Ativar"}
                    </button>
                  </form>
                </div>
              </div>

              {lista.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-primary-border text-primary">
                        <th className="px-4 py-2 text-xs font-medium">Treinamento</th>
                        <th className="px-4 py-2 text-xs font-medium">Descrição</th>
                        <th className="whitespace-nowrap px-4 py-2 text-xs font-medium">Status</th>
                        <th className="px-4 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {lista.map((treinamento) => (
                        <tr
                          key={treinamento.id}
                          className="border-b border-primary-border/40 align-top last:border-b-0 hover:bg-primary-soft/20"
                        >
                          <td className="px-4 py-3">{treinamento.nome}</td>
                          <td className="px-4 py-3 text-zinc-500">{treinamento.descricao}</td>
                          <td className="whitespace-nowrap px-4 py-3">
                            {treinamento.ativo ? "Ativo" : "Inativo"}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <form action={toggleTreinamentoAtivo}>
                              <input type="hidden" name="id" value={treinamento.id} />
                              <input type="hidden" name="ativo" value={String(treinamento.ativo)} />
                              <button
                                type="submit"
                                className="text-sm text-primary underline underline-offset-2"
                              >
                                {treinamento.ativo ? "Desativar" : "Ativar"}
                              </button>
                            </form>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="px-4 py-3 text-sm text-zinc-500">
                  Nenhum treinamento cadastrado nesta categoria ainda.
                </p>
              )}
            </div>
          );
        })}
        {(categorias ?? []).length === 0 && (
          <p className="text-sm text-zinc-500">Nenhuma categoria cadastrada.</p>
        )}
      </div>
    </div>
  );
}
