import Link from "next/link";
import {
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  GraduationCap,
  Download,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";

const MARCOS = [30, 60, 90] as const;

const STATUS_LABEL: Record<string, string> = {
  pendente: "Pendente",
  enviada: "Aguardando resposta",
  respondida: "Respondida",
  expirada: "Expirada",
};

const MARCOS_FILTRO = [
  { label: "Todos", valor: "" },
  { label: "30 dias", valor: "30" },
  { label: "60 dias", valor: "60" },
  { label: "90 dias", valor: "90" },
];

const STATUS_FILTRO_LABEL: Record<string, string> = {
  aguardando: "Aguardando resposta",
  respondida: "Respondidas",
  expirada: "Expiradas",
};

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
        "id, marco, status, data_envio, data_resposta, colaboradores(id, nome, matricula, gestor_nome, gestor_email), links_avaliacao(expira_em)"
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
          label={marcoNum ? "Colaboradores neste marco" : "Colaboradores ativos"}
          value={colaboradoresAtivos}
          href={hrefFiltro({})}
          ativo={!status && !critico}
        />
        <Card
          icon={Clock}
          label="Aguardando resposta"
          value={totalAguardando}
          href={status === "aguardando" ? hrefFiltro({}) : hrefFiltro({ status: "aguardando" })}
          ativo={status === "aguardando"}
        />
        <Card
          icon={CheckCircle2}
          label="Respondidas"
          value={totalRespondidas}
          href={status === "respondida" ? hrefFiltro({}) : hrefFiltro({ status: "respondida" })}
          ativo={status === "respondida"}
        />
        <Card
          icon={AlertTriangle}
          label="Expiradas"
          value={totalExpiradas}
          href={status === "expirada" ? hrefFiltro({}) : hrefFiltro({ status: "expirada" })}
          ativo={status === "expirada"}
        />
        <Card
          icon={AlertTriangle}
          label="Notas críticas"
          value={colaboradoresComNotaCritica}
          href={critico ? hrefFiltro({}) : hrefFiltro({ critico: "1" })}
          ativo={!!critico}
          danger
        />
      </div>

      <div>
        <h2 className="mb-3 font-medium">Progresso por marco</h2>
        <div className="overflow-x-auto rounded-lg border border-primary-border">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b-2 border-primary-border bg-primary-soft/40 text-primary">
                <th className="px-4 py-3">Marco</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Respondidas</th>
                <th className="px-4 py-3">Aguardando</th>
                <th className="px-4 py-3">Expiradas</th>
              </tr>
            </thead>
            <tbody>
              {progressoPorMarco.map((linha) => (
                <tr
                  key={linha.marco}
                  className={`border-b border-primary-border/40 last:border-b-0 hover:bg-primary-soft/20 ${
                    linha.marco === marcoNum ? "bg-primary-soft/60" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin?marco=${linha.marco}`}
                      className="text-primary underline underline-offset-2"
                    >
                      {linha.marco} dias
                    </Link>
                  </td>
                  <td className="px-4 py-3">{linha.total}</td>
                  <td className="px-4 py-3">{linha.respondidas}</td>
                  <td className="px-4 py-3">{linha.aguardando}</td>
                  <td className="px-4 py-3">{linha.expiradas}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {(categorias ?? []).map((categoria) => (
            <Link
              key={categoria.id}
              href={`/admin/categorias/${categoria.id}${marco ? `?marco=${marco}` : ""}`}
              className="flex flex-col items-center gap-1 rounded-lg border border-primary-border/60 bg-primary-soft/40 p-3 text-center transition-colors hover:border-primary"
            >
              <GraduationCap className="h-4 w-4 shrink-0 text-primary" />
              <p className="text-xs text-zinc-500">{categoria.nome}</p>
              <p className="text-xl font-semibold text-primary">
                {contagemPorCategoria.get(categoria.id) ?? 0}
              </p>
            </Link>
          ))}
          {(categorias ?? []).length === 0 && (
            <p className="text-sm text-zinc-500">Nenhuma categoria de treinamento cadastrada.</p>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 font-medium">
          Avaliações{marco ? ` de ${marco} dias` : ""}
          {status && STATUS_FILTRO_LABEL[status] ? ` — ${STATUS_FILTRO_LABEL[status]}` : ""}
          {critico ? " — Notas críticas" : ""}
        </h2>

        <div className="overflow-x-auto rounded-lg border border-primary-border">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b-2 border-primary-border bg-primary-soft/40 text-primary">
                <th className="whitespace-nowrap px-4 py-3">Matrícula</th>
                <th className="px-4 py-3">Colaborador</th>
                <th className="whitespace-nowrap px-4 py-3">Marco</th>
                <th className="px-4 py-3">Gestor</th>
                <th className="whitespace-nowrap px-4 py-3">Status</th>
                <th className="whitespace-nowrap px-4 py-3">Expira / respondida em</th>
              </tr>
            </thead>
            <tbody>
              {avaliacoesFiltradas.map((avaliacao) => {
                const colaborador = avaliacao.colaboradores as unknown as {
                  id: string;
                  nome: string;
                  matricula: string | null;
                  gestor_nome: string;
                  gestor_email: string;
                } | null;
                const link = (avaliacao.links_avaliacao as unknown as { expira_em: string }[])[0];

                const notaCritica = avaliacoesComNotaCritica.has(avaliacao.id);

                return (
                  <tr
                    key={avaliacao.id}
                    className={`border-b border-primary-border/40 last:border-b-0 hover:bg-primary-soft/20 ${notaCritica ? "bg-red-50 dark:bg-red-950/30" : ""}`}
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-500">{colaborador?.matricula}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/colaboradores/${colaborador?.id}`}
                        className="text-primary underline underline-offset-2"
                      >
                        {colaborador?.nome}
                      </Link>
                      {notaCritica && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-400">
                          <AlertTriangle className="h-3 w-3" />
                          Atenção
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{avaliacao.marco} dias</td>
                    <td className="px-4 py-3 text-zinc-500">{colaborador?.gestor_nome}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={avaliacao.status === "expirada" ? "text-red-600" : ""}>
                        {STATUS_LABEL[avaliacao.status] ?? avaliacao.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                      {avaliacao.status === "respondida"
                        ? avaliacao.data_resposta
                          ? new Date(avaliacao.data_resposta).toLocaleString("pt-BR")
                          : "-"
                        : link
                          ? new Date(link.expira_em).toLocaleString("pt-BR")
                          : "-"}
                    </td>
                  </tr>
                );
              })}
              {avaliacoesFiltradas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                    Nenhuma avaliação encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Link href="/admin/colaboradores" className="w-fit text-sm text-primary underline underline-offset-2">
        Ver todos os colaboradores →
      </Link>
    </div>
  );
}

function Card({
  icon: Icon,
  label,
  value,
  href,
  ativo,
  danger,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  href: string;
  ativo?: boolean;
  danger?: boolean;
}) {
  if (danger && value > 0) {
    return (
      <Link
        href={href}
        className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-colors ${
          ativo ? "border-red-500 bg-red-100 dark:bg-red-950" : "border-red-300 bg-red-50 hover:border-red-500 dark:border-red-900 dark:bg-red-950/40"
        }`}
      >
        <Icon className="h-4 w-4 shrink-0 text-red-600" />
        <p className="text-xs text-red-700 dark:text-red-400">{label}</p>
        <p className="text-xl font-semibold text-red-700 dark:text-red-400">{value}</p>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-colors ${
        ativo ? "border-primary bg-primary-soft" : "border-primary-border/60 bg-primary-soft/40 hover:border-primary"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0 text-primary" />
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-xl font-semibold text-primary">{value}</p>
    </Link>
  );
}
