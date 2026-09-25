"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireStaff } from "@/lib/supabase/dal";

export type TreinamentoFormState = { error?: string; success?: string } | undefined;

export async function createTreinamento(
  _prevState: TreinamentoFormState,
  formData: FormData
): Promise<TreinamentoFormState> {
  await requireStaff();

  const categoriaId = String(formData.get("categoria_id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();
  // Um treinamento por cargo marcado; nenhum marcado = um só, pra todos os cargos.
  const cargoIds = formData.getAll("cargo_ids").map(String).filter(Boolean);

  if (!categoriaId) {
    return { error: "Selecione a categoria." };
  }
  if (!nome) {
    return { error: "Informe o nome do treinamento." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("treinamentos").insert(
    (cargoIds.length > 0 ? cargoIds : [null]).map((cargoId) => ({
      categoria_id: categoriaId,
      cargo_id: cargoId,
      nome,
      descricao: descricao || null,
    }))
  );

  if (error) {
    return { error: "Não foi possível criar o treinamento." };
  }

  revalidatePath("/admin/categorias");
  return {
    success:
      cargoIds.length > 1
        ? `${cargoIds.length} treinamentos criados, um para cada cargo.`
        : "Treinamento criado.",
  };
}

export async function toggleTreinamentoAtivo(formData: FormData) {
  await requireStaff();
  const id = String(formData.get("id"));
  const ativo = formData.get("ativo") === "true";

  const supabase = await createClient();
  await supabase.from("treinamentos").update({ ativo: !ativo }).eq("id", id);

  revalidatePath("/admin/categorias");
}

export type TreinamentoUpdateState = { error?: string; success?: boolean } | undefined;

export async function updateTreinamento(
  _prevState: TreinamentoUpdateState,
  formData: FormData
): Promise<TreinamentoUpdateState> {
  await requireStaff();

  const id = String(formData.get("id") ?? "");
  const categoriaId = String(formData.get("categoria_id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();
  // Vazio = "Todos os cargos".
  const cargoId = String(formData.get("cargo_id") ?? "") || null;

  if (!categoriaId) {
    return { error: "Selecione a categoria." };
  }
  if (!nome) {
    return { error: "Informe o nome do treinamento." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("treinamentos")
    .update({ categoria_id: categoriaId, cargo_id: cargoId, nome, descricao: descricao || null })
    .eq("id", id);

  if (error) {
    return { error: "Não foi possível salvar o treinamento." };
  }

  revalidatePath("/admin/categorias");
  return { success: true };
}

export type DeleteTreinamentoFormState = { error?: string } | undefined;

export async function deleteTreinamento(
  _prevState: DeleteTreinamentoFormState,
  formData: FormData
): Promise<DeleteTreinamentoFormState> {
  const { user } = await requireAdmin();
  const id = String(formData.get("id"));
  const senha = String(formData.get("senha") ?? "");

  if (!senha) {
    return { error: "Informe sua senha para confirmar." };
  }

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
  const { error } = await supabase.from("treinamentos").delete().eq("id", id);

  if (error) {
    return {
      error: "Não é possível excluir: já existem respostas usando este treinamento. Desative-o em vez disso.",
    };
  }

  revalidatePath("/admin/categorias");
}
