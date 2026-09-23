"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireStaff } from "@/lib/supabase/dal";

export type PerguntaFormState = { error?: string } | undefined;

export async function createPergunta(
  _prevState: PerguntaFormState,
  formData: FormData
): Promise<PerguntaFormState> {
  await requireStaff();

  const marco = Number(formData.get("marco"));
  const texto = String(formData.get("texto") ?? "").trim();
  const categoriaSugeridaId = String(formData.get("categoria_sugerida_id") ?? "");
  const cargoId = String(formData.get("cargo_id") ?? "");

  if (![30, 60, 90, 120, 180, 270].includes(marco)) {
    return { error: "Marco inválido." };
  }
  if (!texto) {
    return { error: "Informe o texto da pergunta." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("perguntas").insert({
    marco,
    texto,
    categoria_sugerida_id: categoriaSugeridaId || null,
    cargo_id: cargoId || null,
  });

  if (error) {
    return { error: "Não foi possível criar a pergunta." };
  }

  revalidatePath("/admin/perguntas");
}

export async function togglePerguntaAtiva(formData: FormData) {
  await requireStaff();
  const id = String(formData.get("id"));
  const ativo = formData.get("ativo") === "true";

  const supabase = await createClient();
  await supabase.from("perguntas").update({ ativo: !ativo }).eq("id", id);

  revalidatePath("/admin/perguntas");
}

export type DeletePerguntaFormState = { error?: string } | undefined;

export async function deletePergunta(
  _prevState: DeletePerguntaFormState,
  formData: FormData
): Promise<DeletePerguntaFormState> {
  const { user } = await requireAdmin();
  const id = String(formData.get("id"));
  const senha = String(formData.get("senha") ?? "");

  if (!senha) {
    return { error: "Informe sua senha para confirmar." };
  }

  // Verifica a senha num cliente à parte (sem cookies), sem afetar a sessão atual do admin.
  const verificador = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
  const { error: senhaInvalida } = await verificador.auth.signInWithPassword({
    email: user.email!,
    password: senha,
  });

  if (senhaInvalida) {
    return { error: "Senha incorreta." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("perguntas").delete().eq("id", id);

  if (error) {
    return {
      error:
        "Não é possível excluir: já existem respostas usando esta pergunta. Desative-a em vez disso.",
    };
  }

  revalidatePath("/admin/perguntas");
}
