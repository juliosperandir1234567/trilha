import { createClient } from "@/lib/supabase/server";
import { getUsuarioAtual } from "@/lib/supabase/dal";
import { CargoForm } from "./cargo-form";
import { CargoRow } from "./cargo-row";

export default async function CargosPage() {
  const { perfil } = await getUsuarioAtual();
  const supabase = await createClient();
  const { data: cargos } = await supabase
    .from("cargos")
    .select("id, nome, descricao, ativo, marcos")
    .order("nome");

  const podeExcluir = perfil?.papel === "admin";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Cargos</h1>
        <p className="text-sm text-zinc-500">
          Use cargos para ter perguntas específicas por função (ex: Tratorista, Operador,
          Gestor). Uma pergunta sem cargo definido continua valendo para todo mundo. Cada
          cargo também define em quais períodos os colaboradores com esse cargo são
          avaliados — nem todo cargo precisa passar pelos 6 períodos.
        </p>
      </div>

      <CargoForm />

      <div className="overflow-x-auto rounded-lg border border-primary-border">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b-2 border-primary-border bg-primary-soft/40 text-primary">
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3">Períodos</th>
              <th className="whitespace-nowrap px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {(cargos ?? []).map((cargo) => (
              <CargoRow key={cargo.id} cargo={cargo} podeExcluir={podeExcluir} />
            ))}
            {(cargos ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                  Nenhum cargo cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
