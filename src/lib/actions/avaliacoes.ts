"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireStaff } from "@/lib/supabase/dal";

export type EnviarAvaliacaoState =
  | {
      error?: string;
      success?: boolean;
      enviadoPara?: string;
      link?: string;
      emailEnviado?: boolean;
      aviso?: string;
    }
  | undefined;

export async function enviarAvaliacaoAgora(
  _prevState: EnviarAvaliacaoState,
  formData: FormData
): Promise<EnviarAvaliacaoState> {
  // Reabrir apaga as respostas e devolve a avaliação pro gestor: só admin.
  const reabrir = formData.get("reabrir") === "1";
  if (reabrir) await requireAdmin();
  else await requireStaff();

  const colaboradorId = String(formData.get("colaborador_id") ?? "");
  const marco = Number(formData.get("marco"));

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: "Sessão expirada, faça login novamente." };
  }

  const resposta = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/enviar-avaliacao-agora`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ colaborador_id: colaboradorId, marco, reabrir }),
    }
  );

  const json = await resposta.json();

  if (!resposta.ok) {
    return { error: json.error ?? "Não foi possível enviar o e-mail." };
  }

  revalidatePath(`/admin/colaboradores/${colaboradorId}`);
  revalidatePath("/admin");
  return {
    success: true,
    enviadoPara: json.enviado_para,
    link: json.link,
    emailEnviado: json.email_enviado,
    aviso: json.aviso,
  };
}

// Admin marca (ou desmarca) que o treinamento indicado numa resposta foi
// feito. Com todas as indicações feitas, a avaliação conta como finalizada.
export async function marcarTreinamentoRealizado(formData: FormData) {
  await requireAdmin();
  const respostaId = String(formData.get("resposta_id") ?? "");
  const colaboradorId = String(formData.get("colaborador_id") ?? "");
  const feito = formData.get("feito") === "1";
  if (!respostaId) return;

  const supabase = await createClient();
  await supabase
    .from("respostas")
    .update({ treinamento_realizado_em: feito ? new Date().toISOString() : null })
    .eq("id", respostaId);

  if (colaboradorId) revalidatePath(`/admin/colaboradores/${colaboradorId}`);
  revalidatePath("/admin");
}

// Atalho: marca como feitos todos os treinamentos ainda pendentes de uma avaliação.
export async function marcarTodosTreinamentosRealizados(formData: FormData) {
  await requireAdmin();
  const avaliacaoId = String(formData.get("avaliacao_id") ?? "");
  const colaboradorId = String(formData.get("colaborador_id") ?? "");
  if (!avaliacaoId) return;

  const supabase = await createClient();
  await supabase
    .from("respostas")
    .update({ treinamento_realizado_em: new Date().toISOString() })
    .eq("avaliacao_id", avaliacaoId)
    .not("categoria_final_id", "is", null)
    .is("treinamento_realizado_em", null);

  if (colaboradorId) revalidatePath(`/admin/colaboradores/${colaboradorId}`);
  revalidatePath("/admin");
}
