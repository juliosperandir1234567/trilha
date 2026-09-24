import Link from "next/link";
import {
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  GraduationCap,
  ChevronRight,
  Download,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AvaliacoesTable, type AvaliacaoLinha } from "./avaliacoes-table";

const MARCOS = [30, 60, 90, 120, 180, 270] as const;

// Paleta de status (não a cor de marca): verde = concluído, âmbar = em
// andamento, vermelho = atrasado. Fixa de propósito, não deve mudar com o tema.
const STATUS_COLORS = { good: "#0ca30c", warning: "#fab219", critical: "#d03b3b" };

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return (primeira + ultima).toUpperCase();
}

const STATUS_FILTRO_LABEL: Record<string, string> = {
  aguardando: "Aguardando resposta",
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

const DIAS_ALERTA_VENCIMENTO = 3;

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ marco?: string; status?: string; critico?: string }>;
}) {
  const { marco, status, critico } = await searchParams;
  const marcoNum = marco ? Number(marco) : null;
  const supabase = await createClient();

  function hrefFiltro(extra: { status?: string; critico?: string }) {
    const params = new URLSearchParams();
    if (marco) params.set("marco", marco);
    if (extra.status) params.set("status", extra.status);
    if (extra.critico) params.set("critico", extra.critico);
    const query = params.toString();
    return query ? `/admin?${query}` : "/admin";
  }

  const [
    { count: colaboradoresAtivosTotal },
    { data: avaliacoes },
    { data: categorias },
    { data: respostas },
    { data: notasCriticas },
  ] = await Promise.all([
    supabase.from("colaboradores").select("*", { count: "exact", head: true }).eq("ativo", true),
    supabase
      .from("avaliacoes")
      .select(
        "id, marco, status, data_envio, data_resposta, colaboradores(id, nome, matricula, gestor_nome, gestor_email, cargos(nome)), links_avaliacao(expira_em)"
      )
      .order("data_referencia", { ascending: false }),
    supabase.from("categorias_treinamento").select("id, nome").eq("ativo", true).order("nome"),
    supabase
      .from("respostas")
      .select("categoria_final_id, avaliacoes!inner(marco)")
      .not("categoria_final_id", "is", null),
    supabase.from("respostas").select("avaliacao_id, avaliacoes!inner(marco, colaborador_id)").eq("nota", 1),
  ]);

  const avaliacoesComNotaCritica = new Set((notasCriticas ?? []).map((r) => r.avaliacao_id));

  const lista = avaliacoes ?? [];
  const avaliacoesDoMarco = marcoNum ? lista.filter((a) => a.marco === marcoNum) : lista;

  let avaliacoesFiltradas = avaliacoesDoMarco;

  if (status === "aguardando") {
    avaliacoesFiltradas = avaliacoesFiltradas.filter(
      (a) => a.status === "pendente" || a.status === "enviada"
    );
  } else if (status === "respondida" || status === "expirada") {
    avaliacoesFiltradas = avaliacoesFiltradas.filter((a) => a.status === status);
  }

  if (critico) {
    avaliacoesFiltradas = avaliacoesFiltradas.filter((a) => avaliacoesComNotaCritica.has(a.id));
  }

  const respostasFiltradas = marcoNum
    ? (respostas ?? []).filter(
        (r) => (r.avaliacoes as unknown as { marco: number }).marco === marcoNum
      )
    : respostas ?? [];

  const contagemPorCategoria = new Map<string, number>();
  for (const resposta of respostasFiltradas) {
    const id = resposta.categoria_final_id as string;
    contagemPorCategoria.set(id, (contagemPorCategoria.get(id) ?? 0) + 1);
  }

  const totalRespondidas = avaliacoesDoMarco.filter((a) => a.status === "respondida").length;
  const totalAguardando = avaliacoesDoMarco.filter(
    (a) => a.status === "pendente" || a.status === "enviada"
  ).length;
  const totalExpiradas = avaliacoesDoMarco.filter((a) => a.status === "expirada").length;

  const totalDoDonut = totalRespondidas + totalAguardando + totalExpiradas;
  const pctRespondidas = totalDoDonut ? (totalRespondidas / totalDoDonut) * 100 : 0;
  const pctAguardando = totalDoDonut ? (totalAguardando / totalDoDonut) * 100 : 0;

  const colaboradoresAtivos = marcoNum
    ? new Set(
        avaliacoesDoMarco
          .map((a) => (a.colaboradores as unknown as { id: string } | null)?.id)
          .filter(Boolean)
      ).size
    : colaboradoresAtivosTotal ?? 0;

  const colaboradoresComNotaCritica = new Set(
    (notasCriticas ?? [])
      .map((r) => r.avaliacoes as unknown as { marco: number; colaborador_id: string })
      .filter((a) => !marcoNum || a.marco === marcoNum)
      .map((a) => a.colaborador_id)
  ).size;

  const progressoPorMarco = MARCOS.map((m) => {
    const doMarco = lista.filter((a) => a.marco === m);
    return {
      marco: m,
      total: doMarco.length,
      respondidas: doMarco.filter((a) => a.status === "respondida").length,
      aguardando: doMarco.filter((a) => a.status === "pendente" || a.status === "enviada").length,
      expiradas: doMarco.filter((a) => a.status === "expirada").length,
    };
  });

  // "Requer atenção": avaliações já expiradas, ou aguardando resposta com o
  // link vencendo nos próximos dias — pra não depender de ninguém abrir a
  // tabela completa e reparar sozinho.
  const agora = Date.now();
  const limiteAlerta = agora + DIAS_ALERTA_VENCIMENTO * 24 * 60 * 60 * 1000;

  const itensAtencao = avaliacoesDoMarco
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
          expiraEm: link?.expira_em ?? null,
        };
      }

      if (a.status === "enviada" && link) {
        const expiraEmMs = new Date(link.expira_em).getTime();
        if (expiraEmMs <= limiteAlerta) {
          return {
            avaliacaoId: a.id,
            colaboradorId: colaborador.id,
            nome: colaborador.nome,
            matricula: colaborador.matricula,
            cargo: colaborador.cargos?.nome ?? null,
            marco: a.marco,
            atrasada: expiraEmMs < agora,
            expiraEm: link.expira_em,
          };
        }
      }

      return null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => {
      if (a.atrasada !== b.atrasada) return a.atrasada ? -1 : 1;
      return new Date(a.expiraEm ?? 0).getTime() - new Date(b.expiraEm ?? 0).getTime();
    });

  const itensAtencaoTop = itensAtencao.slice(0, 6);

  const avaliacoesParaTabela: AvaliacaoLinha[] = avaliacoesFiltradas.map((a) => {
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

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">
          Visão geral{marco ? ` — ${marco} dias` : ""}
        </h1>
        <div className="flex gap-2">
          {MARCOS_FILTRO.map((opcao) => {
            const ativo = (marco ?? "") === opcao.valor;
            return (
              <Link
                key={opcao.label}
                href={opcao.valor ? `/admin?marco=${opcao.valor}` : "/admin"}
                className={`rounded-full px-3 py-1 text-sm ${
                  ativo
                    ? "bg-primary text-primary-foreground"
                    : "border border-primary-border text-primary hover:bg-primary-soft"
                }`}
              >
                {opcao.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Card
          icon={Users}
          label={marcoNum ? "Colaboradores neste período" : "Colaboradores ativos"}
          value={colaboradoresAtivos}
          href={hrefFiltro({})}
          ativo={!status && !critico}
          tone="neutral"
        />
        <Card
          icon={Clock}
          label="Aguardando resposta"
          value={totalAguardando}
          href={status === "aguardando" ? hrefFiltro({}) : hrefFiltro({ status: "aguardando" })}
          ativo={status === "aguardando"}
          tone="warning"
        />
        <Card
          icon={CheckCircle2}
          label="Respondidas"
          value={totalRespondidas}
          href={status === "respondida" ? hrefFiltro({}) : hrefFiltro({ status: "respondida" })}
          ativo={status === "respondida"}
          tone="good"
        />
        <Card
          icon={AlertTriangle}
          label="Expiradas"
          value={totalExpiradas}
          href={status === "expirada" ? hrefFiltro({}) : hrefFiltro({ status: "expirada" })}
          ativo={status === "expirada"}
          tone="critical"
        />
        <Card
          icon={AlertTriangle}
          label="Notas críticas"
          value={colaboradoresComNotaCritica}
          href={critico ? hrefFiltro({}) : hrefFiltro({ critico: "1" })}
          ativo={!!critico}
          tone="critical"
          alertaSoSeValor
        />
      </div>

      <div>
        <h2 className="mb-3 font-medium">Progresso por período</h2>
        <div className="flex flex-col gap-3 rounded-lg border border-primary-border p-4">
          <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500">
            <LegendaCor cor={STATUS_COLORS.good} label="Concluídas" />
            <LegendaCor cor={STATUS_COLORS.warning} label="Aguardando" />
            <LegendaCor cor={STATUS_COLORS.critical} label="Atrasadas" />
          </div>
          {progressoPorMarco.map((linha) => {
            const pct = (n: number) => (linha.total ? Math.round((n / linha.total) * 100) : 0);
            return (
              <Link
                key={linha.marco}
                href={`/admin?marco=${linha.marco}`}
                className={`flex items-center gap-3 rounded-md px-1 py-1 transition-colors hover:bg-primary-soft/40 ${
                  linha.marco === marcoNum ? "bg-primary-soft/60" : ""
                }`}
              >
                <span className="w-16 shrink-0 text-sm text-primary underline-offset-2 hover:underline">
                  {linha.marco} dias
                </span>
                <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-zinc-100">
                  {linha.total > 0 && (
                    <>
                      <div
                        style={{
                          width: `${pct(linha.respondidas)}%`,
                          background: STATUS_COLORS.good,
                          borderRight: linha.aguardando || linha.expiradas ? "2px solid #fff" : undefined,
                        }}
                      />
                      <div
                        style={{
                          width: `${pct(linha.aguardando)}%`,
                          background: STATUS_COLORS.warning,
                          borderRight: linha.expiradas ? "2px solid #fff" : undefined,
                        }}
                      />
                      <div style={{ width: `${pct(linha.expiradas)}%`, background: STATUS_COLORS.critical }} />
                    </>
                  )}
                </div>
                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-zinc-500">
                  {pct(linha.respondidas)}%
                </span>
                <span className="w-16 shrink-0 text-right text-xs tabular-nums text-zinc-400">
                  {linha.total} total
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {itensAtencaoTop.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50/60 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-medium text-red-700">
              <AlertTriangle className="h-4 w-4" />
              Requer atenção
            </h2>
            <span className="text-xs text-red-600">
              {itensAtencao.length} avaliaç{itensAtencao.length === 1 ? "ão" : "ões"} vencendo ou atrasada
              {itensAtencao.length === 1 ? "" : "s"}
            </span>
          </div>
          <ul className="flex flex-col gap-2">
            {itensAtencaoTop.map((item) => (
              <li
                key={item.avaliacaoId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-white px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                    {iniciais(item.nome)}
                  </span>
                  <div>
                    <Link
                      href={`/admin/colaboradores/${item.colaboradorId}`}
                      className="font-medium text-primary underline underline-offset-2"
                    >
                      {item.nome}
                    </Link>
                    <div className="text-zinc-500">
                      {item.matricula ?? "-"}
                      {item.cargo ? ` · ${item.cargo}` : ""} · {item.marco} dias
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={item.atrasada ? "font-medium text-red-600" : "font-medium text-amber-600"}>
                    {item.atrasada
                      ? "Atrasada"
                      : `Vence em ${Math.max(0, Math.ceil((new Date(item.expiraEm ?? 0).getTime() - agora) / (24 * 60 * 60 * 1000)))} dia(s)`}
                  </span>
                  <Link
                    href={`/admin/colaboradores/${item.colaboradorId}`}
                    className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary-hover"
                  >
                    Abrir
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-medium">Status das avaliações{marco ? ` — ${marco} dias` : ""}</h2>
          <div className="flex flex-col items-center gap-4 rounded-lg border border-primary-border p-4 sm:flex-row sm:justify-center">
            <div
              className="relative h-36 w-36 shrink-0 rounded-full"
              style={{
                background:
                  totalDoDonut === 0
                    ? "#f1f1ef"
                    : `conic-gradient(${STATUS_COLORS.good} 0% ${pctRespondidas}%, ${STATUS_COLORS.warning} ${pctRespondidas}% ${pctRespondidas + pctAguardando}%, ${STATUS_COLORS.critical} ${pctRespondidas + pctAguardando}% 100%)`,
              }}
            >
              <div className="absolute inset-3 flex flex-col items-center justify-center rounded-full bg-white text-center">
                <span className="text-2xl font-bold tabular-nums text-zinc-900">{totalDoDonut}</span>
                <span className="text-xs text-zinc-500">avaliaç{totalDoDonut === 1 ? "ão" : "ões"}</span>
              </div>
            </div>
            <ul className="flex flex-col gap-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: STATUS_COLORS.good }} />
                Concluídas
                <span className="ml-auto pl-4 font-semibold tabular-nums text-zinc-700">{totalRespondidas}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: STATUS_COLORS.warning }} />
                Aguardando
                <span className="ml-auto pl-4 font-semibold tabular-nums text-zinc-700">{totalAguardando}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: STATUS_COLORS.critical }} />
                Atrasadas
                <span className="ml-auto pl-4 font-semibold tabular-nums text-zinc-700">{totalExpiradas}</span>
              </li>
            </ul>
          </div>
        </div>

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-medium">Treinamentos indicados{marco ? ` — ${marco} dias` : ""}</h2>
            <a
              href={`/admin/categorias/export${marco ? `?marco=${marco}` : ""}`}
              className="flex items-center gap-2 rounded-md border border-primary-border px-3 py-1.5 text-sm text-primary hover:bg-primary-soft"
            >
              <Download className="h-4 w-4" />
              Exportar tudo
            </a>
          </div>
          <div className="mb-3 flex items-center gap-3 rounded-lg border border-primary-border bg-primary-soft/40 px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-soft">
              <GraduationCap className="h-5 w-5 text-primary" />
            </span>
            <div>
              <p className="text-2xl font-bold tabular-nums text-zinc-900">{respostasFiltradas.length}</p>
              <p className="text-xs text-zinc-500">Indicações de treinamento</p>
            </div>
          </div>
          <div className="flex flex-col divide-y divide-primary-border/50 overflow-hidden rounded-lg border border-primary-border">
            {(categorias ?? []).map((categoria) => (
              <Link
                key={categoria.id}
                href={`/admin/categorias/${categoria.id}${marco ? `?marco=${marco}` : ""}`}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-primary-soft/30"
              >
                <span className="flex items-center gap-2">
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
          ))}
          {(categorias ?? []).length === 0 && (
            <p className="px-4 py-3 text-sm text-zinc-500">Nenhuma competência cadastrada.</p>
          )}
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-3 font-medium">
          Avaliações{marco ? ` de ${marco} dias` : ""}
          {status && STATUS_FILTRO_LABEL[status] ? ` — ${STATUS_FILTRO_LABEL[status]}` : ""}
          {critico ? " — Notas críticas" : ""}
        </h2>
        <AvaliacoesTable avaliacoes={avaliacoesParaTabela} />
      </div>

      <Link href="/admin/colaboradores" className="w-fit text-sm text-primary underline underline-offset-2">
        Ver todos os colaboradores →
      </Link>
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

type Tom = "neutral" | "good" | "warning" | "critical";

const ESTILO_POR_TOM: Record<
  Tom,
  { iconBg: string; iconColor: string; activeBorder: string; activeBg: string }
> = {
  neutral: {
    iconBg: "bg-zinc-100",
    iconColor: "text-zinc-600",
    activeBorder: "border-primary",
    activeBg: "bg-primary-soft",
  },
  good: {
    iconBg: "bg-green-100",
    iconColor: "text-green-700",
    activeBorder: "border-green-500",
    activeBg: "bg-green-50",
  },
  warning: {
    iconBg: "bg-amber-100",
    iconColor: "text-amber-700",
    activeBorder: "border-amber-500",
    activeBg: "bg-amber-50",
  },
  critical: {
    iconBg: "bg-red-100",
    iconColor: "text-red-700",
    activeBorder: "border-red-500",
    activeBg: "bg-red-50",
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
  value: number;
  href: string;
  ativo?: boolean;
  tone?: Tom;
  // Só aplica a cor de alerta (vermelho) quando value > 0 — zero em algo
  // ruim (ex: notas críticas) é uma boa notícia, não precisa chamar atenção.
  alertaSoSeValor?: boolean;
}) {
  const tomEfetivo: Tom = alertaSoSeValor && value === 0 ? "neutral" : tone;
  const estilo = ESTILO_POR_TOM[tomEfetivo];

  return (
    <Link
      href={href}
      className={`flex flex-col gap-3 rounded-xl border bg-white p-4 transition-colors ${
        ativo ? `${estilo.activeBorder} ${estilo.activeBg}` : "border-primary-border/60 hover:border-primary"
      }`}
    >
      <span className={`flex h-10 w-10 items-center justify-center rounded-full ${estilo.iconBg}`}>
        <Icon className={`h-5 w-5 ${estilo.iconColor}`} />
      </span>
      <div>
        <p className="text-2xl font-bold tabular-nums text-zinc-900">{value}</p>
        <p className="text-xs text-zinc-500">{label}</p>
      </div>
    </Link>
  );
}
