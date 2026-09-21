"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/dal";

export type CriarUsuarioFormState = { error?: string } | undefined;

export async function criarUsuario(
  _prevState: CriarUsuarioFormState,
  formData: FormData
): Promise<CriarUsuarioFormState> {
  await requireAdmin();

  const nome = String(formData.get("nome") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const senha = String(formData.get("senha") ?? "");
  const papel = String(formData.get("papel") ?? "");

  if (!nome || !email || !senha || !["admin", "analista"].includes(papel)) {
    return { error: "Preencha todos os campos corretamente." };
  }

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: "Sessão expirada, faça login novamente." };
  }

  const resposta = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/criar-usuario`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ nome, email, senha, papel }),
    }
  );

  const json = await resposta.json();

  if (!resposta.ok) {
    return { error: json.error ?? "Não foi possível criar o usuário." };
  }

  revalidatePath("/admin/usuarios");
}
