import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Método não suportado" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Não autenticado" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Cliente com o token de quem chamou, só pra descobrir quem é e checar o papel.
  const supabaseComoChamador = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user: chamador },
  } = await supabaseComoChamador.auth.getUser();

  if (!chamador) return json({ error: "Não autenticado" }, 401);

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const { data: perfilChamador } = await supabaseAdmin
    .from("usuarios")
    .select("papel")
    .eq("id", chamador.id)
    .single();

  if (perfilChamador?.papel !== "admin") {
    return json({ error: "Apenas administradores podem criar usuários" }, 403);
  }

  const body = await req.json().catch(() => null);
  const nome = (body?.nome ?? "").trim();
  const email = (body?.email ?? "").trim();
  const senha = body?.senha ?? "";
  const papel = body?.papel;

  if (!nome || !email || !senha || !["admin", "analista"].includes(papel)) {
    return json({ error: "Dados inválidos" }, 400);
  }
  if (senha.length < 8) {
    return json({ error: "A senha deve ter pelo menos 8 caracteres" }, 400);
  }

  const { data: novoUsuario, error: erroCriacao } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  });

  if (erroCriacao || !novoUsuario.user) {
    return json({ error: erroCriacao?.message ?? "Não foi possível criar o usuário" }, 400);
  }

  const { error: erroPerfil } = await supabaseAdmin.from("usuarios").insert({
    id: novoUsuario.user.id,
    nome,
    email,
    papel,
  });

  if (erroPerfil) {
    await supabaseAdmin.auth.admin.deleteUser(novoUsuario.user.id);
    return json({ error: "Não foi possível criar o perfil do usuário" }, 500);
  }

  return json({ success: true });
});
