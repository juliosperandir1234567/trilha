import Link from "next/link";
import {
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Hourglass,
  Timer,
  GraduationCap,
  ChevronRight,
  CalendarDays,
  X,
  UserX,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AvaliacoesTable, type AvaliacaoLinha } from "./avaliacoes-table";
import { EnviarAgoraButton } from "./colaboradores/[id]/enviar-agora-button";
import { ExportarLink } from "./exportar-link";
import { EstruturasCard, type LinhaEstrutura } from "./estruturas-card";
import { TrajetoriaCard, type LinhaTrajetoria, type PeriodoTrajetoria } from "./trajetoria-card";
import { trilhaConcluida, type AvaliacaoDaTrilha } from "@/lib/trilha";
import {
  SELECT_TREINAMENTOS,
  itensDeTreinamento,
  treinamentosPendentes,
  type RespostaComIndicacao,
} from "@/lib/indicacoes";
import { PERIODOS, PERIODOS_FILTRO } from "@/lib/periodos";

const MARCOS = PERIODOS;

// Mesmas regras da rotina diária (supabase/functions/avaliacoes-diarias):
// marcos padrão pra quem não tem cargo e janela de recuperação de marco
// vencido. Se mudar lá, mudar aqui.
const MARCOS_PADRAO = [30, 60, 90];
const DIAS_CATCHUP_ROTINA = 30;
// "Próximas avaliações": quantos dias à frente mostrar, e até quantos dias
// atrás um marco sem avaliação ainda vale a pena listar/contar.
const DIAS_PROXIMAS = 7;
const DIAS_MARCO_PERDIDO_VISIVEL = 90;

function somarDiasISO(dataISO: string, dias: number): string {
  const data = new Date(dataISO + "T00:00:00Z");
  data.setUTCDate(data.getUTCDate() + dias);
  return data.toISOString().slice(0, 10);
}

function diferencaDias(deISO: string, ateISO: string): number {
  return Math.round(
    (new Date(ateISO + "T00:00:00Z").getTime() - new Date(deISO + "T00:00:00Z").getTime()) /
      (24 * 60 * 60 * 1000)
  );
}

// Um status tem sempre o mesmo nome e a mesma cor em toda a página: card,
// barras e tabela. Os hex batem com a cor do ícone do card de cada status
// (green-700, orange-500, blue-600, red-500).
const STATUS_VISUAL = [
  { chave: "respondida", label: "Respondidas", cor: "#15803d" },
  { chave: "enviada", label: "Aguardando resposta", cor: "#f97316" },
  { chave: "pendente", label: "Não enviadas", cor: "#2563eb" },
  { chave: "expirada", label: "Expiradas", cor: "#ef4444" },
  // Gestor informou pelo link que o colaborador está afastado ou desligado.
  { chave: "nao_avaliada", label: "Não avaliadas", cor: "#71717a" },
] as const;

// Até quantos dias antes do vencimento uma avaliação em aberto é urgente.
const DIAS_URGENCIA = 2;

// Sempre em dias. Abaixo de um dia, "0,2 dias" parece erro — vira "< 1 dia".
function formatarTempoResposta(dias: number | null): string {
  if (dias === null) return "-";
  if (dias < 1) return "< 1 dia";
  const texto = dias.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return `${texto} ${texto === "1" ? "dia" : "dias"}`;
}

const STATUS_FILTRO_LABEL: Record<string, string> = {
  pendente: "Não enviadas",
  enviada: "Aguardando resposta",
  respondida: "Respondidas",
  expirada: "Expiradas",
  nao_avaliada: "Não avaliadas",
};

