import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ColaboradorForm } from "./colaborador-form";
import { ImportForm } from "./import-form";
import { EnviarAgoraButton } from "./[id]/enviar-agora-button";

const MARCOS = [30, 60, 90, 120, 180, 270] as const;

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  enviada: "Aguardando resposta",
  expirada: "Expirada",
};

export default async function ColaboradoresPage() {
  const supabase = await createClient();
  const [{ data: colaboradores }, { data: notasCriticas }, { data: avaliacoes }, { data: cargos }] =
    await Promise.all([
      supabase
        .from("colaboradores")
        .select(
          "id, nome, matricula, data_admissao, tipo, cargos(nome), gestor_nome, gestor_email, ativo"
        )
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("respostas").select("avaliacoes!inner(colaborador_id)").eq("nota", 1),
      supabase.from("avaliacoes").select("colaborador_id, marco, status"),
      supabase.from("cargos").select("id, nome").eq("ativo", true).order("nome"),
    ]);

  const colaboradoresComNotaCritica = new Set(
    (notasCriticas ?? []).map(
      (r) => (r.avaliacoes as unknown as { colaborador_id: string }).colaborador_id
    )
  );

  const avaliacoesPorColaborador = new Map<string, Map<number, string>>();
  for (const avaliacao of avaliacoes ?? []) {
    if (!avaliacoesPorColaborador.has(avaliacao.colaborador_id)) {
      avaliacoesPorColaborador.set(avaliacao.colaborador_id, new Map());
    }
    avaliacoesPorColaborador.get(avaliacao.colaborador_id)!.set(avaliacao.marco, avaliacao.status);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Colaboradores</h1>

      <div className="flex flex-col gap-2">
        <h2 className="font-medium">Cadastrar individualmente</h2>
        <ColaboradorForm cargos={cargos ?? []} />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-medium">Importar planilha</h2>
        <ImportForm />
      </div>

      <div className="overflow-x-auto rounded-lg border border-primary-border">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b-2 border-primary-border bg-primary-soft/40 text-primary">
              <th className="whitespace-nowrap px-4 py-3">Matrícula</th>
              <th className="whitespace-nowrap px-4 py-3">Nome</th>
              <th className="whitespace-nowrap px-4 py-3">Tipo</th>
              <th className="whitespace-nowrap px-4 py-3">Cargo</th>
              <th className="whitespace-nowrap px-4 py-3">Admissão</th>
              <th className="px-4 py-3">Gestor</th>
              <th className="whitespace-nowrap px-4 py-3">Status</th>
              <th className="px-4 py-3">Avaliação</th>
            </tr>
          </thead>
          <tbody>
            {(colaboradores ?? []).map((colaborador) => {
              const statusPorMarco = avaliacoesPorColaborador.get(colaborador.id) ?? new Map();
              const marcoPendente = MARCOS.find((m) => statusPorMarco.get(m) !== "respondida");

              return (
                <tr
                  key={colaborador.id}
                  className="border-b border-primary-border/40 align-top last:border-b-0 hover:bg-primary-soft/20"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-500">{colaborador.matricula}</td>
                  <td className="px-4 py-3">
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
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                    {colaborador.tipo === "capacitacao" ? "Em capacitação" : "Novato"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                    {(colaborador.cargos as unknown as { nome: string } | null)?.nome ?? "-"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {new Date(colaborador.data_admissao + "T00:00:00").toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    <div className="flex flex-col">
                      <span>{colaborador.gestor_nome}</span>
                      <span className="text-xs text-zinc-400">{colaborador.gestor_email}</span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {colaborador.ativo ? "Ativo" : "Inativo"}
                  </td>
                  <td className="px-4 py-3">
                    {marcoPendente ? (
                      <div className="flex flex-col items-start gap-2">
                        <span className="text-xs text-zinc-500">
                          {marcoPendente} dias —{" "}
                          {STATUS_LABEL[statusPorMarco.get(marcoPendente) ?? ""] ?? "Não enviada"}
                        </span>
                        <EnviarAgoraButton colaboradorId={colaborador.id} marco={marcoPendente} />
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-500">Completo</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {(colaboradores ?? []).length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-zinc-500">
                  Nenhum colaborador importado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
