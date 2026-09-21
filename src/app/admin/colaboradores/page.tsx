import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ColaboradorForm } from "./colaborador-form";
import { ImportForm } from "./import-form";

export default async function ColaboradoresPage() {
  const supabase = await createClient();
  const [{ data: colaboradores }, { data: notasCriticas }] = await Promise.all([
    supabase
      .from("colaboradores")
      .select("id, nome, matricula, data_admissao, tipo, gestor_nome, gestor_email, ativo")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("respostas").select("avaliacoes!inner(colaborador_id)").eq("nota", 1),
  ]);

  const colaboradoresComNotaCritica = new Set(
    (notasCriticas ?? []).map(
      (r) => (r.avaliacoes as unknown as { colaborador_id: string }).colaborador_id
    )
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Colaboradores</h1>

      <div className="flex flex-col gap-2">
        <h2 className="font-medium">Cadastrar individualmente</h2>
        <ColaboradorForm />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-medium">Importar planilha</h2>
        <ImportForm />
      </div>

      <table className="w-full max-w-3xl text-left text-sm">
        <thead>
          <tr className="border-b-2 border-primary-border text-primary">
            <th className="py-2">Matrícula</th>
            <th className="py-2">Nome</th>
            <th className="py-2">Tipo</th>
            <th className="py-2">Admissão</th>
            <th className="py-2">Gestor</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {(colaboradores ?? []).map((colaborador) => (
            <tr key={colaborador.id} className="border-b border-primary-border/40">
              <td className="py-2 text-zinc-500">{colaborador.matricula}</td>
              <td className="py-2">
                <Link
                  href={`/admin/colaboradores/${colaborador.id}`}
                  className="inline-flex items-center gap-1 text-primary underline underline-offset-2"
                >
                  {colaborador.nome}
                </Link>
                {colaboradoresComNotaCritica.has(colaborador.id) && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-400">
                    <AlertTriangle className="h-3 w-3" />
                    Atenção
                  </span>
                )}
              </td>
              <td className="py-2 text-zinc-500">
                {colaborador.tipo === "capacitacao" ? "Em capacitação" : "Novato"}
              </td>
              <td className="py-2">
                {new Date(colaborador.data_admissao + "T00:00:00").toLocaleDateString("pt-BR")}
              </td>
              <td className="py-2 text-zinc-500">
                {colaborador.gestor_nome} ({colaborador.gestor_email})
              </td>
              <td className="py-2">{colaborador.ativo ? "Ativo" : "Inativo"}</td>
            </tr>
          ))}
          {(colaboradores ?? []).length === 0 && (
            <tr>
              <td colSpan={6} className="py-4 text-center text-zinc-500">
                Nenhum colaborador importado ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
