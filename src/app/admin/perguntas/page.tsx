import { createClient } from "@/lib/supabase/server";
import { getUsuarioAtual } from "@/lib/supabase/dal";
import { PerguntaForm } from "./pergunta-form";
import { PerguntaRowActions } from "./pergunta-row-actions";

const MARCOS = [30, 60, 90] as const;

export default async function PerguntasPage() {
  const { perfil } = await getUsuarioAtual();
  const supabase = await createClient();

  const [{ data: perguntas }, { data: categorias }] = await Promise.all([
    supabase
      .from("perguntas")
      .select("id, marco, texto, ativo, categorias_treinamento(nome)")
      .order("marco")
      .order("ordem"),
    supabase.from("categorias_treinamento").select("id, nome").eq("ativo", true).order("nome"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Perguntas por marco</h1>
      <PerguntaForm categorias={categorias ?? []} />

      {MARCOS.map((marco) => (
        <div key={marco} className="flex flex-col gap-2">
          <h2 className="font-medium">{marco} dias</h2>
          <table className="w-full max-w-3xl text-left text-sm">
            <thead>
              <tr className="border-b-2 border-primary-border text-primary">
                <th className="py-2">Pergunta</th>
                <th className="py-2">Categoria sugerida</th>
                <th className="py-2">Status</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {(perguntas ?? [])
                .filter((pergunta) => pergunta.marco === marco)
                .map((pergunta) => (
                  <tr key={pergunta.id} className="border-b border-primary-border/40">
                    <td className="py-2">{pergunta.texto}</td>
                    <td className="py-2 text-zinc-500">
                      {(pergunta.categorias_treinamento as unknown as { nome: string } | null)
                        ?.nome ?? "-"}
                    </td>
                    <td className="py-2">{pergunta.ativo ? "Ativa" : "Inativa"}</td>
                    <td className="py-2 text-right">
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
                  <td colSpan={4} className="py-3 text-center text-zinc-500">
                    Nenhuma pergunta cadastrada para este marco.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
