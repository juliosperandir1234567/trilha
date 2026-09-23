import { createClient } from "@/lib/supabase/server";
import { getUsuarioAtual } from "@/lib/supabase/dal";
import { CategoriaForm } from "./categoria-form";
import { TreinamentoForm } from "./treinamento-form";
import { CategoriaCard } from "./categoria-card";
import { TreinamentoRow } from "./treinamento-row";

export default async function CategoriasPage() {
  const { perfil } = await getUsuarioAtual();
  const supabase = await createClient();
  const [{ data: categorias }, { data: treinamentos }, { data: cargos }] = await Promise.all([
    supabase
      .from("categorias_treinamento")
      .select("id, nome, descricao, ativo, cargo_id, cargos(nome)")
      .order("nome"),
    supabase
      .from("treinamentos")
      .select("id, categoria_id, nome, descricao, ativo")
      .order("nome"),
    supabase.from("cargos").select("id, nome").eq("ativo", true).order("nome"),
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

  const podeExcluir = perfil?.papel === "admin";
  const categoriasAtivas = (categorias ?? []).filter((c) => c.ativo);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Competências</h1>

      <div className="flex flex-col gap-2">
        <h2 className="font-medium">Criar competência</h2>
        <CategoriaForm cargos={cargos ?? []} />
      </div>

      <hr className="border-primary-border" />

      <div className="flex flex-col gap-2">
        <h2 className="font-medium">Criar treinamento dentro de uma competência</h2>
        <TreinamentoForm categorias={categoriasAtivas} />
      </div>

      <hr className="border-primary-border" />

      <div className="flex flex-col gap-4">
        {(categorias ?? []).map((categoria) => {
          const lista = treinamentosPorCategoria.get(categoria.id) ?? [];

          return (
            <CategoriaCard
              key={categoria.id}
              categoria={categoria}
              cargos={cargos ?? []}
              podeExcluir={podeExcluir}
            >
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
                        <TreinamentoRow
                          key={treinamento.id}
                          treinamento={treinamento}
                          categorias={categoriasAtivas}
                          podeExcluir={podeExcluir}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="px-4 py-3 text-sm text-zinc-500">
                  Nenhum treinamento cadastrado nesta competência ainda.
                </p>
              )}
            </CategoriaCard>
          );
        })}
        {(categorias ?? []).length === 0 && (
          <p className="text-sm text-zinc-500">Nenhuma competência cadastrada.</p>
        )}
      </div>
    </div>
  );
}
