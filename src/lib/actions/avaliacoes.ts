"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/supabase/dal";

export type EnviarAvaliacaoState =
  | { error?: string; success?: boolean; enviadoPara?: string }
  | undefined;

export async function enviarAvaliacaoAgora(
  _prevState: EnviarAvaliacaoState,
  formData: FormData
): Promise<EnviarAvaliacaoState> {
  await requireStaff();

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
      body: JSON.stringify({ colaborador_id: colaboradorId, marco }),
    }
  );

  const json = await resposta.json();

  if (!resposta.ok) {
    return { error: json.error ?? "Não foi possível enviar o e-mail." };
  }

  revalidatePath(`/admin/colaboradores/${colaboradorId}`);
  revalidatePath("/admin");
  return { success: true, enviadoPara: json.enviado_para };
}
