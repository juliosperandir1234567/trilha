"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/supabase/dal";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ConfigFormState = { error?: string; success?: boolean } | undefined;

async function enviarImagem(
  supabase: SupabaseClient,
  arquivo: File,
  nomeBase: "login" | "logo"
): Promise<string | { error: string }> {
  const extensao = arquivo.name.split(".").pop() ?? "png";
  const caminho = `${nomeBase}.${extensao}`;

  const { error: uploadError } = await supabase.storage
    .from("login-assets")
    .upload(caminho, arquivo, { upsert: true, contentType: arquivo.type });

  if (uploadError) {
    return { error: `Falha ao enviar a imagem (${nomeBase}).` };
  }

  const { data: publicUrlData } = supabase.storage.from("login-assets").getPublicUrl(caminho);
  return `${publicUrlData.publicUrl}?v=${Date.now()}`;
}

export async function updateConfiguracoes(
  _prevState: ConfigFormState,
  formData: FormData
): Promise<ConfigFormState> {
  const { user } = await requireStaff();
  const supabase = await createClient();

  const emailRemetente = String(formData.get("email_remetente") ?? "").trim();
  const nomeRemetente = String(formData.get("nome_remetente") ?? "").trim();
  const validadeDias = Number(formData.get("validade_link_dias") ?? 5);
  const imagem = formData.get("imagem_login") as File | null;
  const logo = formData.get("logo_usina") as File | null;

  const atualizacoes: Record<string, unknown> = {
    email_remetente: emailRemetente || null,
    nome_remetente: nomeRemetente || null,
    validade_link_horas: Math.max(1, Math.round(validadeDias * 24)),
    updated_by: user.id,
  };

  if (imagem && imagem.size > 0) {
    const resultado = await enviarImagem(supabase, imagem, "login");
    if (typeof resultado === "object") return resultado;
    atualizacoes.imagem_login_url = resultado;
  }

  if (logo && logo.size > 0) {
    const resultado = await enviarImagem(supabase, logo, "logo");
    if (typeof resultado === "object") return resultado;
    atualizacoes.logo_usina_url = resultado;
  }

  const { error } = await supabase.from("configuracoes_sistema").update(atualizacoes).eq("id", 1);

  if (error) {
    return { error: "Não foi possível salvar as configurações." };
  }

  revalidatePath("/admin/configuracoes");
  revalidatePath("/login");
  revalidatePath("/admin", "layout");
  return { success: true };
}
