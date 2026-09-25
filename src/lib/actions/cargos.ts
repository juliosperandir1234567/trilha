"use server";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireStaff } from "@/lib/supabase/dal";
import { PERIODOS } from "@/lib/periodos";

export type CargoFormState = { error?: string } | undefined;

const MARCOS_VALIDOS: readonly number[] = PERIODOS;

function parseMarcos(formData: FormData): number[] {
  const marcos = formData
    .getAll("marcos")
    .map(Number)
    .filter((marco) => MARCOS_VALIDOS.includes(marco));
  // Nunca deixa um cargo sem nenhum marco marcado — cairia num limbo sem
  // avaliação nenhuma sem ninguém perceber. 30/60/90 é o padrão seguro.
  return marcos.length > 0 ? marcos.sort((a, b) => a - b) : [30, 60, 90];
}

export async function createCargo(
  _prevState: CargoFormState,
  formData: FormData
): Promise<CargoFormState> {
  await requireStaff();
  const nome = String(formData.get("nome") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();
  const marcos = parseMarcos(formData);

  if (!nome) {
    return { error: "Informe o nome do cargo." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("cargos")
    .insert({ nome, descricao: descricao || null, marcos });

  if (error) {
    return { error: "Não foi possível criar o cargo (nome já existe?)." };
  }

  revalidatePath("/admin/cargos");
  revalidatePath("/admin/colaboradores");
  revalidatePath("/admin/perguntas");
}

export async function toggleCargoAtivo(formData: FormData) {
  await requireStaff();
  const id = String(formData.get("id"));
  const ativo = formData.get("ativo") === "true";

  const supabase = await createClient();
  await supabase.from("cargos").update({ ativo: !ativo }).eq("id", id);

  revalidatePath("/admin/cargos");
  revalidatePath("/admin/colaboradores");
  revalidatePath("/admin/perguntas");
}

export type CargoUpdateState = { error?: string; success?: boolean } | undefined;

export async function updateCargo(
  _prevState: CargoUpdateState,
  formData: FormData
): Promise<CargoUpdateState> {
  await requireStaff();

  const id = String(formData.get("id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();
  const marcos = parseMarcos(formData);

  if (!nome) {
    return { error: "Informe o nome do cargo." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("cargos")
    .update({ nome, descricao: descricao || null, marcos })
    .eq("id", id);

  if (error) {
    return { error: "Não foi possível salvar (nome já existe?)." };
  }

  revalidatePath("/admin/cargos");
  return { success: true };
}

export type DeleteCargoFormState = { error?: string } | undefined;

export async function deleteCargo(
  _prevState: DeleteCargoFormState,
  formData: FormData
): Promise<DeleteCargoFormState> {
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
  const { error } = await supabase.from("cargos").delete().eq("id", id);

  if (error) {
    return {
      error: "Não foi possível excluir esse cargo: ainda há colaboradores, perguntas ou treinamentos usando ele. Desative-o em vez disso.",
    };
  }

  revalidatePath("/admin/cargos");
}
