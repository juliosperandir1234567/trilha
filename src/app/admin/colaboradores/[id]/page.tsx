import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EnviarAgoraButton } from "./enviar-agora-button";

const MARCOS = [30, 60, 90] as const;

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente (aguardando disparo)",
  enviada: "Enviada — aguardando resposta",
  respondida: "Respondida",
  expirada: "Expirada (não respondida a tempo)",
};

export default async function ColaboradorDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: colaborador } = await supabase
    .from("colaboradores")
    .select(
      "id, nome, matricula, email, data_admissao, tipo, gestor_nome, gestor_email, gestor_matricula, ativo"
    )
    .eq("id", id)
    .single();

  if (!colaborador) notFound();

  const { data: avaliacoes } = await supabase
    .from("avaliacoes")
    .select(
      "id, marco, status, data_referencia, data_envio, data_resposta, respostas(nota, comentario, perguntas(texto), categorias_treinamento:categoria_final_id(nome))"
    )
    .eq("colaborador_id", id)
    .order("marco");

  const avaliacaoPorMarco = new Map((avaliacoes ?? []).map((a) => [a.marco, a]));

  const temNotaCritica = (avaliacoes ?? []).some((a) =>
    (a.respostas as unknown as { nota: number }[]).some((r) => r.nota === 1)
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/colaboradores" className="text-sm text-primary underline underline-offset-2">
          ← Voltar
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-xl font-semibold">
          {colaborador.matricula} — {colaborador.nome}
          {temNotaCritica && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-400">
              <AlertTriangle className="h-3 w-3" />
              Atenção
            </span>
          )}
        </h1>
        <p className="text-sm text-zinc-500">
          {colaborador.tipo === "capacitacao" ? "Em capacitação" : "Novato"} · Admissão em{" "}
          {new Date(colaborador.data_admissao + "T00:00:00").toLocaleDateString("pt-BR")}
          {" · "}Gestor: {colaborador.gestor_matricula} — {colaborador.gestor_nome} (
          {colaborador.gestor_email})
          {" · "}{colaborador.ativo ? "Ativo" : "Inativo"}
        </p>
      </div>

      {MARCOS.map((marco) => {
        const avaliacao = avaliacaoPorMarco.get(marco);

        return (
          <div key={marco} className="rounded-lg border border-primary-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-medium">{marco} dias</h2>
              <div className="flex items-center gap-3">
                <span className="text-sm text-zinc-500">
                  {avaliacao ? STATUS_LABEL[avaliacao.status] ?? avaliacao.status : "Ainda não atingiu este marco"}
                </span>
                {avaliacao?.status !== "respondida" && (
                  <EnviarAgoraButton colaboradorId={colaborador.id} marco={marco} />
                )}
              </div>
            </div>

            {avaliacao?.status === "respondida" && (
              <ul className="flex flex-col gap-2 text-sm">
                {(avaliacao.respostas as unknown as {
                  nota: number;
                  comentario: string | null;
                  perguntas: { texto: string } | null;
                  categorias_treinamento: { nome: string } | null;
                }[]).map((resposta, i) => (
                  <li
                    key={i}
                    className={`border-t pt-2 ${
                      resposta.nota === 1
                        ? "border-red-200 bg-red-50 -mx-2 rounded px-2 dark:border-red-900 dark:bg-red-950/40"
                        : "border-primary-border/40"
                    }`}
                  >
                    <p className="flex items-center gap-1">
                      {resposta.perguntas?.texto}
                      {resposta.nota === 1 && (
                        <AlertTriangle className="h-3 w-3 shrink-0 text-red-600" />
                      )}
                    </p>
                    <p className={resposta.nota === 1 ? "text-red-700 dark:text-red-400" : "text-zinc-500"}>
                      Nota: <strong>{resposta.nota}</strong>
                      {resposta.categorias_treinamento && (
                        <> · Treinamento sugerido: {resposta.categorias_treinamento.nome}</>
                      )}
                    </p>
                    {resposta.comentario && (
                      <p className="italic text-zinc-500">&quot;{resposta.comentario}&quot;</p>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {avaliacao && avaliacao.status !== "respondida" && (
              <p className="text-sm text-zinc-500">
                {avaliacao.data_envio
                  ? `E-mail enviado em ${new Date(avaliacao.data_envio).toLocaleString("pt-BR")}`
                  : "Ainda não enviado."}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
