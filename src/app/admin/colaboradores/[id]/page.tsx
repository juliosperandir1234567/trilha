import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileDown, Pencil, Undo2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioAtual } from "@/lib/supabase/dal";
import { NOTA_CRITICA, nomeDaNota } from "@/lib/escala";
import { EnviarAgoraButton } from "./enviar-agora-button";
import { marcarTodosTreinamentosRealizados, marcarTreinamentoRealizado } from "@/lib/actions/avaliacoes";
import { ColaboradorForm } from "../colaborador-form";

const MARCOS_PADRAO = [30, 60, 90];

const STATUS_LABEL: Record<string, string> = {
  pendente: "Não enviada (aguardando disparo)",
  enviada: "Aguardando resposta",
  respondida: "Respondida",
  expirada: "Expirada (não respondida a tempo)",
  nao_avaliada: "Não avaliada",
};

type RespostaDetalhe = {
  id: string;
  nota: number;
  comentario: string | null;
  treinamento_realizado_em: string | null;
  perguntas: { texto: string; ordem: number | null } | null;
  categorias_treinamento: { nome: string } | null;
  treinamentos: { nome: string } | null;
};

export default async function ColaboradorDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { perfil } = await getUsuarioAtual();
  const ehAdmin = perfil?.papel === "admin";
  const supabase = await createClient();

  const [{ data: colaborador }, { data: cargos }] = await Promise.all([
    supabase
      .from("colaboradores")
      .select(
        "id, nome, matricula, email, data_admissao, tipo, gestor_nome, gestor_email, ativo, cargo_id, cargos(nome, marcos)"
      )
      .eq("id", id)
      .single(),
    supabase.from("cargos").select("id, nome").order("nome"),
  ]);

  if (!colaborador) notFound();

  const cargo = colaborador.cargos as unknown as { nome: string; marcos: number[] } | null;
  const marcos = cargo?.marcos ?? MARCOS_PADRAO;

  const { data: avaliacoes } = await supabase
    .from("avaliacoes")
    .select(
      "id, marco, status, data_referencia, data_envio, data_resposta, rascunho_salvo_em, motivo_nao_avaliada, observacao_nao_avaliada, ultimo_envio_em, lembretes_enviados, respostas(id, nota, comentario, treinamento_realizado_em, perguntas(texto, ordem), categorias_treinamento:categoria_final_id(nome), treinamentos:treinamento_final_id(nome))"
    )
    .eq("colaborador_id", id)
    .order("marco");

  const avaliacaoPorMarco = new Map((avaliacoes ?? []).map((a) => [a.marco, a]));

  const temNotaCritica = (avaliacoes ?? []).some((a) =>
    (a.respostas as unknown as { nota: number }[]).some((r) => r.nota === NOTA_CRITICA)
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
          {colaborador.tipo === "capacitacao" ? "Capacitação" : "Novato"} ·{" "}
          {cargo ? <>Cargo: {cargo.nome} · </> : null}
          {colaborador.tipo === "capacitacao" ? "Mudou de cargo em" : "Admissão em"}{" "}
          {new Date(colaborador.data_admissao + "T00:00:00").toLocaleDateString("pt-BR")}
          {" · "}Gestor: {colaborador.gestor_nome} ({colaborador.gestor_email})
          {" · "}{colaborador.ativo ? "Ativo" : "Inativo"}
        </p>
      </div>

      <details className="group">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-md border border-primary-border px-3 py-1.5 text-sm text-primary hover:bg-primary-soft">
          <Pencil className="h-4 w-4" />
          Editar cadastro
        </summary>
        <div className="mt-3">
          <ColaboradorForm cargos={cargos ?? []} colaborador={colaborador} />
        </div>
      </details>

      {marcos.map((marco) => {
        const avaliacao = avaliacaoPorMarco.get(marco);
        const respostas = ((avaliacao?.respostas ?? []) as unknown as RespostaDetalhe[]).sort(
          (a, b) => (a.perguntas?.ordem ?? 0) - (b.perguntas?.ordem ?? 0)
        );
        // Finalizada: respondida e com todo treinamento indicado já feito.
        const treinamentosPendentes = respostas.filter(
          (r) => r.categorias_treinamento && !r.treinamento_realizado_em
        ).length;
        const finalizada = avaliacao?.status === "respondida" && treinamentosPendentes === 0;

        return (
          <div key={marco} className="rounded-lg border border-primary-border p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-medium">{marco} dias</h2>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-zinc-500">
                  {!avaliacao
                    ? "Ainda não atingiu este período"
                    : finalizada
                      ? "Finalizada"
                      : avaliacao.status === "respondida"
                        ? `Respondida · ${treinamentosPendentes} treinamento(s) a fazer`
                        : STATUS_LABEL[avaliacao.status] ?? avaliacao.status}
                </span>
                {finalizada && (
                  <a
                    href={`/admin/avaliacoes/pdf?id=${avaliacao.id}`}
                    className="flex items-center gap-1.5 rounded-md border border-primary-border px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary-soft"
                  >
                    <FileDown className="h-3 w-3" />
                    Baixar PDF
                  </a>
                )}
                {avaliacao?.status === "respondida" && treinamentosPendentes > 1 && ehAdmin && (
                  <form action={marcarTodosTreinamentosRealizados}>
                    <input type="hidden" name="avaliacao_id" value={avaliacao.id} />
                    <input type="hidden" name="colaborador_id" value={colaborador.id} />
                    <button
                      type="submit"
                      className="flex items-center gap-1.5 rounded-md border border-primary-border px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary-soft"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Marcar todos os treinamentos como feitos
                    </button>
                  </form>
                )}
                {avaliacao?.status !== "respondida" && avaliacao?.status !== "nao_avaliada" && (
                  <EnviarAgoraButton colaboradorId={colaborador.id} marco={marco} />
                )}
                {(avaliacao?.status === "respondida" || avaliacao?.status === "nao_avaliada") && ehAdmin && (
                  <EnviarAgoraButton
                    colaboradorId={colaborador.id}
                    marco={marco}
                    reabrir
                    rotulo="Reabrir para o gestor"
                  />
                )}
              </div>
            </div>

            {avaliacao?.status === "respondida" && (
              <ul className="flex flex-col gap-2 text-sm">
                {respostas.map((resposta) => (
                  <li
                    key={resposta.id}
                    className={`border-t pt-2 ${
                      resposta.nota === NOTA_CRITICA
                        ? "border-red-200 bg-red-50 -mx-2 rounded px-2 dark:border-red-900 dark:bg-red-950/40"
                        : "border-primary-border/40"
                    }`}
                  >
                    <p className="flex items-center gap-1">
                      {resposta.perguntas?.texto}
                      {resposta.nota === NOTA_CRITICA && (
                        <AlertTriangle className="h-3 w-3 shrink-0 text-red-600" />
                      )}
                    </p>
                    <p className={resposta.nota === NOTA_CRITICA ? "text-red-700 dark:text-red-400" : "text-zinc-500"}>
                      Nota: <strong>{resposta.nota} — {nomeDaNota(resposta.nota)}</strong>
                      {resposta.treinamentos ? (
                        <> · Treinamento indicado: {resposta.treinamentos.nome}</>
                      ) : (
                        resposta.categorias_treinamento && (
                          <> · Competência sugerida: {resposta.categorias_treinamento.nome}</>
                        )
                      )}
                    </p>
                    {resposta.comentario && (
                      <p className="italic text-zinc-500">&quot;{resposta.comentario}&quot;</p>
                    )}
                    {/* Indicação de treinamento: o admin marca quando foi feito. */}
                    {resposta.categorias_treinamento && (
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        {resposta.treinamento_realizado_em ? (
                          <span className="flex items-center gap-1 font-medium text-green-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Treinamento feito em{" "}
                            {new Date(resposta.treinamento_realizado_em).toLocaleDateString("pt-BR")}
                          </span>
                        ) : (
                          <span className="text-amber-700">Treinamento a fazer</span>
                        )}
                        {ehAdmin && (
                          <form action={marcarTreinamentoRealizado}>
                            <input type="hidden" name="resposta_id" value={resposta.id} />
                            <input type="hidden" name="colaborador_id" value={colaborador.id} />
                            <input type="hidden" name="feito" value={resposta.treinamento_realizado_em ? "0" : "1"} />
                            <button
                              type="submit"
                              className={`flex items-center gap-1 rounded-md border px-2 py-0.5 font-medium ${
                                resposta.treinamento_realizado_em
                                  ? "border-black/15 text-zinc-500 hover:bg-zinc-50"
                                  : "border-primary-border text-primary hover:bg-primary-soft"
                              }`}
                            >
                              {resposta.treinamento_realizado_em ? (
                                <>
                                  <Undo2 className="h-3 w-3" />
                                  Desfazer
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="h-3 w-3" />
                                  Marcar como feito
                                </>
                              )}
                            </button>
                          </form>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {avaliacao?.status === "nao_avaliada" && (
              <p className="text-sm text-zinc-600">
                O gestor informou que o colaborador está{" "}
                <strong>{avaliacao.motivo_nao_avaliada === "desligado" ? "desligado" : "afastado"}</strong>
                {avaliacao.data_resposta && ` (em ${new Date(avaliacao.data_resposta).toLocaleDateString("pt-BR")})`}.
                {avaliacao.observacao_nao_avaliada && (
                  <span className="block italic text-zinc-500">&quot;{avaliacao.observacao_nao_avaliada}&quot;</span>
                )}
              </p>
            )}

            {avaliacao && avaliacao.status !== "respondida" && avaliacao.status !== "nao_avaliada" && (
              <p className="text-sm text-zinc-500">
                {avaliacao.data_envio
                  ? `E-mail enviado em ${new Date(avaliacao.data_envio).toLocaleString("pt-BR")}`
                  : "Ainda não enviado."}
                {avaliacao.lembretes_enviados > 0 &&
                  avaliacao.ultimo_envio_em &&
                  ` · ${avaliacao.lembretes_enviados} lembrete(s), o último em ${new Date(avaliacao.ultimo_envio_em).toLocaleString("pt-BR")}`}
                {avaliacao.rascunho_salvo_em &&
                  ` · Rascunho do gestor salvo em ${new Date(avaliacao.rascunho_salvo_em).toLocaleString("pt-BR")}`}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
