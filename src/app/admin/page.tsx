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
  Download,
  CalendarDays,
  X,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AvaliacoesTable, type AvaliacaoLinha } from "./avaliacoes-table";
import { EnviarAgoraButton } from "./colaboradores/[id]/enviar-agora-button";

const MARCOS = [30, 60, 90, 120, 180, 270] as const;

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
// rosca e barras. Os hex batem com o -500 do Tailwind usado no ícone do card.
const STATUS_VISUAL = [
  { chave: "respondida", label: "Respondidas", cor: "#22c55e" },
  { chave: "enviada", label: "Aguardando resposta", cor: "#f59e0b" },
  { chave: "pendente", label: "Não enviadas", cor: "#8b5cf6" },
  { chave: "expirada", label: "Expiradas", cor: "#ef4444" },
] as const;

// Até quantos dias antes do vencimento um item do "Requer atenção" é urgente.
const DIAS_URGENCIA = 2;

// Abaixo de um dia, mostrar "0,2 dias" parece erro — vira horas.
function formatarTempoResposta(dias: number | null): string {
  if (dias === null) return "-";
  if (dias < 1) {
    const horas = Math.round(dias * 24);
    return horas < 1 ? "< 1h" : `${horas}h`;
  }
  return `${dias.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias`;
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

const STATUS_FILTRO_LABEL: Record<string, string> = {
  pendente: "Não enviadas",
  enviada: "Aguardando resposta",
  respondida: "Respondidas",
  expirada: "Expiradas",
};

const MARCOS_FILTRO = [
  { label: "Todos", valor: "" },
  { label: "30 dias", valor: "30" },
  { label: "60 dias", valor: "60" },
  { label: "90 dias", valor: "90" },
  { label: "120 dias", valor: "120" },
  { label: "180 dias", valor: "180" },
  { label: "270 dias", valor: "270" },
];

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{
    marco?: string;
    status?: string;
    critico?: string;
    admissao_de?: string;
    admissao_ate?: string;
  }>;
}) {
  const { marco, status, critico, admissao_de: admissaoDe, admissao_ate: admissaoAte } = await searchParams;
  const marcoNum = marco ? Number(marco) : null;
  const supabase = await createClient();

  function comAdmissao(params: URLSearchParams) {
    if (admissaoDe) params.set("admissao_de", admissaoDe);
    if (admissaoAte) params.set("admissao_ate", admissaoAte);
    return params;
  }

  function hrefFiltro(extra: { status?: string; critico?: string }) {
    const params = new URLSearchParams();
    if (marco) params.set("marco", marco);
    if (extra.status) params.set("status", extra.status);
    if (extra.critico) params.set("critico", extra.critico);
    comAdmissao(params);
    const query = params.toString();
    return query ? `/admin?${query}` : "/admin";
  }

  function hrefMarco(m: string) {
    const params = new URLSearchParams();
    if (m) params.set("marco", m);
    comAdmissao(params);
    const query = params.toString();
    return query ? `/admin?${query}` : "/admin";
  }

  type ChaveFiltro = "marco" | "status" | "critico" | "admissao";

  // Mesma página, tirando só os filtros pedidos — usado no "✕" de cada
  // filtro ativo e no "Limpar tudo".
  function hrefSem(remover: ChaveFiltro[]) {
    const params = new URLSearchParams();
    if (marco && !remover.includes("marco")) params.set("marco", marco);
    if (status && !remover.includes("status")) params.set("status", status);
    if (critico && !remover.includes("critico")) params.set("critico", critico);
    if (!remover.includes("admissao")) comAdmissao(params);
    const query = params.toString();
    return query ? `/admin?${query}` : "/admin";
  }

  function hrefSemAdmissao() {
    const params = new URLSearchParams();
    if (marco) params.set("marco", marco);
    if (status) params.set("status", status);
    if (critico) params.set("critico", critico);
    const query = params.toString();
    return query ? `/admin?${query}` : "/admin";
  }

  function hrefExportar() {
    const params = new URLSearchParams();
    if (marco) params.set("marco", marco);
    if (status) params.set("status", status);
    if (critico) params.set("critico", critico);
    comAdmissao(params);
    const query = params.toString();
    return query ? `/admin/categorias/export?${query}` : "/admin/categorias/export";
  }

  // Datas ISO (yyyy-mm-dd) comparam certinho como string, sem precisar
  // converter pra Date.
  function dentroDoPeriodoAdmissao(dataAdmissao: string | null | undefined) {
    if (!dataAdmissao) return false;
    if (admissaoDe && dataAdmissao < admissaoDe) return false;
    if (admissaoAte && dataAdmissao > admissaoAte) return false;
    return true;
  }

  const temFiltroAdmissao = !!(admissaoDe || admissaoAte);

  const dataBR = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");
  const filtrosAtivos: { chave: ChaveFiltro; rotulo: string }[] = [
    ...(marco ? [{ chave: "marco" as const, rotulo: `Período: ${marco} dias` }] : []),
    ...(status && STATUS_FILTRO_LABEL[status]
      ? [{ chave: "status" as const, rotulo: `Status: ${STATUS_FILTRO_LABEL[status]}` }]
      : []),
    ...(critico ? [{ chave: "critico" as const, rotulo: "Notas críticas" }] : []),
    ...(temFiltroAdmissao
      ? [
          {
            chave: "admissao" as const,
            rotulo:
              admissaoDe && admissaoAte
                ? `Admissão: ${dataBR(admissaoDe)} a ${dataBR(admissaoAte)}`
                : admissaoDe
                  ? `Admissão a partir de ${dataBR(admissaoDe)}`
                  : `Admissão até ${dataBR(admissaoAte!)}`,
          },
        ]
      : []),
  ];

  const sufixoFiltrosDosCards =
    (status && STATUS_FILTRO_LABEL[status] ? ` — ${STATUS_FILTRO_LABEL[status]}` : "") +
    (critico ? " — Notas críticas" : "");
  const sufixoFiltros = (marco ? ` — ${marco} dias` : "") + sufixoFiltrosDosCards;

  let colaboradoresQuery = supabase
    .from("colaboradores")
    .select("*", { count: "exact", head: true })
    .eq("ativo", true);
  if (admissaoDe) colaboradoresQuery = colaboradoresQuery.gte("data_admissao", admissaoDe);
  if (admissaoAte) colaboradoresQuery = colaboradoresQuery.lte("data_admissao", admissaoAte);

  const [
    { count: colaboradoresAtivosTotal },
    { data: avaliacoes },
    { data: categorias },
    { data: respostas },
    { data: notasCriticas },
    { data: colaboradoresParaMarcos },
  ] = await Promise.all([
    colaboradoresQuery,
    supabase
      .from("avaliacoes")
      .select(
        "id, marco, status, data_envio, data_resposta, colaboradores(id, nome, matricula, data_admissao, gestor_nome, gestor_email, cargos(nome)), links_avaliacao(expira_em)"
      )
      .order("data_referencia", { ascending: false }),
    supabase.from("categorias_treinamento").select("id, nome").eq("ativo", true).order("nome"),
    supabase
      .from("respostas")
      .select(
        "avaliacao_id, categoria_final_id, treinamento_final_id, treinamentos:treinamento_final_id(nome)"
      )
      .not("categoria_final_id", "is", null),
    supabase
      .from("respostas")
      .select("avaliacao_id, avaliacoes!inner(marco, colaborador_id, colaboradores(data_admissao))")
      .eq("nota", 1),
    supabase
      .from("colaboradores")
      .select("id, nome, matricula, gestor_nome, data_admissao, cargos(marcos)")
      .eq("ativo", true),
  ]);

  const avaliacoesComNotaCritica = new Set((notasCriticas ?? []).map((r) => r.avaliacao_id));

  const listaBase = avaliacoes ?? [];
  const lista = temFiltroAdmissao
    ? listaBase.filter((a) =>
        dentroDoPeriodoAdmissao(
          (a.colaboradores as unknown as { data_admissao: string } | null)?.data_admissao
        )
      )
    : listaBase;
  const avaliacoesDoMarco = marcoNum ? lista.filter((a) => a.marco === marcoNum) : lista;

  // Filtros dos cards (status e notas críticas), aplicados por cima do
  // período/admissão. Os gráficos usam a mesma função pra acompanhar a tabela.
  function aplicarFiltrosDosCards(itens: typeof lista) {
    let resultado = itens;
    if (status === "pendente" || status === "enviada" || status === "respondida" || status === "expirada") {
      resultado = resultado.filter((a) => a.status === status);
    }
    if (critico) {
      resultado = resultado.filter((a) => avaliacoesComNotaCritica.has(a.id));
    }
    return resultado;
  }

  const avaliacoesFiltradas = aplicarFiltrosDosCards(avaliacoesDoMarco);

  // Treinamentos seguem exatamente os mesmos filtros da tabela (período,
  // admissão, status e notas críticas): só conta resposta de avaliação que
  // está na lista filtrada.
  const idsAvaliacoesFiltradas = new Set(avaliacoesFiltradas.map((a) => a.id));
  const respostasFiltradas = (respostas ?? []).filter((r) => idsAvaliacoesFiltradas.has(r.avaliacao_id));

  const contagemPorCategoria = new Map<string, number>();
  const treinamentosPorCategoria = new Map<string, Map<string, { nome: string; total: number }>>();
  for (const resposta of respostasFiltradas) {
    const categoriaId = resposta.categoria_final_id as string;
    contagemPorCategoria.set(categoriaId, (contagemPorCategoria.get(categoriaId) ?? 0) + 1);

    const treinamentoId = resposta.treinamento_final_id as string | null;
    const treinamento = resposta.treinamentos as unknown as { nome: string } | null;
    if (!treinamentoId || !treinamento) continue;

    if (!treinamentosPorCategoria.has(categoriaId)) treinamentosPorCategoria.set(categoriaId, new Map());
    const mapaDaCategoria = treinamentosPorCategoria.get(categoriaId)!;
    const atual = mapaDaCategoria.get(treinamentoId);
    mapaDaCategoria.set(treinamentoId, { nome: treinamento.nome, total: (atual?.total ?? 0) + 1 });
  }

  const nomeCategoria = new Map((categorias ?? []).map((c) => [c.id, c.nome]));
  const rankingTreinamentos = [...treinamentosPorCategoria.entries()]
    .flatMap(([categoriaId, mapa]) =>
      [...mapa.values()].map((t) => ({ ...t, categoria: nomeCategoria.get(categoriaId) ?? "" }))
    )
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

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
    .filter((c) => !temFiltroAdmissao || dentroDoPeriodoAdmissao(c.data_admissao))
    .flatMap((c) => {
      const cargo = c.cargos as unknown as { marcos: number[] | null } | null;
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

  // Filtro de status/notas críticas é sobre avaliações que já existem. Só
  // "Não enviadas" combina com marco previsto — nos outros, eles saem.
  const incluirPrevistos = !critico && (!status || status === "pendente");

  // Marco que já chegou e não tem avaliação conta como "Não enviada" no card
  // e nas barras. Marco futuro não conta: ainda não era pra ter saído.
  const previstosVencidos = incluirPrevistos ? marcosPrevistos.filter((p) => p.diasAteMarco <= 0) : [];
  const previstosVencidosDoMarco = (m: number | null) =>
    previstosVencidos.filter((p) => !m || p.marco === m).length;

  const proximasAvaliacoes = (incluirPrevistos ? marcosPrevistos : [])
    .filter((p) => !marcoNum || p.marco === marcoNum)
    .sort((a, b) => {
      if (a.naoSeraGerada !== b.naoSeraGerada) return a.naoSeraGerada ? -1 : 1;
      return a.diasAteMarco - b.diasAteMarco;
    });

  const totalRespondidas = avaliacoesDoMarco.filter((a) => a.status === "respondida").length;
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

  const colaboradoresComNotaCritica = new Set(
    (notasCriticas ?? [])
      .map(
        (r) =>
          r.avaliacoes as unknown as {
            marco: number;
            colaborador_id: string;
            colaboradores: { data_admissao: string } | null;
          }
      )
      .filter((a) => !marcoNum || a.marco === marcoNum)
      .filter((a) => !temFiltroAdmissao || dentroDoPeriodoAdmissao(a.colaboradores?.data_admissao))
      .map((a) => a.colaborador_id)
  ).size;

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

  // "Requer atenção": avaliações já expiradas, ou aguardando resposta —
  // pra não depender de ninguém abrir a tabela completa e reparar sozinho.
  // Tudo que está em aberto aparece, mas só é "urgente" (vermelho) o que já
  // expirou ou vence em até DIAS_URGENCIA dias — senão tudo vira alerta.
  const itensAtencao = avaliacoesFiltradas
    .map((a) => {
      const colaborador = a.colaboradores as unknown as {
        id: string;
        nome: string;
        matricula: string | null;
        cargos: { nome: string } | null;
      } | null;
      const link = (a.links_avaliacao as unknown as { expira_em: string }[])[0];
      if (!colaborador) return null;

      if (a.status === "expirada") {
        return {
          avaliacaoId: a.id,
          colaboradorId: colaborador.id,
          nome: colaborador.nome,
          matricula: colaborador.matricula,
          cargo: colaborador.cargos?.nome ?? null,
          marco: a.marco,
          atrasada: true,
          urgente: true,
          expiraEm: link?.expira_em ?? null,
        };
      }

      if (a.status === "enviada" && link) {
        const expiraEmMs = new Date(link.expira_em).getTime();
        return {
          avaliacaoId: a.id,
          colaboradorId: colaborador.id,
          nome: colaborador.nome,
          matricula: colaborador.matricula,
          cargo: colaborador.cargos?.nome ?? null,
          marco: a.marco,
          atrasada: expiraEmMs < agora,
          urgente: expiraEmMs - agora <= DIAS_URGENCIA * 24 * 60 * 60 * 1000,
          expiraEm: link.expira_em,
        };
      }

      return null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => {
      if (a.atrasada !== b.atrasada) return a.atrasada ? -1 : 1;
      return new Date(a.expiraEm ?? 0).getTime() - new Date(b.expiraEm ?? 0).getTime();
    });


  const totalUrgentes = itensAtencao.filter((i) => i.urgente).length;

  const avaliacoesCriadasParaTabela: AvaliacaoLinha[] = avaliacoesFiltradas.map((a) => {
    const colaborador = a.colaboradores as unknown as {
      id: string;
      nome: string;
      matricula: string | null;
      gestor_nome: string;
      gestor_email: string;
    } | null;
    const link = (a.links_avaliacao as unknown as { expira_em: string }[])[0];

    return {
      id: a.id,
      marco: a.marco,
      status: a.status,
      dataResposta: a.data_resposta,
      expiraEm: link?.expira_em ?? null,
      notaCritica: avaliacoesComNotaCritica.has(a.id),
      colaboradorId: colaborador?.id ?? null,
      colaboradorNome: colaborador?.nome ?? "",
      matricula: colaborador?.matricula ?? null,
      gestorNome: colaborador?.gestor_nome ?? "",
    };
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
        notaCritica: false,
        colaboradorId: p.colaboradorId,
        colaboradorNome: p.nome,
        matricula: p.matricula,
        gestorNome: p.gestorNome,
        previstaPara: p.dataMarco,
      })),
    ...avaliacoesCriadasParaTabela,
  ];

  // Competências com indicação primeiro (mais indicadas no topo); as zeradas
  // ficam recolhidas no fim pra não ocupar espaço sem dizer nada.
  const totalDaCategoria = (id: string) => contagemPorCategoria.get(id) ?? 0;
  const categoriasComIndicacao = (categorias ?? [])
    .filter((c) => totalDaCategoria(c.id) > 0)
    .sort((a, b) => totalDaCategoria(b.id) - totalDaCategoria(a.id));
  const categoriasSemIndicacao = (categorias ?? []).filter((c) => totalDaCategoria(c.id) === 0);

  function linhaCategoria(categoria: { id: string; nome: string }) {
    const treinamentos = [...(treinamentosPorCategoria.get(categoria.id)?.values() ?? [])].sort(
      (a, b) => b.total - a.total
    );
    return (
      <div key={categoria.id} className="px-4 py-3">
        <Link
          href={`/admin/categorias/${categoria.id}${marco ? `?marco=${marco}` : ""}`}
          className="flex items-center justify-between gap-3 text-sm transition-colors hover:text-primary"
        >
          <span className="flex items-center gap-2 font-medium">
            <GraduationCap className="h-4 w-4 shrink-0 text-primary" />
            {categoria.nome}
          </span>
          <span className="flex items-center gap-2 text-zinc-500">
            <span className="font-semibold text-primary">
              {contagemPorCategoria.get(categoria.id) ?? 0}
            </span>
            <ChevronRight className="h-4 w-4" />
          </span>
        </Link>
        {treinamentos.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1 pl-6 text-sm text-zinc-600">
            {treinamentos.map((t, i) => (
              <li key={i} className="flex items-center justify-between gap-3">
                <span>{t.nome}</span>
                <span className="font-semibold text-primary">{t.total}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="-mt-2 flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold">
            Visão geral{marco ? ` — ${marco} dias` : ""}
          </h1>
          <div className="flex flex-wrap gap-2">
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
                  className={`flex min-w-24 flex-col items-center gap-0.5 rounded-xl px-6 py-3 transition-colors ${
                    ativo
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary-soft/50 text-primary hover:bg-primary-soft"
                  }`}
                >
                  <span className="text-sm font-medium">{opcao.label}</span>
                  <span className="text-2xl font-bold tabular-nums">{total}</span>
                </Link>
              );
            })}
            {/* Fica sempre visível ao lado dos períodos; os filtros aparecem
                aqui conforme são aplicados, cada um com ✕ pra remover. */}
            <div className="flex min-w-56 flex-col justify-center gap-1.5 rounded-xl border border-dashed border-primary-border px-4 py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-zinc-500">Filtros ativos</span>
                {filtrosAtivos.length > 1 && (
                  <Link
                    href={hrefSem(["marco", "status", "critico", "admissao"])}
                    className="text-xs text-zinc-500 underline underline-offset-2 hover:text-primary"
                  >
                    Limpar tudo
                  </Link>
                )}
              </div>
              {filtrosAtivos.length === 0 ? (
                <span className="text-sm text-zinc-400">Nenhum</span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {filtrosAtivos.map((filtro) => (
                    <Link
                      key={filtro.chave}
                      href={hrefSem([filtro.chave])}
                      title="Remover este filtro"
                      className="flex items-center gap-1 rounded-full border border-primary-border bg-white py-0.5 pl-2.5 pr-1.5 text-xs font-medium text-primary hover:bg-primary-soft"
                    >
                      {filtro.rotulo}
                      <X className="h-3.5 w-3.5" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <form method="get" action="/admin" className="flex flex-wrap items-end gap-2">
            {marco && <input type="hidden" name="marco" value={marco} />}
            {status && <input type="hidden" name="status" value={status} />}
            {critico && <input type="hidden" name="critico" value={critico} />}
            <div className="flex flex-col gap-1">
              <label htmlFor="admissao_de" className="text-xs text-zinc-500">
                Admissão de
              </label>
              <input
                id="admissao_de"
                type="date"
                name="admissao_de"
                defaultValue={admissaoDe ?? ""}
                className="rounded-md border border-black/15 px-2 py-1.5 text-sm outline-none focus:border-primary"
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
                className="rounded-md border border-black/15 px-2 py-1.5 text-sm outline-none focus:border-primary"
              />
            </div>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
            >
              <CalendarDays className="h-4 w-4" />
              Filtrar
            </button>
            {temFiltroAdmissao && (
              <Link
                href={hrefSemAdmissao()}
                className="rounded-md border border-primary-border px-3 py-1.5 text-sm text-primary hover:bg-primary-soft"
              >
                Limpar
              </Link>
            )}
          </form>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Card
          icon={Users}
          label={marcoNum ? "Colaboradores neste período" : "Colaboradores ativos"}
          value={colaboradoresAtivos}
          href={hrefFiltro({})}
          ativo={!status && !critico}
          tone="brand"
        />
        <Card
          icon={Hourglass}
          label="Não enviadas"
          value={totalPendente}
          href={status === "pendente" ? hrefFiltro({}) : hrefFiltro({ status: "pendente" })}
          ativo={status === "pendente"}
          tone="violet"
        />
        <Card
          icon={Clock}
          label="Aguardando resposta"
          value={totalEnviada}
          href={status === "enviada" ? hrefFiltro({}) : hrefFiltro({ status: "enviada" })}
          ativo={status === "enviada"}
          tone="amber"
        />
        <Card
          icon={CheckCircle2}
          label="Respondidas"
          value={totalRespondidas}
          href={status === "respondida" ? hrefFiltro({}) : hrefFiltro({ status: "respondida" })}
          ativo={status === "respondida"}
          tone="green"
        />
        <Card
          icon={XCircle}
          label="Expiradas"
          value={totalExpiradas}
          href={status === "expirada" ? hrefFiltro({}) : hrefFiltro({ status: "expirada" })}
          ativo={status === "expirada"}
          tone="red"
        />
        <Card
          icon={AlertTriangle}
          label="Notas críticas"
          value={colaboradoresComNotaCritica}
          href={critico ? hrefFiltro({}) : hrefFiltro({ critico: "1" })}
          ativo={!!critico}
          tone="orange"
          alertaSoSeValor
        />
        <Card
          icon={Timer}
          label="Tempo médio de resposta"
          value={formatarTempoResposta(tempoMedioRespostaDias)}
          tone="teal"
        />
      </div>

      <div className={`grid gap-6 ${incluirPrevistos ? "lg:grid-cols-[3fr_2fr]" : ""}`}>
      <div className="min-w-0">
        <h2 className="mb-3 font-medium">Status por período{sufixoFiltrosDosCards}</h2>
        <div className="flex flex-col gap-2 rounded-lg border border-primary-border p-4">
          <div className="mb-1 flex flex-wrap items-center gap-4 text-xs text-zinc-500">
            {STATUS_VISUAL.map((st) => (
              <LegendaCor key={st.chave} cor={st.cor} label={st.label} />
            ))}
          </div>
          <BarraStatus rotulo="Total" linha={progressoTotal} destaque />
          <div className="my-1 border-t border-primary-border/50" />
          {progressoPorMarco.map((linha) => (
            <BarraStatus
              key={linha.marco}
              rotulo={`${linha.marco} dias`}
              linha={linha}
              href={hrefMarco(String(linha.marco))}
              selecionada={linha.marco === marcoNum}
            />
          ))}
        </div>
      </div>

      {incluirPrevistos && (
        <div className="flex min-w-0 flex-col">
          <h2 className="mb-3 font-medium">Próximas avaliações{marco ? ` — ${marco} dias` : ""}</h2>
          <div className="flex min-h-0 flex-1 flex-col gap-2 rounded-lg border border-primary-border p-4">
            <p className="text-xs text-zinc-500">
              Períodos que vencem nos próximos {DIAS_PROXIMAS} dias e períodos que chegaram sem avaliação. A
              rotina cria e envia automaticamente às 9h.
            </p>
            {proximasAvaliacoes.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-500">Nenhuma avaliação prevista nos próximos dias.</p>
            ) : (
              <ul className="flex max-h-[340px] flex-col gap-2 overflow-y-auto pr-1">
                {proximasAvaliacoes.map((p) => (
                  <li
                    key={`${p.colaboradorId}:${p.marco}`}
                    className={`flex shrink-0 items-center justify-between gap-3 rounded-md border-l-4 px-3 py-2 text-sm ${
                      p.naoSeraGerada ? "border-red-500 bg-red-50/60" : "border-transparent bg-primary-soft/30"
                    }`}
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/admin/colaboradores/${p.colaboradorId}`}
                        className="font-semibold text-zinc-900 hover:underline"
                      >
                        {p.nome}
                      </Link>
                      <div className="text-xs text-zinc-500">
                        Avaliação de {p.marco} dias · {new Date(p.dataMarco + "T00:00:00").toLocaleDateString("pt-BR")}
                      </div>
                      <div className={`text-xs font-medium ${p.naoSeraGerada ? "text-red-600" : "text-primary"}`}>
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
            )}
          </div>
        </div>
      )}
      </div>

      {/* Altura fixa no desktop: os dois lados ficam do mesmo tamanho e cada um
          rola por dentro quando tiver mais gente. */}
      <div className={`grid gap-6 lg:h-[560px] ${itensAtencao.length > 0 ? "lg:grid-cols-[2fr_3fr]" : ""}`}>
      {itensAtencao.length > 0 && (
        <div
          className={`flex min-h-0 min-w-0 flex-col rounded-lg border p-4 ${
            totalUrgentes > 0 ? "border-red-200 bg-red-50/60" : "border-amber-200 bg-amber-50/50"
          }`}
        >
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2
                className={`flex items-center gap-2 font-medium ${totalUrgentes > 0 ? "text-red-700" : "text-amber-700"}`}
              >
                <AlertTriangle className="h-4 w-4" />
                Requer atenção
              </h2>
              <p className="text-xs text-zinc-500">
                Avaliações em aberto. Em vermelho: expiradas ou vencendo em até {DIAS_URGENCIA} dias.
              </p>
            </div>
            <div className="flex gap-1.5">
              {totalUrgentes > 0 && (
                <span className="whitespace-nowrap rounded-full bg-red-600 px-3 py-1 text-xs font-medium text-white">
                  {totalUrgentes} urgente{totalUrgentes === 1 ? "" : "s"}
                </span>
              )}
              <span className="whitespace-nowrap rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600">
                {itensAtencao.length} no total
              </span>
            </div>
          </div>
          <ul className="flex max-h-[480px] min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1 lg:max-h-none">
            {itensAtencao.map((item) => {
              const diasRestantes = Math.ceil(
                (new Date(item.expiraEm ?? 0).getTime() - agora) / (24 * 60 * 60 * 1000)
              );
              return (
                <li
                  key={item.avaliacaoId}
                  className={`flex shrink-0 flex-col gap-2 rounded-md border-l-4 bg-white px-3 py-2.5 text-sm ${
                    item.urgente ? "border-red-500" : "border-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-600">
                      {iniciais(item.nome)}
                    </span>
                    <div>
                      <Link
                        href={`/admin/colaboradores/${item.colaboradorId}`}
                        className="font-semibold text-zinc-900 hover:underline"
                      >
                        {item.nome}
                      </Link>
                      <div className="text-xs text-zinc-500">
                        {item.matricula ?? "-"}
                        {item.cargo ? ` · ${item.cargo}` : ""}
                      </div>
                    </div>
                  </div>
                    <Link
                      href={`/admin/colaboradores/${item.colaboradorId}`}
                      className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium ${
                        item.urgente
                          ? "bg-primary text-primary-foreground hover:bg-primary-hover"
                          : "border border-primary-border text-primary hover:bg-primary-soft"
                      }`}
                    >
                      Abrir avaliação
                    </Link>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-12">
                    <span
                      className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${
                        item.urgente ? "bg-red-100 text-red-700" : "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      Avaliação de {item.marco} dias
                    </span>
                    {item.expiraEm && (
                      <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-zinc-500">
                        <CalendarDays className="h-3.5 w-3.5" />
                        Vencimento: {new Date(item.expiraEm).toLocaleDateString("pt-BR")}
                      </span>
                    )}
                    <span
                      className={`whitespace-nowrap ${item.urgente ? "font-medium text-red-600" : "text-zinc-500"}`}
                    >
                      {item.atrasada
                        ? `Expirou há ${Math.max(1, -diasRestantes)} dia(s)`
                        : `Faltam ${Math.max(0, diasRestantes)} dia(s)`}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="flex min-h-0 min-w-0 flex-col">
        <h2 className="mb-3 font-medium">
          Avaliações{marco ? ` de ${marco} dias` : ""}
          {status && STATUS_FILTRO_LABEL[status] ? ` — ${STATUS_FILTRO_LABEL[status]}` : ""}
          {critico ? " — Notas críticas" : ""}
        </h2>
        <AvaliacoesTable avaliacoes={avaliacoesParaTabela} />
      </div>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">Treinamentos indicados{sufixoFiltros}</h2>
          <a
            href={hrefExportar()}
            className="flex items-center gap-2 rounded-md border border-primary-border px-3 py-1.5 text-sm text-primary hover:bg-primary-soft"
          >
            <Download className="h-4 w-4" />
            Exportar tudo
          </a>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-lg border border-primary-border bg-primary-soft/40 px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft">
              <GraduationCap className="h-5 w-5 text-primary" />
            </span>
            <div>
              <p className="text-2xl font-bold tabular-nums text-zinc-900">{respostasFiltradas.length}</p>
              <p className="text-xs text-zinc-500">Indicações de treinamento</p>
            </div>
          </div>
          <div className="flex flex-col divide-y divide-primary-border/50 overflow-hidden rounded-lg border border-primary-border">
            {categoriasComIndicacao.map(linhaCategoria)}
            {categoriasComIndicacao.length === 0 && (categorias ?? []).length > 0 && (
              <p className="px-4 py-3 text-sm text-zinc-500">Nenhuma indicação de treinamento com esses filtros.</p>
            )}
            {categoriasSemIndicacao.length > 0 && (
              <details className="group px-4 py-3 text-sm">
                <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs text-zinc-500 hover:text-primary">
                  <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
                  {categoriasSemIndicacao.length} competência{categoriasSemIndicacao.length === 1 ? "" : "s"} sem
                  indicação
                </summary>
                <ul className="mt-2 flex flex-col gap-1 pl-5">
                  {categoriasSemIndicacao.map((categoria) => (
                    <li key={categoria.id}>
                      <Link
                        href={`/admin/categorias/${categoria.id}${marco ? `?marco=${marco}` : ""}`}
                        className="text-zinc-500 hover:text-primary"
                      >
                        {categoria.nome}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {(categorias ?? []).length === 0 && (
              <p className="px-4 py-3 text-sm text-zinc-500">Nenhuma competência cadastrada.</p>
            )}
          </div>
          </div>

          <div className="flex flex-col gap-4 rounded-xl bg-primary-soft/40 p-4">
            <div>
              <h3 className="font-medium">Treinamentos mais indicados</h3>
              <p className="text-xs text-zinc-500">Ranking de todos os treinamentos, independente da competência.</p>
            </div>
            {rankingTreinamentos.length === 0 ? (
              <p className="text-sm text-zinc-500">Nenhum treinamento indicado ainda.</p>
            ) : (
              <ol className="flex flex-col gap-3">
                {rankingTreinamentos.map((t, i) => (
                  <li key={i} className="flex flex-col gap-1.5 rounded-md bg-white px-3 py-2.5 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                          {i + 1}
                        </span>
                        <span className="truncate font-medium text-zinc-900">{t.nome}</span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-primary">{t.total}</span>
                    </div>
                    <div className="flex items-center gap-2 pl-8">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${(t.total / rankingTreinamentos[0].total) * 100}%` }}
                        />
                      </div>
                      <span className="w-28 shrink-0 truncate text-right text-xs text-zinc-500">{t.categoria}</span>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>


      <Link href="/admin/colaboradores" className="w-fit text-sm text-primary underline underline-offset-2">
        Ver todos os colaboradores →
      </Link>
    </div>
  );
}

// Uma linha do gráfico: barra dividida por status, com a porcentagem escrita
// dentro de cada pedaço (só quando o pedaço é largo o bastante pro texto).
function BarraStatus({
  rotulo,
  linha,
  href,
  selecionada,
  destaque,
}: {
  rotulo: string;
  linha: { total: number; porStatus: readonly { chave: string; label: string; cor: string; valor: number }[] };
  href?: string;
  selecionada?: boolean;
  destaque?: boolean;
}) {
  const pct = (n: number) => (linha.total ? (n / linha.total) * 100 : 0);
  const visiveis = linha.porStatus.filter((st) => st.valor > 0);
  const conteudo = (
    <>
      <span
        className={`w-16 shrink-0 text-sm ${destaque ? "font-semibold text-zinc-900" : "text-primary underline-offset-2 hover:underline"}`}
      >
        {rotulo}
      </span>
      <div className="flex h-7 flex-1 overflow-hidden rounded-full bg-zinc-100">
        {visiveis.map((st, i) => (
          <div
            key={st.chave}
            title={`${st.label}: ${st.valor}`}
            className="flex items-center justify-center overflow-hidden text-xs font-semibold text-white"
            style={{
              width: `${pct(st.valor)}%`,
              background: st.cor,
              borderRight: i < visiveis.length - 1 ? "2px solid #fff" : undefined,
            }}
          >
            {pct(st.valor) >= 8 && `${Math.round(pct(st.valor))}%`}
          </div>
        ))}
      </div>
      <span className="w-16 shrink-0 text-right text-xs tabular-nums text-zinc-500">{linha.total} total</span>
    </>
  );

  if (!href) return <div className="flex items-center gap-3 px-1 py-1">{conteudo}</div>;

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-md px-1 py-1 transition-colors hover:bg-primary-soft/40 ${
        selecionada ? "bg-primary-soft/60" : ""
      }`}
    >
      {conteudo}
    </Link>
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
// vai em cor sólida pra destacar. "neutral" só aparece quando alertaSoSeValor zera.
type Tom = "neutral" | "brand" | "violet" | "amber" | "green" | "orange" | "red" | "teal";

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
  violet: {
    cardBg: "bg-violet-50",
    iconBg: "bg-violet-500",
    iconColor: "text-white",
    activeRing: "ring-violet-500",
  },
  amber: {
    cardBg: "bg-amber-50",
    iconBg: "bg-amber-500",
    iconColor: "text-white",
    activeRing: "ring-amber-500",
  },
  green: {
    cardBg: "bg-green-50",
    iconBg: "bg-green-500",
    iconColor: "text-white",
    activeRing: "ring-green-500",
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
};

function Card({
  icon: Icon,
  label,
  value,
  href,
  ativo,
  tone = "neutral",
  alertaSoSeValor,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  href?: string;
  ativo?: boolean;
  tone?: Tom;
  // Só aplica a cor de alerta (vermelho) quando value > 0 — zero em algo
  // ruim (ex: notas críticas) é uma boa notícia, não precisa chamar atenção.
  alertaSoSeValor?: boolean;
}) {
  const tomEfetivo: Tom = alertaSoSeValor && value === 0 ? "neutral" : tone;
  const estilo = ESTILO_POR_TOM[tomEfetivo];
  const conteudo = (
    <>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${estilo.iconBg}`}>
        <Icon className={`h-5 w-5 ${estilo.iconColor}`} strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium leading-tight text-zinc-600">{label}</p>
        <p className="text-xl font-bold tabular-nums text-zinc-900">{value}</p>
      </div>
    </>
  );

  if (!href) {
    return (
      <div className={`flex items-center gap-3 rounded-xl px-3 py-3 ${estilo.cardBg}`}>
        {conteudo}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-xl px-3 py-3 transition-all ${estilo.cardBg} ${
        ativo ? `ring-2 ${estilo.activeRing}` : "hover:brightness-[0.97]"
      }`}
    >
      {conteudo}
    </Link>
  );
}
