import { createClient } from "@/lib/supabase/server";
import { getUsuarioAtual } from "@/lib/supabase/dal";
import { ColaboradorForm } from "./colaborador-form";
import { ImportForm } from "./import-form";
import { ColaboradoresTable, type ColaboradorLinha } from "./colaboradores-table";
import { MARCOS_PADRAO, trilhaConcluida, type AvaliacaoDaTrilha } from "@/lib/trilha";
import { SELECT_TREINAMENTOS, treinamentosPendentes, type RespostaComIndicacao } from "@/lib/indicacoes";


export default async function ColaboradoresPage() {
  const { perfil } = await getUsuarioAtual();
  const podeExcluir = perfil?.papel === "admin";
  const supabase = await createClient();
  const [{ data: colaboradores }, { data: avaliacoes }, { data: cargos }, { data: estruturasUsadas }] =
    await Promise.all([
      supabase
        .from("colaboradores")
        .select(
          "id, nome, matricula, data_admissao, tipo, estrutura_macro, turno, cargos(nome, marcos), gestor_nome, gestor_email, ativo"
        )
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("avaliacoes")
        .select(`colaborador_id, marco, status, respostas(id, categoria_final_id, treinamento_realizado_em, ${SELECT_TREINAMENTOS})`),
      supabase.from("cargos").select("id, nome").eq("ativo", true).order("nome"),
      supabase.from("colaboradores").select("estrutura_macro").not("estrutura_macro", "is", null),
    ]);

  const avaliacoesPorColaborador = new Map<string, Map<number, string>>();
  const trilhaPorColaborador = new Map<string, AvaliacaoDaTrilha[]>();
  for (const avaliacao of avaliacoes ?? []) {
    if (!avaliacoesPorColaborador.has(avaliacao.colaborador_id)) {
      avaliacoesPorColaborador.set(avaliacao.colaborador_id, new Map());
    }
    avaliacoesPorColaborador.get(avaliacao.colaborador_id)!.set(avaliacao.marco, avaliacao.status);

    const respostas = avaliacao.respostas as unknown as RespostaComIndicacao[];
    const lista = trilhaPorColaborador.get(avaliacao.colaborador_id) ?? [];
    lista.push({
      marco: avaliacao.marco,
      status: avaliacao.status,
      treinamentosPendentes: treinamentosPendentes(respostas),
    });
    trilhaPorColaborador.set(avaliacao.colaborador_id, lista);
  }

  const linhas: ColaboradorLinha[] = (colaboradores ?? []).map((colaborador) => {
    const cargo = colaborador.cargos as unknown as { nome: string; marcos: number[] } | null;
    const marcosDoColaborador = cargo?.marcos ?? MARCOS_PADRAO;
    const statusPorMarco = avaliacoesPorColaborador.get(colaborador.id) ?? new Map();
    // "Não avaliada" (afastado/desligado) também encerra o período.
    const marcoPendente = marcosDoColaborador.find(
      (m) => statusPorMarco.get(m) !== "respondida" && statusPorMarco.get(m) !== "nao_avaliada"
    );

    return {
      id: colaborador.id,
      matricula: colaborador.matricula,
      nome: colaborador.nome,
      cargoNome: cargo?.nome ?? null,
      dataAdmissao: colaborador.data_admissao,
      tipo: colaborador.tipo,
      estruturaMacro: colaborador.estrutura_macro,
      turno: colaborador.turno,
      gestorNome: colaborador.gestor_nome,
      gestorEmail: colaborador.gestor_email,
      ativo: colaborador.ativo,
      marcoPendente: marcoPendente ?? null,
      statusMarcoPendente: marcoPendente ? statusPorMarco.get(marcoPendente) ?? null : null,
      trilhaConcluida: trilhaConcluida(cargo?.marcos, trilhaPorColaborador.get(colaborador.id) ?? []),
      treinamentosPendentes: (trilhaPorColaborador.get(colaborador.id) ?? []).reduce(
        (soma, a) => soma + a.treinamentosPendentes,
        0
      ),
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Colaboradores</h1>

      <div className="flex flex-col gap-2">
        <h2 className="font-medium">Cadastrar individualmente</h2>
        <ColaboradorForm
          cargos={cargos ?? []}
          estruturas={[...new Set((estruturasUsadas ?? []).map((c) => c.estrutura_macro as string))].sort()}
        />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-medium">Importar planilha</h2>
        <ImportForm />
      </div>

      <ColaboradoresTable colaboradores={linhas} podeExcluir={podeExcluir} />
    </div>
  );
}
