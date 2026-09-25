import { Fragment } from "react";
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
    supabase.from("categorias_treinamento").select("id, nome, descricao, ativo").order("nome"),
    supabase
      .from("treinamentos")
      .select("id, categoria_id, cargo_id, nome, ativo")
      .order("nome"),
    supabase.from("cargos").select("id, nome, ativo").order("nome"),
  ]);

  type Treinamento = {
    id: string;
    categoria_id: string;
    cargo_id: string | null;
    nome: string;
    ativo: boolean;
  };

  const treinamentosPorCategoria = new Map<string, Treinamento[]>();
  for (const treinamento of treinamentos ?? []) {
    const lista = treinamentosPorCategoria.get(treinamento.categoria_id) ?? [];
    lista.push(treinamento);
    treinamentosPorCategoria.set(treinamento.categoria_id, lista);
  }

  // Dentro de cada competência os treinamentos ficam agrupados por cargo
  // (em ordem alfabética) e, por último, os que valem pra todos os cargos.
  const todosCargos = cargos ?? [];
  const cargosAtivos = todosCargos.filter((c) => c.ativo);
  function gruposPorCargo(lista: Treinamento[]) {
    const grupos = todosCargos
      .map((cargo) => ({
        chave: cargo.id,
        titulo: cargo.ativo ? cargo.nome : `${cargo.nome} (cargo inativo)`,
        itens: lista.filter((t) => t.cargo_id === cargo.id),
      }))
      .filter((g) => g.itens.length > 0);
    const gerais = lista.filter((t) => !t.cargo_id);
    if (gerais.length > 0) grupos.push({ chave: "todos", titulo: "Todos os cargos", itens: gerais });
    return grupos;
  }

  const podeExcluir = perfil?.papel === "admin";
  const categoriasAtivas = (categorias ?? []).filter((c) => c.ativo);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Competências</h1>
        <p className="text-sm text-zinc-500">
          Uma competência é sugerida automaticamente quando o gestor dá nota 1, 2 ou 3
          numa pergunta. A competência vale pra todos os cargos; os treinamentos dentro dela
          podem ser de um cargo só — o gestor só vê os treinamentos do cargo de quem está
          avaliando, mais os de &quot;Todos os cargos&quot;.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-medium">Criar competência</h2>
        <CategoriaForm />
      </div>

      <hr className="border-primary-border" />

      <div className="flex flex-col gap-2">
        <h2 className="font-medium">Criar treinamento dentro de uma competência</h2>
        <TreinamentoForm categorias={categoriasAtivas} cargos={cargosAtivos} />
      </div>

      <hr className="border-primary-border" />

      <div className="flex flex-col gap-2">
        {(categorias ?? []).map((categoria) => {
          const lista = treinamentosPorCategoria.get(categoria.id) ?? [];

          return (
            <CategoriaCard
              key={categoria.id}
              categoria={categoria}
              podeExcluir={podeExcluir}
              totalTreinamentos={lista.length}
            >
              {lista.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-primary-border text-primary">
                        <th className="px-4 py-2 text-xs font-medium">Treinamento</th>
                        <th className="whitespace-nowrap px-4 py-2 text-xs font-medium">Status</th>
                        <th className="px-4 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {gruposPorCargo(lista).map((grupo) => (
                        <Fragment key={grupo.chave}>
                          <tr className="border-b border-primary-border/40 bg-primary-soft/30">
                            <td
                              colSpan={3}
                              className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary"
                            >
                              {grupo.titulo}
                            </td>
                          </tr>
                          {grupo.itens.map((treinamento) => (
                            <TreinamentoRow
                              key={treinamento.id}
                              treinamento={treinamento}
                              categorias={categoriasAtivas}
                              cargos={todosCargos}
                              podeExcluir={podeExcluir}
                            />
                          ))}
                        </Fragment>
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