const MARCOS_FILTRO = PERIODOS_FILTRO;

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{
    marco?: string;
    status?: string;
    admissao_de?: string;
    admissao_ate?: string;
    tipo?: string;
  }>;
}) {
  const {
    marco,
    status,
    admissao_de: admissaoDe,
    admissao_ate: admissaoAte,
    tipo: tipoBruto,
  } = await searchParams;
  const marcoNum = marco ? Number(marco) : null;
  // Novato ou capacitação (mudança de cargo); sem filtro = os dois.
  const tipo = tipoBruto === "novato" || tipoBruto === "capacitacao" ? tipoBruto : undefined;
  const supabase = await createClient();

  // Filtros sobre o colaborador (data de início e tipo) acompanham todos os
  // links da página; `sem` tira algum deles (usado no "Limpar").
  function comAdmissao(params: URLSearchParams, sem: ("admissao" | "tipo")[] = []) {
    if (!sem.includes("admissao")) {
      if (admissaoDe) params.set("admissao_de", admissaoDe);
      if (admissaoAte) params.set("admissao_ate", admissaoAte);
    }
    if (tipo && !sem.includes("tipo")) params.set("tipo", tipo);
    return params;
  }

  function hrefTipo(novoTipo: string) {
    const params = new URLSearchParams();
    if (marco) params.set("marco", marco);
    if (status) params.set("status", status);
    comAdmissao(params, ["tipo"]);
    if (novoTipo) params.set("tipo", novoTipo);
    const query = params.toString();
    return query ? `/admin?${query}` : "/admin";
  }

  function hrefFiltro(extra: { status?: string }) {
    const params = new URLSearchParams();
    if (marco) params.set("marco", marco);
    if (extra.status) params.set("status", extra.status);
    comAdmissao(params);
    const query = params.toString();
    return query ? `/admin?${query}` : "/admin";
  }

  // Clique num pedaço da barra: filtra por aquele status. Na linha de um
  // período, filtra também pelo período; na linha "Total", por todos.
  function hrefStatusNoPeriodo(chaveStatus: string, periodo?: number) {
    const params = new URLSearchParams();
    if (periodo) params.set("marco", String(periodo));
    params.set("status", chaveStatus);
    comAdmissao(params);
    return `/admin?${params.toString()}`;
  }

  function hrefMarco(m: string) {
    const params = new URLSearchParams();
    if (m) params.set("marco", m);
    comAdmissao(params);
    const query = params.toString();
    return query ? `/admin?${query}` : "/admin";
  }

  type ChaveFiltro = "marco" | "status" | "admissao" | "tipo";

  // Mesma página, tirando só os filtros pedidos — usado no "✕" de cada
  // filtro ativo e no "Limpar tudo".
  function hrefSem(remover: ChaveFiltro[]) {
    const params = new URLSearchParams();
    if (marco && !remover.includes("marco")) params.set("marco", marco);
    if (status && !remover.includes("status")) params.set("status", status);
    comAdmissao(
      params,
      remover.filter((r): r is "admissao" | "tipo" => r === "admissao" || r === "tipo")
    );
    const query = params.toString();
    return query ? `/admin?${query}` : "/admin";
  }

  function hrefExportar(soPendentes = false) {
    const params = new URLSearchParams();
    if (soPendentes) params.set("pendentes", "1");
    if (marco) params.set("marco", marco);
    if (status) params.set("status", status);
    comAdmissao(params);
    const query = params.toString();
    return query ? `/admin/categorias/export?${query}` : "/admin/categorias/export";
  }

  // Datas ISO (yyyy-mm-dd) comparam certinho como string, sem precisar
  // converter pra Date. data_admissao é a data de início da trilha (admissão
  // do novato ou mudança de cargo da capacitação).
  function dentroDoPeriodoAdmissao(
    colaborador: { data_admissao: string | null; tipo?: string | null } | null | undefined
  ) {
    const dataAdmissao = colaborador?.data_admissao;
    if (!dataAdmissao) return false;
    if (admissaoDe && dataAdmissao < admissaoDe) return false;
    if (admissaoAte && dataAdmissao > admissaoAte) return false;
    if (tipo && (colaborador?.tipo ?? "novato") !== tipo) return false;
    return true;
  }

  const temFiltroAdmissao = !!(admissaoDe || admissaoAte || tipo);

  const dataBR = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
  const filtrosAtivos: { chave: ChaveFiltro; rotulo: string }[] = [
    ...(marco ? [{ chave: "marco" as const, rotulo: `Período: ${marco} dias` }] : []),
    ...(status && STATUS_FILTRO_LABEL[status]
      ? [{ chave: "status" as const, rotulo: `Status: ${STATUS_FILTRO_LABEL[status]}` }]
      : []),
    ...(admissaoDe || admissaoAte
      ? [
          {
            chave: "admissao" as const,
            rotulo:
              admissaoDe && admissaoAte
                ? `Início: ${dataBR(admissaoDe)} a ${dataBR(admissaoAte)}`
                : admissaoDe
                  ? `Início a partir de ${dataBR(admissaoDe)}`
                  : `Início até ${dataBR(admissaoAte!)}`,
          },
        ]
      : []),
    ...(tipo
      ? [{ chave: "tipo" as const, rotulo: tipo === "capacitacao" ? "Capacitação" : "Novato" }]
      : []),
  ];

  const sufixoFiltrosDosCards =
    status && STATUS_FILTRO_LABEL[status] ? ` — ${STATUS_FILTRO_LABEL[status]}` : "";
  const sufixoFiltros = (marco ? ` — ${marco} dias` : "") + sufixoFiltrosDosCards;

  let colaboradoresQuery = supabase
    .from("colaboradores")
    .select("*", { count: "exact", head: true })
    .eq("ativo", true);
  if (admissaoDe) colaboradoresQuery = colaboradoresQuery.gte("data_admissao", admissaoDe);
  if (admissaoAte) colaboradoresQuery = colaboradoresQuery.lte("data_admissao", admissaoAte);
  if (tipo) colaboradoresQuery = colaboradoresQuery.eq("tipo", tipo);

  const [
    { count: colaboradoresAtivosTotal },
    { data: avaliacoes },
    { data: categorias },
    { data: respostas },
    { data: colaboradoresParaMarcos },
  ] = await Promise.all([
    colaboradoresQuery,
    supabase
      .from("avaliacoes")
      .select(
        "id, marco, status, data_envio, data_resposta, motivo_nao_avaliada, observacao_nao_avaliada, colaboradores(id, nome, matricula, data_admissao, tipo, ativo, gestor_nome, gestor_email, cargos(nome)), links_avaliacao(expira_em)"
      )
      .order("data_referencia", { ascending: false }),
    supabase.from("categorias_treinamento").select("id, nome").eq("ativo", true).order("nome"),
    supabase
      .from("respostas")
      .select(
        `id, avaliacao_id, categoria_final_id, exportado_em, treinamento_realizado_em, ${SELECT_TREINAMENTOS}`
      )
      .not("categoria_final_id", "is", null),
    supabase
      .from("colaboradores")
      .select("id, nome, matricula, gestor_nome, data_admissao, tipo, estrutura_macro, turno, cargos(nome, marcos)")
      .eq("ativo", true),
  ]);

  const listaBase = avaliacoes ?? [];
  const lista = temFiltroAdmissao
    ? listaBase.filter((a) =>
        dentroDoPeriodoAdmissao(
          a.colaboradores as unknown as { data_admissao: string; tipo: string } | null
        )
      )
    : listaBase;
  const avaliacoesDoMarco = marcoNum ? lista.filter((a) => a.marco === marcoNum) : lista;

  // Filtro dos cards (status), aplicado por cima do
  // período/admissão. Os gráficos usam a mesma função pra acompanhar a tabela.
  function aplicarFiltrosDosCards(itens: typeof lista) {
    let resultado = itens;
    if (status && status in STATUS_FILTRO_LABEL) {
      resultado = resultado.filter((a) => a.status === status);
    }
    return resultado;
  }

  const avaliacoesFiltradas = aplicarFiltrosDosCards(avaliacoesDoMarco);

  // Treinamentos seguem exatamente os mesmos filtros da tabela (período,
  // admissão e status): só conta resposta de avaliação que
  // está na lista filtrada.
  const idsAvaliacoesFiltradas = new Set(avaliacoesFiltradas.map((a) => a.id));
  const respostasFiltradas = (respostas ?? []).filter((r) => idsAvaliacoesFiltradas.has(r.avaliacao_id));

  // Card "Treinamentos indicados": segue período/tipo/datas como os outros
  // cards (não os filtros de status), contando uma indicação por resposta.
  const idsAvaliacoesDoMarco = new Set(avaliacoesDoMarco.map((a) => a.id));
  const respostasDoMarco = (respostas ?? []).filter((r) => idsAvaliacoesDoMarco.has(r.avaliacao_id));
  const totalTreinamentosIndicados = respostasDoMarco.length;
  const competenciasIndicadas = new Set(respostasDoMarco.map((r) => r.categoria_final_id)).size;

  // Exportação: por avaliação (colaborador + período), quantas indicações
  // ainda não saíram em nenhum arquivo. Avaliação com qualquer indicação
  // pendente fica em "Falta exportar".
  const exportacaoPorAvaliacao = new Map<
    string,
    { pendentes: number; ultimaExportacao: string | null; treinamentosAFazer: number }
  >();
  for (const resposta of respostasFiltradas) {
    const atual = exportacaoPorAvaliacao.get(resposta.avaliacao_id) ?? {
      pendentes: 0,
      ultimaExportacao: null,
      treinamentosAFazer: 0,
    };
    atual.treinamentosAFazer += treinamentosPendentes([resposta as unknown as RespostaComIndicacao]);
    if (!resposta.exportado_em) atual.pendentes++;
    else if (!atual.ultimaExportacao || resposta.exportado_em > atual.ultimaExportacao) {
      atual.ultimaExportacao = resposta.exportado_em;
    }
    exportacaoPorAvaliacao.set(resposta.avaliacao_id, atual);
  }
  const indicacoesPendentesExportacao = respostasFiltradas.filter((r) => !r.exportado_em).length;
  const avaliacoesExportacao = avaliacoesFiltradas
    .filter((a) => exportacaoPorAvaliacao.has(a.id))
    .map((a) => {
      const colaborador = a.colaboradores as unknown as { id: string; nome: string; matricula: string | null } | null;
      return {
        id: a.id,
        colaboradorId: colaborador?.id ?? null,
        nome: colaborador?.nome ?? "",
        matricula: colaborador?.matricula ?? null,
        marco: a.marco,
        status: a.status,
        ...exportacaoPorAvaliacao.get(a.id)!,
      };
    });
  const faltaExportar = avaliacoesExportacao.filter((a) => a.pendentes > 0);
  // Exportada e finalizada (todo treinamento feito) sai da lista: não tem
  // mais nada a fazer com ela.
  const jaExportadas = avaliacoesExportacao.filter(
    (a) => a.pendentes === 0 && !(a.status === "respondida" && a.treinamentosAFazer === 0)
  );

  const contagemPorCategoria = new Map<string, number>();
  const treinamentosPorCategoria = new Map<string, Map<string, { nome: string; cargo: string | null; total: number }>>();
  for (const resposta of respostasFiltradas) {
    const categoriaId = resposta.categoria_final_id as string;
    contagemPorCategoria.set(categoriaId, (contagemPorCategoria.get(categoriaId) ?? 0) + 1);

    for (const item of itensDeTreinamento(resposta as unknown as RespostaComIndicacao)) {
      if (!item.treinamentoId || !item.nome) continue;
      if (!treinamentosPorCategoria.has(categoriaId)) treinamentosPorCategoria.set(categoriaId, new Map());
      const mapaDaCategoria = treinamentosPorCategoria.get(categoriaId)!;
      const atual = mapaDaCategoria.get(item.treinamentoId);
      mapaDaCategoria.set(item.treinamentoId, {
        nome: item.nome,
        cargo: item.cargo,
        total: (atual?.total ?? 0) + 1,
      });
    }
  }

  const nomeCategoria = new Map((categorias ?? []).map((c) => [c.id, c.nome]));
  // Rankings contam colaboradores distintos (não indicações): a mesma pessoa
  // indicada duas vezes no mesmo treinamento/competência conta uma vez. Cada
  // linha guarda quem foi indicado, pra abrir a lista ao clicar no número.
  const avaliacaoPorId = new Map(listaBase.map((a) => [a.id, a]));
  const pessoasPorTreinamento = new Map<string, Map<string, PessoaIndicada>>();
  const pessoasPorCompetencia = new Map<string, Map<string, PessoaIndicada>>();
  function anotarPessoa(mapa: Map<string, Map<string, PessoaIndicada>>, chave: string, avaliacaoId: string) {
    const avaliacao = avaliacaoPorId.get(avaliacaoId);
    const colaborador = avaliacao?.colaboradores as unknown as
      | { id: string; nome: string; matricula: string | null }
      | null
      | undefined;
    if (!avaliacao || !colaborador) return;
    const pessoas = mapa.get(chave) ?? new Map<string, PessoaIndicada>();
    const pessoa = pessoas.get(colaborador.id) ?? {
      id: colaborador.id,
      nome: colaborador.nome,
      matricula: colaborador.matricula,
      periodos: [],
    };
    if (!pessoa.periodos.includes(avaliacao.marco)) pessoa.periodos.push(avaliacao.marco);
    pessoas.set(colaborador.id, pessoa);
    mapa.set(chave, pessoas);
  }
  for (const resposta of respostasFiltradas) {
    anotarPessoa(pessoasPorCompetencia, resposta.categoria_final_id as string, resposta.avaliacao_id);
    for (const item of itensDeTreinamento(resposta as unknown as RespostaComIndicacao)) {
      if (item.treinamentoId) anotarPessoa(pessoasPorTreinamento, item.treinamentoId, resposta.avaliacao_id);
    }
  }
  const listaDePessoas = (mapa?: Map<string, PessoaIndicada>) =>
    [...(mapa?.values() ?? [])].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const hrefCompetencia = (id: string) => `/admin/categorias/${id}${marco ? `?marco=${marco}` : ""}`;

  const rankingTreinamentos: LinhaRanking[] = [...treinamentosPorCategoria.entries()]
    .flatMap(([categoriaId, mapa]) =>
      [...mapa.entries()].map(([treinamentoId, t]) => ({
        chave: treinamentoId,
        titulo: t.nome,
        detalheTitulo: t.cargo,
        subtitulo: nomeCategoria.get(categoriaId) ?? "",
        href: hrefCompetencia(categoriaId),
        indicacoes: t.total,
        pessoas: listaDePessoas(pessoasPorTreinamento.get(treinamentoId)),
      }))
    )
    .sort((a, b) => b.pessoas.length - a.pessoas.length || b.indicacoes - a.indicacoes)
    .slice(0, 6);

  const rankingCompetencias: LinhaRanking[] = [...pessoasPorCompetencia.entries()]
    .map(([categoriaId, pessoas]) => ({
      chave: categoriaId,
      titulo: nomeCategoria.get(categoriaId) ?? "Competência",
      detalheTitulo: null,
      // Treinamentos específicos indicados dentro da competência.
      subtitulo:
        [...(treinamentosPorCategoria.get(categoriaId)?.values() ?? [])]
          .sort((a, b) => b.total - a.total)
          .map((t) => t.nome)
          .join(", ") || null,
      href: hrefCompetencia(categoriaId),
      indicacoes: contagemPorCategoria.get(categoriaId) ?? 0,
      pessoas: listaDePessoas(pessoas),
    }))
    .sort((a, b) => b.pessoas.length - a.pessoas.length || b.indicacoes - a.indicacoes);

  // Server Component: roda uma vez por requisição, então ler o relógio aqui
  // é estável — não existe re-render no cliente pra dar valor diferente.
  // eslint-disable-next-line react-hooks/purity
  const agora = Date.now();

  // Marcos previstos pela admissão + cargo que ainda não viraram avaliação
  // (ex: colaborador cadastrado depois da rotina do dia, ou depois do marco).
  const hojeISO = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
  const marcosComAvaliacao = new Set(
    listaBase.map((a) => `${(a.colaboradores as unknown as { id: string } | null)?.id}:${a.marco}`)
  );
  const marcosPrevistos = (colaboradoresParaMarcos ?? [])
    .filter((c) => !temFiltroAdmissao || dentroDoPeriodoAdmissao(c))
    .flatMap((c) => {
      const cargo = c.cargos as unknown as { nome: string; marcos: number[] | null } | null;
      return (cargo?.marcos ?? MARCOS_PADRAO)
        .filter((m) => !marcosComAvaliacao.has(`${c.id}:${m}`))
        .map((m) => {
          const dataMarco = somarDiasISO(c.data_admissao, m);
          const diasAteMarco = diferencaDias(hojeISO, dataMarco);
          return {
            colaboradorId: c.id,
            nome: c.nome,
            matricula: c.matricula as string | null,
            gestorNome: c.gestor_nome as string,
            cargo: cargo?.nome ?? null,
            marco: m,
            dataMarco,
            diasAteMarco,
            // A rotina só recupera marco vencido há até DIAS_CATCHUP_ROTINA
            // dias; contando que ela roda amanhã, o limite é um dia antes.
            naoSeraGerada: diasAteMarco < -(DIAS_CATCHUP_ROTINA - 1),
          };
        });
    })
    .filter((p) => p.diasAteMarco <= DIAS_PROXIMAS && p.diasAteMarco >= -DIAS_MARCO_PERDIDO_VISIVEL);

  // Períodos que já chegaram sem avaliação, sem olhar os filtros dos cards —
  // usado no total dos botões de período, que também ignoram esses filtros.
  const periodosSemAvaliacao = marcosPrevistos.filter((p) => p.diasAteMarco <= 0);

  // Filtro de status é sobre avaliações que já existem. Só
  // "Não enviadas" combina com marco previsto — nos outros, eles saem.
  const incluirPrevistos = !status || status === "pendente";

  // Marco que já chegou e não tem avaliação conta como "Não enviada" no card
  // e nas barras. Marco futuro não conta: ainda não era pra ter saído.
  const previstosVencidos = incluirPrevistos ? marcosPrevistos.filter((p) => p.diasAteMarco <= 0) : [];
  const previstosVencidosDoMarco = (m: number | null) =>
    previstosVencidos.filter((p) => !m || p.marco === m).length;

  // "Próximas avaliações" só aparece com o filtro "Não enviadas" (card lá em
  // cima ou pedaço violeta do gráfico). Fora dele, só os casos que a rotina
  // não vai gerar sozinha viram um alerta, pra não passarem despercebidos.
  const mostrarProximas = status === "pendente";
  const precisamEnvioManual = marcosPrevistos.filter(
    (p) => p.naoSeraGerada && (!marcoNum || p.marco === marcoNum)
  ).length;

  const proximasAvaliacoesTodas = (incluirPrevistos ? marcosPrevistos : [])
    .filter((p) => !marcoNum || p.marco === marcoNum)
    .sort((a, b) => {
      if (a.naoSeraGerada !== b.naoSeraGerada) return a.naoSeraGerada ? -1 : 1;
      return a.diasAteMarco - b.diasAteMarco;
    });

  // "Já chegaram" são as mesmas que o card e a tabela contam como "Não
  // enviadas"; "nos próximos dias" ainda não era pra ter saído e fica à parte.
  const proximasJaChegaram = proximasAvaliacoesTodas.filter((p) => p.diasAteMarco <= 0);
  const proximasFuturas = proximasAvaliacoesTodas.filter((p) => p.diasAteMarco > 0);

  const totalRespondidas = avaliacoesDoMarco.filter((a) => a.status === "respondida").length;
  // Base das porcentagens dos cards: avaliações do período, contando os
  // períodos que já chegaram sem avaliação criada (mesmo total dos botões).
  const totalAvaliacoesDoPeriodo =
    avaliacoesDoMarco.length + periodosSemAvaliacao.filter((p) => !marcoNum || p.marco === marcoNum).length;
  const porcentagem = (valor: number, base: number, sufixo: string) => {
    if (base <= 0) return {};
    const valorPct = Math.round((valor / base) * 100);
    return { detalhe: `${valorPct}% ${sufixo}`, progresso: valorPct };
  };
  const totalPendente =
    avaliacoesDoMarco.filter((a) => a.status === "pendente").length + previstosVencidosDoMarco(marcoNum);
  const totalEnviada = avaliacoesDoMarco.filter((a) => a.status === "enviada").length;
  const totalExpiradas = avaliacoesDoMarco.filter((a) => a.status === "expirada").length;

  // Tempo médio de resposta: só entre quem já respondeu e tem as duas datas
  // registradas — não dá pra medir tempo de quem ainda está pendente.
  const respondidasComTempo = avaliacoesDoMarco.filter(
    (a) => a.status === "respondida" && a.data_envio && a.data_resposta
  );
  const tempoMedioRespostaDias = respondidasComTempo.length
    ? respondidasComTempo.reduce((soma, a) => {
        const dias =
          (new Date(a.data_resposta!).getTime() - new Date(a.data_envio!).getTime()) /
          (24 * 60 * 60 * 1000);
        return soma + dias;
      }, 0) / respondidasComTempo.length
    : null;

  const colaboradoresAtivos = marcoNum
    ? new Set(
        avaliacoesDoMarco
          .map((a) => (a.colaboradores as unknown as { id: string } | null)?.id)
          .filter(Boolean)
      ).size
    : colaboradoresAtivosTotal ?? 0;

  const listaComFiltrosDosCards = aplicarFiltrosDosCards(lista);
  const progressoPorMarco = MARCOS.map((m) => {
    const doMarco = listaComFiltrosDosCards.filter((a) => a.marco === m);
    const previstos = previstosVencidosDoMarco(m);
    return {
      marco: m,
      total: doMarco.length + previstos,
      porStatus: STATUS_VISUAL.map((st) => ({
        ...st,
        valor:
          doMarco.filter((a) => a.status === st.chave).length + (st.chave === "pendente" ? previstos : 0),
      })),
    };
  });

  // Período sem nenhuma avaliação não entra no gráfico (vai aparecendo
  // conforme surgem avaliações). Com um período escolhido nos botões lá em
  // cima, o gráfico mostra só ele, mesmo zerado.
  const periodosNoGrafico = marcoNum
    ? progressoPorMarco.filter((l) => l.marco === marcoNum)
    : progressoPorMarco.filter((l) => l.total > 0);

  // Linha "Total" no topo das barras: soma de todos os períodos.
  const progressoTotal = {
    total: listaComFiltrosDosCards.length + previstosVencidos.length,
    porStatus: STATUS_VISUAL.map((st) => ({
      ...st,
      valor:
        listaComFiltrosDosCards.filter((a) => a.status === st.chave).length +
        (st.chave === "pendente" ? previstosVencidos.length : 0),
    })),
  };

  // Prazo de resposta (antes ficava no card "Requer atenção", agora é uma
  // coluna da tabela). Só existe pra avaliação enviada ou expirada. Urgente =
  // já expirou ou vence em até DIAS_URGENCIA dias.
  const DIA_MS = 24 * 60 * 60 * 1000;
  function prazoDe(statusAvaliacao: string, expiraEm: string | null) {
    if (!expiraEm || (statusAvaliacao !== "enviada" && statusAvaliacao !== "expirada")) return null;
    const expiraEmMs = new Date(expiraEm).getTime();
    const dias = Math.ceil((expiraEmMs - agora) / DIA_MS);
    if (statusAvaliacao === "expirada" || expiraEmMs < agora) {
      return { texto: `Expirou há ${Math.max(1, -dias)} dia(s)`, urgente: true };
    }
    return { texto: `Faltam ${Math.max(0, dias)} dia(s)`, urgente: expiraEmMs - agora <= DIAS_URGENCIA * DIA_MS };
  }

  // Por avaliação: quantos treinamentos o gestor indicou e quantos o admin
  // já marcou como feitos. Respondida com tudo feito = finalizada.
  const treinamentosPorAvaliacao = new Map<string, { indicados: number; feitos: number }>();
  for (const resposta of respostas ?? []) {
    const atual = treinamentosPorAvaliacao.get(resposta.avaliacao_id) ?? { indicados: 0, feitos: 0 };
    for (const item of itensDeTreinamento(resposta as unknown as RespostaComIndicacao)) {
      atual.indicados++;
      if (item.realizadoEm) atual.feitos++;
    }
    treinamentosPorAvaliacao.set(resposta.avaliacao_id, atual);
  }

  const avaliacoesCriadasParaTabela: AvaliacaoLinha[] = avaliacoesFiltradas.map((a) => {
    const colaborador = a.colaboradores as unknown as {
      id: string;
      nome: string;
      matricula: string | null;
      gestor_nome: string;
      gestor_email: string;
      cargos: { nome: string } | null;
    } | null;
    // Com lembretes a avaliação tem vários links; vale o mais recente.
    const expiraEm =
      (a.links_avaliacao as unknown as { expira_em: string }[])
        .map((l) => l.expira_em)
        .sort()
        .at(-1) ?? null;
    const treinamentos = treinamentosPorAvaliacao.get(a.id) ?? { indicados: 0, feitos: 0 };

    return {
      id: a.id,
      marco: a.marco,
      status: a.status,
      dataResposta: a.data_resposta,
      expiraEm,
      colaboradorId: colaborador?.id ?? null,
      colaboradorNome: colaborador?.nome ?? "",
      matricula: colaborador?.matricula ?? null,
      gestorNome: colaborador?.gestor_nome ?? "",
      cargo: colaborador?.cargos?.nome ?? null,
      prazo: prazoDe(a.status, expiraEm),
      motivoNaoAvaliada: a.motivo_nao_avaliada,
      observacaoNaoAvaliada: a.observacao_nao_avaliada,
      treinamentosIndicados: treinamentos.indicados,
      treinamentosFeitos: treinamentos.feitos,
    };
  });

  // O que precisa de ação vem primeiro: urgentes, não enviadas, aguardando
  // (vencimento mais próximo antes) e, por fim, o resto na ordem original.
  const ordemDaLinha = (l: AvaliacaoLinha) =>
    l.prazo?.urgente ? 0 : l.status === "pendente" ? 1 : l.status === "enviada" ? 2 : 3;
  avaliacoesCriadasParaTabela.sort((a, b) => {
    const diferenca = ordemDaLinha(a) - ordemDaLinha(b);
    if (diferenca !== 0) return diferenca;
    if (ordemDaLinha(a) <= 2) {
      return new Date(a.expiraEm ?? 0).getTime() - new Date(b.expiraEm ?? 0).getTime();
    }
    return 0;
  });

  // Os mesmos períodos que o card "Não enviadas" conta sem avaliação criada
  // entram aqui também — senão o card diz 2 e a tabela mostra 0.
  const avaliacoesParaTabela: AvaliacaoLinha[] = [
    ...previstosVencidos
      .filter((p) => !marcoNum || p.marco === marcoNum)
      .sort((a, b) => b.dataMarco.localeCompare(a.dataMarco))
      .map((p) => ({
        id: `previsto:${p.colaboradorId}:${p.marco}`,
        marco: p.marco,
        status: "pendente",
        dataResposta: null,
        expiraEm: null,
        colaboradorId: p.colaboradorId,
        colaboradorNome: p.nome,
        matricula: p.matricula,
        gestorNome: p.gestorNome,
        cargo: p.cargo,
        prazo: null,
        previstaPara: p.dataMarco,
      })),
    ...avaliacoesCriadasParaTabela,
  ];


  // Competências sem nenhuma indicação ficam recolhidas embaixo do ranking.
  const categoriasSemIndicacao = (categorias ?? []).filter((c) => !contagemPorCategoria.get(c.id));

  // Quantos colaboradores ativos (com os filtros de tipo/datas) já fecharam
  // todos os períodos do cargo — aparece embaixo do card "Colaboradores".
  const trilhaPorColaborador = new Map<string, AvaliacaoDaTrilha[]>();
  for (const a of listaBase) {
    const id = (a.colaboradores as unknown as { id: string } | null)?.id;
    if (!id) continue;
    const treinamentos = treinamentosPorAvaliacao.get(a.id) ?? { indicados: 0, feitos: 0 };
    const lista = trilhaPorColaborador.get(id) ?? [];
    lista.push({ marco: a.marco, status: a.status, treinamentosPendentes: treinamentos.indicados - treinamentos.feitos });
    trilhaPorColaborador.set(id, lista);
  }
  const trilhasConcluidas = (colaboradoresParaMarcos ?? []).filter(
    (c) =>
      (!temFiltroAdmissao || dentroDoPeriodoAdmissao(c)) &&
      trilhaConcluida(
        (c.cargos as unknown as { marcos: number[] | null } | null)?.marcos,
        trilhaPorColaborador.get(c.id) ?? []
      )
  ).length;

  // Trajetória: pra cada colaborador ativo (filtros de tipo/datas), a
  // situação de cada período do cargo dele — finalizado, em andamento ou a
  // data em que vai chegar.
  const avaliacaoDoPeriodo = new Map(
    listaBase.map((a) => [`${(a.colaboradores as unknown as { id: string } | null)?.id}:${a.marco}`, a])
  );
  const trajetorias: LinhaTrajetoria[] = (colaboradoresParaMarcos ?? [])
    .filter((c) => !temFiltroAdmissao || dentroDoPeriodoAdmissao(c))
    .map((c) => {
      const cargo = c.cargos as unknown as { nome: string; marcos: number[] | null } | null;
      const periodos = [...(cargo?.marcos?.length ? cargo.marcos : MARCOS_PADRAO)].sort((a, b) => a - b);
      return {
        id: c.id,
        nome: c.nome,
        detalhe: [cargo?.nome ?? "Sem cargo", c.estrutura_macro].filter(Boolean).join(" · "),
        periodos: periodos.map((marco): PeriodoTrajetoria => {
          const dataPeriodo = somarDiasISO(c.data_admissao, marco);
          const a = avaliacaoDoPeriodo.get(`${c.id}:${marco}`);
          if (!a) {
            return { marco, estado: dataPeriodo > hojeISO ? "futuro" : "nao_enviada", data: dataPeriodo };
          }
          if (a.status === "respondida") {
            const t = treinamentosPorAvaliacao.get(a.id) ?? { indicados: 0, feitos: 0 };
            return { marco, estado: t.feitos >= t.indicados ? "ok" : "treinamento", data: null };
          }
          if (a.status === "nao_avaliada") {
            return { marco, estado: a.motivo_nao_avaliada === "desligado" ? "desligado" : "afastado", data: null };
          }
          if (a.status === "enviada") {
            const prazo =
              (a.links_avaliacao as unknown as { expira_em: string }[])
                .map((l) => l.expira_em)
                .sort()
                .at(-1) ?? null;
            return { marco, estado: "aguardando", data: prazo };
          }
          if (a.status === "expirada") return { marco, estado: "expirada", data: null };
          return { marco, estado: "nao_enviada", data: dataPeriodo };
        }),
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  // Card por estrutura macro: os mesmos colaboradores do card "Colaboradores"
  // (ativos, filtro de tipo/datas; com período escolhido, só quem tem
  // avaliação nele), agrupados por estrutura e contados por turno. Com um
  // card de status clicado, só quem tem avaliação nesse
  // status — incluindo os períodos que chegaram sem avaliação criada, que
  // contam como "Não enviadas".
  const idDoColaborador = (a: { colaboradores: unknown }) =>
    (a.colaboradores as unknown as { id: string } | null)?.id;
  const idsNoPeriodo =
    status
      ? new Set([
          ...avaliacoesFiltradas.map(idDoColaborador),
          ...previstosVencidos.filter((p) => !marcoNum || p.marco === marcoNum).map((p) => p.colaboradorId),
        ])
      : marcoNum
        ? new Set(avaliacoesDoMarco.map(idDoColaborador))
        : null;
  const porEstrutura = new Map<string, { total: number; turnos: Map<string, number> }>();
  for (const c of colaboradoresParaMarcos ?? []) {
    if (temFiltroAdmissao && !dentroDoPeriodoAdmissao(c)) continue;
    if (idsNoPeriodo && !idsNoPeriodo.has(c.id)) continue;
    const estrutura = (c.estrutura_macro as string | null) ?? "";
    const grupo = porEstrutura.get(estrutura) ?? { total: 0, turnos: new Map<string, number>() };
    grupo.total++;
    const turno = (c.turno as string | null) ?? "";
    grupo.turnos.set(turno, (grupo.turnos.get(turno) ?? 0) + 1);
    porEstrutura.set(estrutura, grupo);
  }
  // Maiores primeiro; "Não informada" sempre por último.
  const estruturas: LinhaEstrutura[] = [...porEstrutura.entries()]
    .map(([nome, grupo]) => ({
      nome: nome || "Não informada",
      informada: !!nome,
      total: grupo.total,
      turnos: Object.fromEntries(grupo.turnos),
    }))
    .sort((a, b) => Number(b.informada) - Number(a.informada) || b.total - a.total);

  const totalUrgentes = avaliacoesParaTabela.filter((l) => l.prazo?.urgente).length;

  // Gestor marcou "desligado" no link mas o colaborador ainda está ativo: o
  // DHO confere e inativa no cadastro (o sistema não inativa sozinho).
  const desligadosParaConferir = [
    ...new Map(
      listaBase
        .filter((a) => a.status === "nao_avaliada" && a.motivo_nao_avaliada === "desligado")
        .map((a) => a.colaboradores as unknown as { id: string; nome: string; ativo: boolean } | null)
        .filter((c): c is { id: string; nome: string; ativo: boolean } => !!c && c.ativo)
        .map((c) => [c.id, c])
    ).values(),
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* O menu já diz em que página está; o título fica só pro leitor de tela. */}
      <h1 className="sr-only">Visão geral</h1>

      {/* Tudo numa linha: períodos, tipo, filtro de data de início e filtros ativos. Em
          tela menor quebra; no celular só a linha de botões rola pro lado. */}
      <div className="-mt-2 flex flex-wrap items-end gap-3">
        <div className="flex w-full min-w-0 flex-col gap-1 sm:w-auto">
          {/* Os números dos botões são avaliações, não pessoas — quem já
              passou de mais de um período conta mais de uma vez. */}
          <span className="text-xs text-zinc-500">Período (nº de avaliações)</span>
          {/* Mesmo formato do filtro de Tipo; no celular rola pro lado. */}
          <div className="flex w-fit max-w-full overflow-x-auto rounded-lg border border-primary-border text-xs font-medium">
            {MARCOS_FILTRO.map((opcao) => {
              const ativo = (marco ?? "") === opcao.valor;
              const total = opcao.valor
                ? lista.filter((a) => a.marco === Number(opcao.valor)).length +
                  periodosSemAvaliacao.filter((p) => p.marco === Number(opcao.valor)).length
                : lista.length + periodosSemAvaliacao.length;
              return (
                <Link
                  key={opcao.label}
                  href={hrefMarco(opcao.valor)}
                  className={`flex shrink-0 items-center gap-1 whitespace-nowrap border-r border-primary-border px-2.5 py-2 transition-colors last:border-r-0 ${
                    ativo
                      ? "bg-primary text-primary-foreground"
                      : total === 0
                        ? "text-zinc-400 hover:bg-primary-soft"
                        : "text-primary hover:bg-primary-soft"
                  }`}
                >
                  {opcao.label}
                  {total > 0 && (
                    <span
                      className={`rounded-full px-1.5 text-[10px] tabular-nums ${
                        ativo ? "bg-white/25" : "bg-primary-soft"
                      }`}
                    >
                      {total}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-zinc-500">Tipo</span>
          <div className="flex overflow-hidden rounded-lg border border-primary-border text-xs font-medium">
            {[
              { valor: "", rotulo: "Todos" },
              { valor: "novato", rotulo: "Novato" },
              { valor: "capacitacao", rotulo: "Capacitação" },
            ].map((opcao) => (
              <Link
                key={opcao.rotulo}
                href={hrefTipo(opcao.valor)}
                className={`whitespace-nowrap border-r border-primary-border px-2.5 py-2 transition-colors last:border-r-0 ${
                  (tipo ?? "") === opcao.valor
                    ? "bg-primary text-primary-foreground"
                    : "text-primary hover:bg-primary-soft"
                }`}
              >
                {opcao.rotulo}
              </Link>
            ))}
          </div>
        </div>
        <form method="get" action="/admin" className="flex flex-wrap items-end gap-2">
          {marco && <input type="hidden" name="marco" value={marco} />}
          {status && <input type="hidden" name="status" value={status} />}
          {tipo && <input type="hidden" name="tipo" value={tipo} />}
          <div className="flex flex-col gap-1">
            {/* Data de início: admissão (novato) ou mudança de cargo (capacitação). */}
            <label
              htmlFor="admissao_de"
              title="Data de admissão (novato) ou de mudança de cargo (capacitação)"
              className="text-xs text-zinc-500"
            >
              Início de
            </label>
            <input
              id="admissao_de"
              type="date"
              name="admissao_de"
              defaultValue={admissaoDe ?? ""}
              className="w-36 rounded-md border border-black/15 px-2 py-1.5 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="admissao_ate" className="text-xs text-zinc-500">
              até
            </label>
            <input
              id="admissao_ate"
              type="date"
              name="admissao_ate"
              defaultValue={admissaoAte ?? ""}
              className="w-36 rounded-md border border-black/15 px-2 py-1.5 text-sm outline-none focus:border-primary"
            />
          </div>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            <CalendarDays className="h-4 w-4" />
            Filtrar
          </button>
          {/* Qualquer filtro ligado (período, status, tipo ou
              admissão) mostra o botão; ele volta a página sem filtro nenhum. */}
          {filtrosAtivos.length > 0 && (
            <Link
              href={hrefSem(["marco", "status", "admissao", "tipo"])}
              className="flex items-center gap-1.5 rounded-md border border-primary-border px-3 py-1.5 text-sm text-primary hover:bg-primary-soft"
            >
              <X className="h-4 w-4" />
              Limpar filtros
            </Link>
          )}
        </form>
      </div>

      {/* 7 cards: numa linha em tela grande; 4 por linha no tablet, 2 no celular. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Card
          icon={Users}
          label={marcoNum ? "Colaboradores neste período" : "Colaboradores ativos"}
          value={colaboradoresAtivos}
          detalhe={!marcoNum && trilhasConcluidas > 0 ? `${trilhasConcluidas} com trilha concluída` : undefined}
          href={hrefFiltro({})}
          ativo={!status}
          tone="brand"
        />
        <Card
          icon={Hourglass}
          label="Não enviadas"
          value={totalPendente}
          {...porcentagem(totalPendente, totalAvaliacoesDoPeriodo, "do total")}
          href={status === "pendente" ? hrefFiltro({}) : hrefFiltro({ status: "pendente" })}
          ativo={status === "pendente"}
          tone="blue"
        />
        <Card
          icon={Clock}
          label="Aguardando resposta"
          value={totalEnviada}
          {...porcentagem(totalEnviada, totalAvaliacoesDoPeriodo, "do total")}
          href={status === "enviada" ? hrefFiltro({}) : hrefFiltro({ status: "enviada" })}
          ativo={status === "enviada"}
          tone="orange"
        />
        <Card
          icon={CheckCircle2}
          label="Respondidas"
          value={totalRespondidas}
          {...porcentagem(totalRespondidas, totalAvaliacoesDoPeriodo, "do total")}
          href={status === "respondida" ? hrefFiltro({}) : hrefFiltro({ status: "respondida" })}
          ativo={status === "respondida"}
          tone="green"
        />
        <Card
          icon={XCircle}
          label="Expiradas"
          value={totalExpiradas}
          {...porcentagem(totalExpiradas, totalAvaliacoesDoPeriodo, "do total")}
          href={status === "expirada" ? hrefFiltro({}) : hrefFiltro({ status: "expirada" })}
          ativo={status === "expirada"}
          tone="red"
        />
        <Card
          icon={GraduationCap}
          label="Treinamentos indicados"
          value={totalTreinamentosIndicados}
          detalhe={
            competenciasIndicadas > 0
              ? `em ${competenciasIndicadas} competência${competenciasIndicadas === 1 ? "" : "s"}`
              : undefined
          }
          href="#treinamentos-indicados"
          tone="violet"
        />
        <Card
          icon={Timer}
          label="Tempo médio de resposta"
          value={formatarTempoResposta(tempoMedioRespostaDias)}
          tone="teal"
        />
      </div>

      {desligadosParaConferir.length > 0 && (
        <div className="-mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <UserX className="h-4 w-4 shrink-0" />
          <span>
            {desligadosParaConferir.length === 1
              ? "1 colaborador foi informado como desligado pelo gestor"
              : `${desligadosParaConferir.length} colaboradores foram informados como desligados pelo gestor`}
            {" — confira e inative no cadastro:"}
          </span>
          {desligadosParaConferir.map((c, i) => (
            <span key={c.id}>
              <Link href={`/admin/colaboradores/${c.id}`} className="font-medium underline underline-offset-2">
                {c.nome}
              </Link>
              {i < desligadosParaConferir.length - 1 ? "," : ""}
            </span>
          ))}
        </div>
      )}

      {precisamEnvioManual > 0 && !mostrarProximas && (
        <div className="-mt-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {precisamEnvioManual === 1
              ? "1 avaliação precisa de envio manual"
              : `${precisamEnvioManual} avaliações precisam de envio manual`}
            <span className="text-xs text-red-600/80">
              (período passou há mais de {DIAS_CATCHUP_ROTINA - 1} dias; a rotina não gera sozinha)
            </span>
          </span>
          <Link
            href={hrefFiltro({ status: "pendente" })}
            className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
          >
            Ver
          </Link>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
      <div className="min-w-0">
        <h2 className="mb-3 font-medium">Status por período{sufixoFiltros}</h2>
        <div className="flex flex-col gap-2 rounded-lg border border-primary-border p-4">
          <div className="mb-1 flex flex-wrap items-center gap-4 text-xs text-zinc-500">
            {STATUS_VISUAL.map((st) => (
              <LegendaCor key={st.chave} cor={st.cor} label={st.label} />
            ))}
            <span className="ml-auto text-zinc-400">Clique numa cor pra filtrar</span>
          </div>
          {/* Com um período só, a linha "Total" repetiria a dele. */}
          {!marcoNum && (
            <>
              <BarraStatus
                rotulo="Total"
                linha={progressoTotal}
                destaque
                hrefSegmento={(chave) => hrefStatusNoPeriodo(chave)}
              />
              <div className="my-1 border-t border-primary-border/50" />
            </>
          )}
          {periodosNoGrafico.length === 0 && (
            <p className="py-2 text-center text-xs text-zinc-500">Nenhuma avaliação nos períodos com esses filtros.</p>
          )}
          {periodosNoGrafico.map((linha) => (
            <BarraStatus
              key={linha.marco}
              rotulo={`${linha.marco} dias`}
              linha={linha}
              hrefRotulo={hrefMarco(String(linha.marco))}
              hrefSegmento={(chave) => hrefStatusNoPeriodo(chave, linha.marco)}
            />
          ))}
        </div>
      </div>

      <div className="min-w-0">
        <EstruturasCard linhas={estruturas} sufixoTitulo={sufixoFiltrosDosCards} />
      </div>

      {mostrarProximas && (
        <div className="flex min-w-0 flex-col xl:col-span-2">
          <h2 className="mb-3 font-medium">Próximas avaliações{marco ? ` — ${marco} dias` : ""}</h2>
          <div className="flex min-h-0 flex-1 flex-col gap-2 rounded-lg border border-primary-border p-4">
            <p className="text-xs text-zinc-500">
              A rotina cria e envia automaticamente às 9h. Os que já chegaram são os mesmos contados em
              &quot;Não enviadas&quot;.
            </p>
            {proximasAvaliacoesTodas.length === 0 ? (
              <p className="py-6 text-center text-xs text-zinc-500">Nenhuma avaliação prevista nos próximos dias.</p>
            ) : (
              <div className="flex max-h-[340px] flex-col gap-3 overflow-y-auto pr-1">
                {[
                  { titulo: "Já chegaram, sem avaliação", itens: proximasJaChegaram },
                  { titulo: `Chegam nos próximos ${DIAS_PROXIMAS} dias`, itens: proximasFuturas },
                ]
                  .filter((grupo) => grupo.itens.length > 0)
                  .map((grupo) => (
                    <div key={grupo.titulo} className="flex flex-col gap-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        {grupo.titulo} ({grupo.itens.length})
                      </h3>
                      <ul className="flex flex-col gap-2">
                        {grupo.itens.map((p) => (
            <li
              key={`${p.colaboradorId}:${p.marco}`}
              className={`flex shrink-0 items-center justify-between gap-3 rounded-md border-l-4 px-3 py-1.5 text-xs ${
                p.naoSeraGerada ? "border-red-500 bg-red-50/60" : "border-transparent bg-primary-soft/30"
              }`}
            >
              <div className="min-w-0">
                <Link
                  href={`/admin/colaboradores/${p.colaboradorId}`}
                  className="text-[13px] font-semibold text-zinc-900 hover:underline"
                >
                  {p.nome}
                </Link>
                <div className="text-[11px] text-zinc-500">
                  Avaliação de {p.marco} dias · {new Date(p.dataMarco + "T00:00:00").toLocaleDateString("pt-BR")}
                </div>
                <div className={`text-[11px] font-medium ${p.naoSeraGerada ? "text-red-600" : "text-primary"}`}>
                  {p.naoSeraGerada
                    ? `Passou há ${-p.diasAteMarco} dias — não será gerada automaticamente`
                    : p.diasAteMarco < 0
                      ? `Passou há ${-p.diasAteMarco} dia(s) — será criada na próxima rotina`
                      : p.diasAteMarco === 0
                        ? "Hoje — será criada na próxima rotina"
                        : p.diasAteMarco === 1
                          ? "Amanhã"
                          : `Em ${p.diasAteMarco} dias`}
                </div>
              </div>
              {p.diasAteMarco <= 0 && (
                <EnviarAgoraButton colaboradorId={p.colaboradorId} marco={p.marco} rotulo="Enviar agora" />
              )}
            </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
      </div>

      <TrajetoriaCard linhas={trajetorias} />

      <div className="flex min-w-0 flex-col">
        <h2 className="mb-3 flex flex-wrap items-center gap-2 font-medium">
          <span>
            Avaliações{marco ? ` de ${marco} dias` : ""}
            {status && STATUS_FILTRO_LABEL[status] ? ` — ${STATUS_FILTRO_LABEL[status]}` : ""}
          </span>
          {totalUrgentes > 0 && (
            <span
              title={`Expiradas ou vencendo em até ${DIAS_URGENCIA} dias`}
              className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-medium text-white"
            >
              {totalUrgentes} urgente{totalUrgentes === 1 ? "" : "s"}
            </span>
          )}
        </h2>
        {/* Card "Respondidas" (ou filtro de não avaliadas) abre direto na aba Respondidas. */}
        <AvaliacoesTable
          avaliacoes={avaliacoesParaTabela}
          abaInicial={status === "respondida" || status === "nao_avaliada" ? "respondidas" : "andamento"}
        />
      </div>

      <div id="treinamentos-indicados" className="scroll-mt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">Treinamentos indicados{sufixoFiltros}</h2>
          <div className="flex flex-wrap gap-2">
            {indicacoesPendentesExportacao > 0 && (
              <ExportarLink href={hrefExportar(true)} destaque>
                Exportar só as novas ({indicacoesPendentesExportacao})
              </ExportarLink>
            )}
            <ExportarLink href={hrefExportar()}>Exportar tudo</ExportarLink>
          </div>
        </div>
        {avaliacoesExportacao.length > 0 && (
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <ListaExportacao
              titulo="Falta exportar"
              itens={faltaExportar}
              vazio="Tudo já foi exportado."
              tom="pendente"
            />
            <ListaExportacao
              titulo="Já exportadas"
              itens={jaExportadas}
              vazio="Nenhuma. As exportadas e já finalizadas saem desta lista."
              tom="feito"
            />
          </div>
        )}
        <div className="grid gap-6 lg:grid-cols-2">
          <QuadroRanking
            titulo="Ranking de competências indicadas"
            descricao={`${respostasFiltradas.length} indicaç${respostasFiltradas.length === 1 ? "ão" : "ões"} de treinamento · quantos colaboradores por competência.`}
            vazio={
              (categorias ?? []).length === 0
                ? "Nenhuma competência cadastrada."
                : "Nenhuma indicação de treinamento com esses filtros."
            }
            linhas={rankingCompetencias}
          >
            {categoriasSemIndicacao.length > 0 && (
              <details className="group/sem px-1 text-xs">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs text-zinc-500 hover:text-primary">
                  <ChevronRight className="h-3.5 w-3.5 transition-transform group-open/sem:rotate-90" />
                  {categoriasSemIndicacao.length} competência{categoriasSemIndicacao.length === 1 ? "" : "s"} sem
                  indicação
                </summary>
                <ul className="mt-2 flex flex-col gap-1 pl-5">
                  {categoriasSemIndicacao.map((categoria) => (
                    <li key={categoria.id}>
                      <Link href={hrefCompetencia(categoria.id)} className="text-zinc-500 hover:text-primary">
                        {categoria.nome}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </QuadroRanking>
          <QuadroRanking
            titulo="Ranking de treinamentos indicados"
            descricao="Quantos colaboradores foram indicados pra cada treinamento."
            vazio="Nenhum treinamento indicado ainda."
            linhas={rankingTreinamentos}
          />
        </div>
      </div>


      <Link href="/admin/colaboradores" className="w-fit text-sm text-primary underline underline-offset-2">
        Ver todos os colaboradores →
      </Link>
    </div>
  );
}

type PessoaIndicada = { id: string; nome: string; matricula: string | null; periodos: number[] };

type LinhaRanking = {
  chave: string;
  titulo: string;
  // Aparece clarinho ao lado do título (ex: cargo do treinamento).
  detalheTitulo: string | null;
  subtitulo: string | null;
  // Página da competência (link "Ver competência" dentro da linha aberta).
  href: string;
  indicacoes: number;
  pessoas: PessoaIndicada[];
};

// Quadro de ranking (competências ou treinamentos): posição, nome, subtítulo
// e quantos colaboradores; clicar na linha abre quem foi indicado.
function QuadroRanking({
  titulo,
  descricao,
  vazio,
  linhas,
  children,
}: {
  titulo: string;
  descricao: string;
  vazio: string;
  linhas: LinhaRanking[];
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-primary-soft/40 p-4">
      <div>
        <h3 className="text-sm font-medium">{titulo}</h3>
        <p className="text-xs text-zinc-500">{descricao}</p>
      </div>
      {linhas.length === 0 ? (
        <p className="text-xs text-zinc-500">{vazio}</p>
      ) : (
        <ol className="flex flex-col divide-y divide-primary-border/50 rounded-md bg-white">
          {linhas.map((linha, i) => (
            <li key={linha.chave}>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5 hover:bg-primary-soft/30">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-zinc-900">
                      {linha.titulo}
                      {linha.detalheTitulo && (
                        <span className="font-normal text-zinc-400"> · {linha.detalheTitulo}</span>
                      )}
                    </span>
                    {linha.subtitulo && (
                      <span className="block truncate text-xs text-zinc-500">{linha.subtitulo}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-right leading-tight" title="Ver quem foi indicado">
                    <span className="block text-base font-bold tabular-nums text-primary underline-offset-2 group-hover:underline">
                      {linha.pessoas.length}
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      {linha.pessoas.length === 1 ? "colaborador" : "colaboradores"}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400 transition-transform group-open:rotate-90" />
                </summary>
                <div className="flex flex-col gap-1 border-t border-primary-border/40 bg-primary-soft/20 px-3 py-2 pl-12 text-xs">
                  <ul className="flex flex-col gap-1">
                    {linha.pessoas.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3">
                        <Link
                          href={`/admin/colaboradores/${p.id}`}
                          className="min-w-0 truncate text-primary underline-offset-2 hover:underline"
                        >
                          {p.matricula && <span className="mr-1.5 text-zinc-500">{p.matricula}</span>}
                          {p.nome}
                        </Link>
                        <span className="shrink-0 text-zinc-500">
                          {[...p.periodos].sort((a, b) => a - b).map((m) => `${m} dias`).join(", ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Link href={linha.href} className="mt-1 w-fit text-zinc-500 underline-offset-2 hover:text-primary hover:underline">
                    Ver competência →
                  </Link>
                </div>
              </details>
            </li>
          ))}
        </ol>
      )}
      {children}
    </div>
  );
}

// Uma linha do gráfico: barra dividida por status, com a porcentagem escrita
// dentro de cada pedaço (só quando o pedaço é largo o bastante pro texto).
// O nome do período filtra pelo período; cada pedaço filtra pelo status.
function BarraStatus({
  rotulo,
  linha,
  hrefRotulo,
  hrefSegmento,
  destaque,
}: {
  rotulo: string;
  linha: { total: number; porStatus: readonly { chave: string; label: string; cor: string; valor: number }[] };
  hrefRotulo?: string;
  hrefSegmento?: (chaveStatus: string) => string;
  destaque?: boolean;
}) {
  const pct = (n: number) => (linha.total ? (n / linha.total) * 100 : 0);
  const visiveis = linha.porStatus.filter((st) => st.valor > 0);
  const classeRotulo = `w-16 shrink-0 text-[13px] ${
    destaque ? "font-semibold text-zinc-900" : "text-primary underline-offset-2 hover:underline"
  }`;

  return (
    <div className="flex items-center gap-3 rounded-md px-1 py-0.5">
      {hrefRotulo ? (
        <Link href={hrefRotulo} className={classeRotulo}>
          {rotulo}
        </Link>
      ) : (
        <span className={classeRotulo}>{rotulo}</span>
      )}
      <div className="flex h-6 flex-1 overflow-hidden rounded-full bg-zinc-100">
        {visiveis.map((st, i) => {
          const estilo = {
            width: `${pct(st.valor)}%`,
            background: st.cor,
            borderRight: i < visiveis.length - 1 ? "2px solid #fff" : undefined,
          };
          const classe =
            "flex items-center justify-center overflow-hidden text-[11px] font-semibold text-white transition-[filter] hover:brightness-110";
          // Pedaço estreito corta o número no celular: entre 8% e 15% ele só
          // aparece a partir de sm (o valor fica no title).
          const texto = pct(st.valor) >= 8 && (
            <span className={pct(st.valor) < 15 ? "hidden sm:inline" : undefined}>
              {Math.round(pct(st.valor))}%
            </span>
          );
          return hrefSegmento ? (
            <Link
              key={st.chave}
              href={hrefSegmento(st.chave)}
              title={`${st.label}: ${st.valor} — clique pra filtrar`}
              className={classe}
              style={estilo}
            >
              {texto}
            </Link>
          ) : (
            <div key={st.chave} title={`${st.label}: ${st.valor}`} className={classe} style={estilo}>
              {texto}
            </div>
          );
        })}
      </div>
      <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-zinc-500">{linha.total} total</span>
    </div>
  );
}

// Uma das duas metades da exportação: cada linha é uma avaliação (pessoa +
// período) com indicação de treinamento.
function ListaExportacao({
  titulo,
  itens,
  vazio,
  tom,
}: {
  titulo: string;
  itens: {
    id: string;
    colaboradorId: string | null;
    nome: string;
    matricula: string | null;
    marco: number;
    pendentes: number;
    ultimaExportacao: string | null;
  }[];
  vazio: string;
  tom: "pendente" | "feito";
}) {
  const Icone = tom === "pendente" ? Clock : CheckCircle2;
  return (
    <div
      className={`flex flex-col rounded-lg border ${
        tom === "pendente" ? "border-orange-200 bg-orange-50/50" : "border-primary-border bg-primary-soft/20"
      }`}
    >
      <h3
        className={`flex items-center gap-1.5 px-3 pt-2 text-xs font-semibold uppercase tracking-wide ${
          tom === "pendente" ? "text-orange-700" : "text-primary"
        }`}
      >
        <Icone className="h-3.5 w-3.5" />
        {titulo} ({itens.length})
      </h3>
      {itens.length === 0 ? (
        <p className="px-3 py-2 text-xs text-zinc-500">{vazio}</p>
      ) : (
        <ul className="flex max-h-[180px] flex-col overflow-y-auto px-3 py-1.5">
          {itens.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-1 text-xs">
              <span className="min-w-0 truncate">
                {item.matricula && <span className="mr-1.5 text-zinc-500">{item.matricula}</span>}
                <Link
                  href={`/admin/colaboradores/${item.colaboradorId}`}
                  className="font-medium text-zinc-900 hover:underline"
                >
                  {item.nome}
                </Link>
                <span className="text-zinc-500"> · {item.marco} dias</span>
              </span>
              <span className="shrink-0 text-[11px] text-zinc-500">
                {tom === "pendente"
                  ? `${item.pendentes} indicaç${item.pendentes === 1 ? "ão" : "ões"}`
                  : item.ultimaExportacao &&
                    `em ${new Date(item.ultimaExportacao).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LegendaCor({ cor, label }: { cor: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: cor }} />
      {label}
    </span>
  );
}

// Cada card tem uma cor própria pra não repetir fundo lado a lado; o ícone
// vai em cor sólida pra destacar.
type Tom = "neutral" | "brand" | "blue" | "amber" | "green" | "orange" | "red" | "teal" | "violet";

const ESTILO_POR_TOM: Record<
  Tom,
  { cardBg: string; iconBg: string; iconColor: string; activeRing: string }
> = {
  neutral: {
    cardBg: "bg-zinc-50",
    iconBg: "bg-zinc-500",
    iconColor: "text-white",
    activeRing: "ring-zinc-500",
  },
  // Verde da marca: pra cards que não são status (ex: total de colaboradores).
  brand: {
    cardBg: "bg-primary-soft/50",
    iconBg: "bg-primary",
    iconColor: "text-primary-foreground",
    activeRing: "ring-primary",
  },
  blue: {
    cardBg: "bg-blue-50",
    iconBg: "bg-blue-600",
    iconColor: "text-white",
    activeRing: "ring-blue-600",
  },
  // Amarelo: ícone escuro porque branco some no amarelo.
  amber: {
    cardBg: "bg-amber-50",
    iconBg: "bg-amber-400",
    iconColor: "text-amber-950",
    activeRing: "ring-amber-400",
  },
  green: {
    cardBg: "bg-green-50",
    iconBg: "bg-green-700",
    iconColor: "text-white",
    activeRing: "ring-green-700",
  },
  orange: {
    cardBg: "bg-orange-50",
    iconBg: "bg-orange-500",
    iconColor: "text-white",
    activeRing: "ring-orange-500",
  },
  red: {
    cardBg: "bg-red-50",
    iconBg: "bg-red-500",
    iconColor: "text-white",
    activeRing: "ring-red-500",
  },
  teal: {
    cardBg: "bg-teal-50",
    iconBg: "bg-teal-500",
    iconColor: "text-white",
    activeRing: "ring-teal-500",
  },
  // Treinamentos indicados: cor que nenhum status usa.
  violet: {
    cardBg: "bg-violet-50",
    iconBg: "bg-violet-600",
    iconColor: "text-white",
    activeRing: "ring-violet-600",
  },
};

function Card({
  icon: Icon,
  label,
  value,
  href,
  ativo,
  tone = "neutral",
  detalhe,
  progresso,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  href?: string;
  ativo?: boolean;
  tone?: Tom;
  // Linha pequena embaixo do número (ex: "25% do total").
  detalhe?: string;
  // 0 a 100: desenha a barra embaixo do detalhe, na cor do ícone.
  progresso?: number;
}) {
  const estilo = ESTILO_POR_TOM[tone];
  const conteudo = (
    <>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${estilo.iconBg}`}>
        <Icon className={`h-4 w-4 ${estilo.iconColor}`} strokeWidth={2} />
      </span>
      <div className="w-full min-w-0 text-center">
        {/* Nome sempre com altura de 2 linhas: quem cabe em uma fica
            centralizado nesse espaço, e número/barra alinham entre os cards. */}
        <p className="flex h-[30px] items-center justify-center text-xs font-medium leading-tight text-zinc-600">
          {label}
        </p>
        <p className="text-lg font-bold leading-tight tabular-nums text-zinc-900">{value}</p>
        {detalhe && <p className="text-[11px] leading-tight text-zinc-500">{detalhe}</p>}
        {progresso !== undefined && (
          <div className="mx-auto mt-1 h-1.5 w-full max-w-28 overflow-hidden rounded-full bg-black/10">
            <div
              className={`h-full rounded-full ${estilo.iconBg}`}
              style={{ width: `${Math.min(100, Math.max(0, progresso))}%` }}
            />
          </div>
        )}
      </div>
    </>
  );
  // Com 8 cards lado a lado cada um fica estreito: ícone em cima, pro texto
  // usar a largura toda do card (e quebrar linha só se não couber).
  const layout = "flex flex-col items-center gap-1.5 rounded-xl px-2 py-2.5";

  if (!href) {
    return (
      <div className={`${layout} ${estilo.cardBg}`}>
        {conteudo}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={`${layout} transition-all ${estilo.cardBg} ${
        ativo ? `ring-2 ${estilo.activeRing}` : "hover:brightness-[0.97]"
      }`}
    >
      {conteudo}
    </Link>
  );
}
