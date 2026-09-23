"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireStaff } from "@/lib/supabase/dal";

export type CategoriaFormState = { error?: string } | undefined;

export async function createCategoria(
  _prevState: CategoriaFormState,
  formData: FormData
): Promise<CategoriaFormState> {
  await requireStaff();
  const nome = String(formData.get("nome") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();
  const cargoId = String(formData.get("cargo_id") ?? "");

  if (!nome) {
    return { error: "Informe o nome da competência." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("categorias_treinamento")
    .insert({ nome, descricao: descricao || null, cargo_id: cargoId || null });

  if (error) {
    return { error: "Não foi possível criar a competência (nome já existe?)." };
  }

  revalidatePath("/admin/categorias");
}

export async function toggleCategoriaAtiva(formData: FormData) {
  await requireStaff();
  const id = String(formData.get("id"));
  const ativo = formData.get("ativo") === "true";

  const supabase = await createClient();
  await supabase.from("categorias_treinamento").update({ ativo: !ativo }).eq("id", id);

  revalidatePath("/admin/categorias");
}

export type CategoriaUpdateState = { error?: string; success?: boolean } | undefined;

export async function updateCategoria(
  _prevState: CategoriaUpdateState,
  formData: FormData
): Promise<CategoriaUpdateState> {
  await requireStaff();

  const id = String(formData.get("id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();
  const cargoId = String(formData.get("cargo_id") ?? "");

  if (!nome) {
    return { error: "Informe o nome da competência." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("categorias_treinamento")
    .update({ nome, descricao: descricao || null, cargo_id: cargoId || null })
    .eq("id", id);

  if (error) {
    return { error: "Não foi possível salvar (nome já existe?)." };
  }

  revalidatePath("/admin/categorias");
  return { success: true };
}

export type DeleteCategoriaFormState = { error?: string } | undefined;

export async function deleteCategoria(
  _prevState: DeleteCategoriaFormState,
  formData: FormData
): Promise<DeleteCategoriaFormState> {
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
  const { error } = await supabase.from("categorias_treinamento").delete().eq("id", id);

  if (error) {
    return {
      error:
        "Não é possível excluir: existem treinamentos ou respostas usando esta competência. Desative-a em vez disso.",
    };
  }

  revalidatePath("/admin/categorias");
}
