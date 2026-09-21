"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/supabase/dal";

export type CategoriaFormState = { error?: string } | undefined;

export async function createCategoria(
  _prevState: CategoriaFormState,
  formData: FormData
): Promise<CategoriaFormState> {
  await requireStaff();
  const nome = String(formData.get("nome") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();

  if (!nome) {
    return { error: "Informe o nome da categoria." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("categorias_treinamento")
    .insert({ nome, descricao: descricao || null });

  if (error) {
    return { error: "Não foi possível criar a categoria (nome já existe?)." };
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
