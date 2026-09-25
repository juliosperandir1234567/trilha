import { createClient } from "@/lib/supabase/server";
import { getUsuarioAtual } from "@/lib/supabase/dal";
import { ColaboradorForm } from "./colaborador-form";
import { ImportForm } from "./import-form";
import { ColaboradoresTable, type ColaboradorLinha } from "./colaboradores-table";

const MARCOS_PADRAO = [30, 60, 90];

export default async function ColaboradoresPage() {
  const { perfil } = await getUsuarioAtual();
  const podeExcluir = perfil?.papel === "admin";
  const supabase = await createClient();
  const [{ data: colaboradores }, { data: notasCriticas }, { data: avaliacoes }, { data: cargos }] =
    await Promise.all([
      supabase
        .from("colaboradores")
        .select(
          "id, nome, matricula, data_admissao, tipo, cargos(nome, marcos), gestor_nome, gestor_email, ativo"
        )
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("respostas").select("avaliacoes!inner(colaborador_id)").eq("nota", 1),
      supabase.from("avaliacoes").select("colaborador_id, marco, status"),
      supabase.from("cargos").select("id, nome").eq("ativo", true).order("nome"),
    ]);

  const colaboradoresComNotaCritica = new Set(
    (notasCriticas ?? []).map(
      (r) => (r.avaliacoes as unknown as { colaborador_id: string }).colaborador_id
    )
  );

  const avaliacoesPorColaborador = new Map<string, Map<number, string>>();
  for (const avaliacao of avaliacoes ?? []) {
    if (!avaliacoesPorColaborador.has(avaliacao.colaborador_id)) {
      avaliacoesPorColaborador.set(avaliacao.colaborador_id, new Map());
    }
    avaliacoesPorColaborador.get(avaliacao.colaborador_id)!.set(avaliacao.marco, avaliacao.status);
  }

  const linhas: ColaboradorLinha[] = (colaboradores ?? []).map((colaborador) => {
    const cargo = colaborador.cargos as unknown as { nome: string; marcos: number[] } | null;
    const marcosDoColaborador = cargo?.marcos ?? MARCOS_PADRAO;
    const statusPorMarco = avaliacoesPorColaborador.get(colaborador.id) ?? new Map();
    const marcoPendente = marcosDoColaborador.find((m) => statusPorMarco.get(m) !== "respondida");

    return {
      id: colaborador.id,
      matricula: colaborador.matricula,
      nome: colaborador.nome,
      cargoNome: cargo?.nome ?? null,
      dataAdmissao: colaborador.data_admissao,
      tipo: colaborador.tipo,
      gestorNome: colaborador.gestor_nome,
      gestorEmail: colaborador.gestor_email,
      ativo: colaborador.ativo,
      notaCritica: colaboradoresComNotaCritica.has(colaborador.id),
      marcoPendente: marcoPendente ?? null,
      statusMarcoPendente: marcoPendente ? statusPorMarco.get(marcoPendente) ?? null : null,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Colaboradores</h1>

      <div className="flex flex-col gap-2">
        <h2 className="font-medium">Cadastrar individualmente</h2>
        <ColaboradorForm cargos={cargos ?? []} />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-medium">Importar planilha</h2>
        <ImportForm />
      </div>

      <ColaboradoresTable colaboradores={linhas} podeExcluir={podeExcluir} />
    </div>
  );
}
