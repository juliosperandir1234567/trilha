import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioAtual } from "@/lib/supabase/dal";
import { PerguntaForm } from "./pergunta-form";
import { PerguntaRow } from "./pergunta-row";

const MARCOS = [30, 60, 90, 120, 180, 270] as const;

export default async function PerguntasPage({
  searchParams,
}: {
  searchParams: Promise<{ cargo?: string }>;
}) {
  const { cargo: cargoFiltro } = await searchParams;
  const { perfil } = await getUsuarioAtual();
  const supabase = await createClient();

  const [{ data: perguntas }, { data: categorias }, { data: cargos }] = await Promise.all([
    supabase
      .from("perguntas")
      .select(
        "id, marco, texto, ativo, cargo_id, categoria_sugerida_id, categorias_treinamento(nome), cargos(nome)"
      )
      .order("marco")
      .order("ordem"),
    supabase.from("categorias_treinamento").select("id, nome").eq("ativo", true).order("nome"),
    supabase.from("cargos").select("id, nome, marcos").eq("ativo", true).order("nome"),
  ]);

  const perguntasFormatadas = (perguntas ?? []).map((pergunta) => ({
    id: pergunta.id,
    marco: pergunta.marco,
    texto: pergunta.texto,
    ativo: pergunta.ativo,
    cargo_id: pergunta.cargo_id,
    categoria_sugerida_id: pergunta.categoria_sugerida_id,
    cargoNome: (pergunta.cargos as unknown as { nome: string } | null)?.nome ?? "Todos",
    categoriaNome:
      (pergunta.categorias_treinamento as unknown as { nome: string } | null)?.nome ?? "-",
  }));

  const perguntasFiltradas = cargoFiltro
    ? perguntasFormatadas.filter((pergunta) => pergunta.cargo_id === cargoFiltro)
    : perguntasFormatadas;

  // Com um cargo filtrado, só mostra os marcos que aquele cargo de fato usa —
  // sem cargo escolhido, mostra todos, já que perguntas gerais valem pra
  // qualquer marco.
  const cargoSelecionado = (cargos ?? []).find((cargo) => cargo.id === cargoFiltro);
  const marcosParaExibir: number[] = cargoSelecionado ? cargoSelecionado.marcos : [...MARCOS];

  const FILTRO_CARGOS = [
    { label: "Todos os cargos", valor: "" },
    ...(cargos ?? []).map((cargo) => ({ label: cargo.nome, valor: cargo.id })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Perguntas por período</h1>
        <p className="text-sm text-zinc-500">
          Escolha um cargo pra deixar a pergunta específica dele (o campo Período se ajusta
          aos períodos daquele cargo) ou deixe em &quot;Todos os cargos&quot; pra uma
          pergunta geral. As seções abaixo mostram as perguntas cadastradas, agrupadas por
          período.
        </p>
      </div>
      <PerguntaForm categorias={categorias ?? []} cargos={cargos ?? []} />

      <div className="flex flex-wrap gap-2">
        {FILTRO_CARGOS.map((opcao) => {
          const ativo = (cargoFiltro ?? "") === opcao.valor;
          return (
            <Link
              key={opcao.label}
              href={opcao.valor ? `/admin/perguntas?cargo=${opcao.valor}` : "/admin/perguntas"}
              className={`rounded-full px-3 py-1 text-sm ${
                ativo
                  ? "bg-primary text-primary-foreground"
                  : "border border-primary-border text-primary hover:bg-primary-soft"
              }`}
            >
              {opcao.label}
            </Link>
          );
        })}
      </div>

      {marcosParaExibir.map((marco) => (
        <div key={marco} className="flex flex-col gap-2">
          <h2 className="font-medium">{marco} dias</h2>
          <div className="overflow-x-auto rounded-lg border border-primary-border">
            <table className="w-full min-w-[700px] table-fixed text-left text-sm">
              <thead>
                <tr className="border-b-2 border-primary-border bg-primary-soft/40 text-primary">
                  <th className="w-2/5 px-4 py-3">Pergunta</th>
                  <th className="w-[15%] px-4 py-3">Cargo</th>
                  <th className="w-1/5 px-4 py-3">Competência sugerida</th>
                  <th className="w-20 whitespace-nowrap px-4 py-3">Status</th>
                  <th className="w-12 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {perguntasFiltradas
                  .filter((pergunta) => pergunta.marco === marco)
                  .map((pergunta) => (
                    <PerguntaRow
                      key={pergunta.id}
                      pergunta={pergunta}
                      categorias={categorias ?? []}
                      cargos={cargos ?? []}
                      podeExcluir={perfil?.papel === "admin"}
                    />
                  ))}
                {perguntasFiltradas.filter((pergunta) => pergunta.marco === marco).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-4 text-center text-zinc-500">
                      Nenhuma pergunta cadastrada para este período ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
