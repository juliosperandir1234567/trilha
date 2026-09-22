"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/supabase/dal";

export type TreinamentoFormState = { error?: string } | undefined;

export async function createTreinamento(
  _prevState: TreinamentoFormState,
  formData: FormData
): Promise<TreinamentoFormState> {
  await requireStaff();

  const categoriaId = String(formData.get("categoria_id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();

  if (!categoriaId) {
    return { error: "Selecione a categoria." };
  }
  if (!nome) {
    return { error: "Informe o nome do treinamento." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("treinamentos").insert({
    categoria_id: categoriaId,
    nome,
    descricao: descricao || null,
  });

  if (error) {
    return { error: "Não foi possível criar o treinamento." };
  }

  revalidatePath("/admin/categorias");
}

export async function toggleTreinamentoAtivo(formData: FormData) {
  await requireStaff();
  const id = String(formData.get("id"));
  const ativo = formData.get("ativo") === "true";

  const supabase = await createClient();
  await supabase.from("treinamentos").update({ ativo: !ativo }).eq("id", id);

  revalidatePath("/admin/categorias");
}
