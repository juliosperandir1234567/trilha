import { createClient } from "@/lib/supabase/server";
import { ConfiguracoesForm } from "./configuracoes-form";

export default async function ConfiguracoesPage() {
  const supabase = await createClient();
  const { data: config } = await supabase
    .from("configuracoes_sistema")
    .select("imagem_login_url, logo_usina_url, email_remetente, nome_remetente, validade_link_horas")
    .eq("id", 1)
    .single();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Configurações</h1>
      <ConfiguracoesForm
        config={
          config ?? {
            imagem_login_url: null,
            logo_usina_url: null,
            email_remetente: null,
            nome_remetente: null,
            validade_link_horas: 120,
          }
        }
      />
    </div>
  );
}
