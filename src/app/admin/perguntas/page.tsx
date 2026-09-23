import { createClient } from "@/lib/supabase/server";
import { getUsuarioAtual } from "@/lib/supabase/dal";
import { PerguntaForm } from "./pergunta-form";
import { PerguntaRowActions } from "./pergunta-row-actions";

const MARCOS = [30, 60, 90, 120, 180, 270] as const;

export default async function PerguntasPage() {
  const { perfil } = await getUsuarioAtual();
  const supabase = await createClient();

  const [{ data: perguntas }, { data: categorias }, { data: cargos }] = await Promise.all([
    supabase
      .from("perguntas")
      .select("id, marco, texto, ativo, categorias_treinamento(nome), cargos(nome)")
      .order("marco")
      .order("ordem"),
    supabase
      .from("categorias_treinamento")
      .select("id, nome, cargo_id")
      .eq("ativo", true)
      .order("nome"),
    supabase.from("cargos").select("id, nome").eq("ativo", true).order("nome"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Perguntas por marco</h1>
      <PerguntaForm categorias={categorias ?? []} cargos={cargos ?? []} />

      {MARCOS.map((marco) => (
        <div key={marco} className="flex flex-col gap-2">
          <h2 className="font-medium">{marco} dias</h2>
          <div className="overflow-x-auto rounded-lg border border-primary-border">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead>
                <tr className="border-b-2 border-primary-border bg-primary-soft/40 text-primary">
                  <th className="px-4 py-3">Pergunta</th>
                  <th className="px-4 py-3">Cargo</th>
                  <th className="px-4 py-3">Competência sugerida</th>
                  <th className="whitespace-nowrap px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {(perguntas ?? [])
                  .filter((pergunta) => pergunta.marco === marco)
                  .map((pergunta) => (
                    <tr
                      key={pergunta.id}
                      className="border-b border-primary-border/40 last:border-b-0 hover:bg-primary-soft/20"
                    >
                      <td className="px-4 py-3">{pergunta.texto}</td>
                      <td className="px-4 py-3 text-zinc-500">
                        {(pergunta.cargos as unknown as { nome: string } | null)?.nome ??
                          "Todos"}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        {(pergunta.categorias_treinamento as unknown as { nome: string } | null)
                          ?.nome ?? "-"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {pergunta.ativo ? "Ativa" : "Inativa"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <PerguntaRowActions
                          id={pergunta.id}
                          ativo={pergunta.ativo}
                          podeExcluir={perfil?.papel === "admin"}
                        />
                      </td>
                    </tr>
                  ))}
                {(perguntas ?? []).filter((pergunta) => pergunta.marco === marco).length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-4 text-center text-zinc-500">
                      Nenhuma pergunta cadastrada para este marco.
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
