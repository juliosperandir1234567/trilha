import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getUsuarioAtual() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: perfil } = await supabase
    .from("usuarios")
    .select("id, nome, email, papel")
    .eq("id", user.id)
    .single();

  return { user, perfil };
}

export async function requireAdmin() {
  const { user, perfil } = await getUsuarioAtual();

  if (perfil?.papel !== "admin") {
    redirect("/");
  }

  return { user, perfil };
}

export async function requireStaff() {
  const { user, perfil } = await getUsuarioAtual();

  if (perfil?.papel !== "admin" && perfil?.papel !== "analista") {
    redirect("/");
  }

  return { user, perfil };
}
