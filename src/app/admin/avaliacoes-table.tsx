"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Clock, FileDown, type LucideIcon } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  pendente: "Não enviada",
  enviada: "Aguardando resposta",
  respondida: "Respondida",
  expirada: "Expirada",
  nao_avaliada: "Não avaliada",
};

export type AvaliacaoLinha = {
  id: string;
  marco: number;
  status: string;
  dataResposta: string | null;
  expiraEm: string | null;
  colaboradorId: string | null;
  colaboradorNome: string;
  matricula: string | null;
  gestorNome: string;
  cargo: string | null;
  // Prazo de resposta de avaliação enviada/expirada; urgente fica vermelho.
  prazo: { texto: string; urgente: boolean } | null;
  // Período que já chegou mas a avaliação ainda não foi criada pela rotina
  // (data ISO do período). Entra na tabela como "Não enviada".
  previstaPara?: string;
  // Gestor encerrou pelo link sem notas: "afastado" ou "desligado".
  motivoNaoAvaliada?: string | null;
  observacaoNaoAvaliada?: string | null;
  // Treinamentos indicados pelo gestor e quantos o admin já marcou como feitos.
  treinamentosIndicados?: number;
  treinamentosFeitos?: number;
  // Primeira vez que o PDF desta avaliação foi baixado.
  pdfBaixadoEm?: string | null;
};

// Respondidas e não avaliadas já saíram das mãos do gestor; o resto ainda
// depende de alguém (envio, resposta).
const ehRespondida = (a: AvaliacaoLinha) => a.status === "respondida" || a.status === "nao_avaliada";

// Finalizada: respondida e com todo treinamento indicado já feito.
const ehFinalizada = (a: AvaliacaoLinha) =>
  a.status === "respondida" && (a.treinamentosFeitos ?? 0) >= (a.treinamentosIndicados ?? 0);

type FiltroRespondidas = "pendentes" | "finalizadas";

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

// Valor do filtro de cargo pra quem não tem cargo cadastrado.
const SEM_CARGO = "__sem_cargo__";
const cargoDe = (a: AvaliacaoLinha) => a.cargo ?? SEM_CARGO;

// Dois cards lado a lado: em andamento (ainda com o gestor) e respondidas.
// Cada card tem o próprio filtro de cargo.
export function AvaliacoesTable({
  avaliacoes,
  urgentes = 0,
  diasUrgencia,
}: {
  avaliacoes: AvaliacaoLinha[];
  // Expiradas ou vencendo logo: aparece como selo no card Em andamento.
  urgentes?: number;
  diasUrgencia: number;
}) {
  const router = useRouter();
  // O download não recarrega a página: atualiza depois pra os contadores de
  // "novos" já refletirem o que acabou de sair.
  const atualizarDepoisDoDownload = () => setTimeout(() => router.refresh(), 2500);
  const [filtroRespondidas, setFiltroRespondidas] = useState<FiltroRespondidas>("pendentes");
  const [cargoAndamento, setCargoAndamento] = useState("");
  const [cargoRespondidas, setCargoRespondidas] = useState("");

  const todasEmAndamento = avaliacoes.filter((a) => !ehRespondida(a));
  const todasRespondidas = avaliacoes.filter(ehRespondida);
  const emAndamento = cargoAndamento
    ? todasEmAndamento.filter((a) => cargoDe(a) === cargoAndamento)
    : todasEmAndamento;
  const respondidas = cargoRespondidas
    ? todasRespondidas.filter((a) => cargoDe(a) === cargoRespondidas)
    : todasRespondidas;
  const finalizadas = respondidas.filter(ehFinalizada);
  const finalizadasNovas = finalizadas.filter((a) => !a.pdfBaixadoEm);
  // "Respondidas" se divide em quem ainda tem treinamento a fazer (pede ação)
  // e quem já encerrou: finalizada ou não avaliada (afastado/desligado).
  const comTreinamentoPendente = respondidas.filter((a) => a.status === "respondida" && !ehFinalizada(a));
  const encerradas = respondidas.filter((a) => !comTreinamentoPendente.includes(a));
  const respondidasVisiveis = filtroRespondidas === "pendentes" ? comTreinamentoPendente : encerradas;

  return (
    <div className="grid gap-6 xl:grid-cols-2">
        <CardAvaliacoes
          titulo="Avaliações em andamento"
          descricao="Aguardando envio ou resposta do gestor"
          icone={Clock}
          tomIcone="bg-orange-500"
          linhas={emAndamento}
          colunas={["Expira em", "Prazo"]}
          vazio={cargoAndamento ? "Nenhuma avaliação desse cargo." : "Nenhuma avaliação em andamento."}
          selo={
            urgentes > 0 && (
              <span
                title={`Expiradas ou vencendo em até ${diasUrgencia} dias`}
                className="rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-medium text-white"
              >
                {urgentes} urgente{urgentes === 1 ? "" : "s"}
              </span>
            )
          }
          acao={<SeletorCargo avaliacoes={todasEmAndamento} valor={cargoAndamento} onChange={setCargoAndamento} />}
          celulas={(avaliacao) => (
            <>
              <td className="whitespace-nowrap px-2.5 py-2 text-zinc-500">
                {avaliacao.previstaPara
                  ? `Período em ${new Date(avaliacao.previstaPara + "T00:00:00").toLocaleDateString("pt-BR")}`
                  : avaliacao.expiraEm
                    ? dataHora(avaliacao.expiraEm)
                    : "-"}
              </td>
              <td className="whitespace-nowrap px-2.5 py-2">
                {avaliacao.prazo ? (
                  <span className={avaliacao.prazo.urgente ? "font-medium text-red-600" : "text-zinc-600"}>
                    {avaliacao.prazo.texto}
                  </span>
                ) : (
                  <span className="text-zinc-300">-</span>
                )}
              </td>
            </>
          )}
        />

        <CardAvaliacoes
          titulo="Avaliações respondidas"
          descricao="O gestor já respondeu ou informou afastamento"
          icone={CheckCircle2}
          tomIcone="bg-green-700"
          linhas={respondidasVisiveis}
          total={respondidas.length}
          colunas={["Respondida em", "Treinamentos"]}
          vazio={
            cargoRespondidas
              ? "Nenhuma avaliação desse cargo aqui."
              : filtroRespondidas === "pendentes"
                ? "Nenhum treinamento pendente."
                : "Nenhuma avaliação finalizada."
          }
          filtro={
            <div role="tablist" className="flex w-fit overflow-hidden rounded-lg border border-primary-border text-xs font-medium">
              {(
                [
                  { chave: "pendentes", rotulo: "Treinamento pendente", total: comTreinamentoPendente.length },
                  { chave: "finalizadas", rotulo: "Finalizadas", total: encerradas.length },
                ] as const
              ).map((opcao) => {
                const ativo = filtroRespondidas === opcao.chave;
                return (
                  <button
                    key={opcao.chave}
                    type="button"
                    role="tab"
                    aria-selected={ativo}
                    onClick={() => setFiltroRespondidas(opcao.chave)}
                    className={`flex items-center gap-1.5 border-r border-primary-border px-3 py-1.5 transition-colors last:border-r-0 ${
                      ativo ? "bg-primary text-primary-foreground" : "text-primary hover:bg-primary-soft"
                    }`}
                  >
                    {opcao.rotulo}
                    <span className={`rounded-full px-1.5 text-[10px] tabular-nums ${ativo ? "bg-white/25" : "bg-primary-soft"}`}>
                      {opcao.total}
                    </span>
                  </button>
                );
              })}
            </div>
          }
          acao={
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <SeletorCargo avaliacoes={todasRespondidas} valor={cargoRespondidas} onChange={setCargoRespondidas} />
              {/* PDF em massa: um arquivo por avaliação finalizada da lista atual
                  (filtros da página + cargo), tudo num .zip. POST porque a lista
                  de ids pode ser grande demais pra URL. Só na aba Finalizadas.
                  "Só dos novos" leva apenas os que nunca foram baixados, pra não
                  misturar com os que já saíram antes. */}
              {filtroRespondidas === "finalizadas" && finalizadasNovas.length > 0 && (
                <form method="post" action="/admin/avaliacoes/pdf" onSubmit={atualizarDepoisDoDownload}>
                  <input type="hidden" name="ids" value={finalizadasNovas.map((a) => a.id).join(",")} />
                  <button
                    type="submit"
                    title="Baixar em PDF só as finalizadas que ainda não foram baixadas"
                    className="flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary-hover"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    PDF só dos novos ({finalizadasNovas.length})
                  </button>
                </form>
              )}
              {filtroRespondidas === "finalizadas" && finalizadas.length > 0 && (
                <form method="post" action="/admin/avaliacoes/pdf" onSubmit={atualizarDepoisDoDownload}>
                  <input type="hidden" name="ids" value={finalizadas.map((a) => a.id).join(",")} />
                  <button
                    type="submit"
                    title="Baixar em PDF todas as finalizadas desta lista"
                    className="flex items-center gap-1.5 rounded-md border border-primary-border px-2.5 py-1 text-xs text-primary hover:bg-primary-soft"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    PDF de todos ({finalizadas.length})
                  </button>
                </form>
              )}
            </div>
          }
          celulas={(avaliacao) => (
            <>
              <td className="whitespace-nowrap px-2.5 py-2 text-zinc-500">
                {avaliacao.dataResposta ? dataHora(avaliacao.dataResposta) : "-"}
              </td>
              <td className="whitespace-nowrap px-2.5 py-2">
                {avaliacao.status !== "respondida" ? (
                  <span className="text-zinc-300">-</span>
                ) : ehFinalizada(avaliacao) ? (
                  <span className="flex items-center gap-2">
                    <span className="flex items-center gap-1 font-medium text-green-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {avaliacao.treinamentosIndicados ? "Finalizada" : "Sem indicação"}
                    </span>
                    <a
                      href={`/admin/avaliacoes/pdf?id=${avaliacao.id}`}
                      onClick={atualizarDepoisDoDownload}
                      title={
                        avaliacao.pdfBaixadoEm
                          ? `PDF já baixado em ${dataHora(avaliacao.pdfBaixadoEm)}`
                          : "Baixar PDF desta avaliação (ainda não baixado)"
                      }
                      className={avaliacao.pdfBaixadoEm ? "text-zinc-400 hover:underline" : "font-medium text-primary hover:underline"}
                    >
                      {avaliacao.pdfBaixadoEm ? "PDF ✓" : "PDF"}
                    </a>
                  </span>
                ) : (
                  <Link
                    href={`/admin/colaboradores/${avaliacao.colaboradorId}`}
                    className="text-amber-700 hover:underline"
                    title="Marcar os treinamentos feitos na página do colaborador"
                  >
                    {avaliacao.treinamentosFeitos ?? 0} de {avaliacao.treinamentosIndicados} feitos
                  </Link>
                )}
              </td>
            </>
          )}
        />
    </div>
  );
}

// Lista suspensa de cargo: só os cargos que aparecem naquele card.
function SeletorCargo({
  avaliacoes,
  valor,
  onChange,
}: {
  avaliacoes: AvaliacaoLinha[];
  valor: string;
  onChange: (valor: string) => void;
}) {
  const cargos = [...new Set(avaliacoes.map((a) => a.cargo).filter((c): c is string => !!c))].sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );
  const temSemCargo = avaliacoes.some((a) => !a.cargo);
  return (
    <select
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Filtrar por cargo"
      className="shrink-0 rounded-md border border-black/15 px-2.5 py-1 text-xs outline-none focus:border-primary"
    >
      <option value="">Todos os cargos</option>
      {cargos.map((cargo) => (
        <option key={cargo} value={cargo}>
          {cargo}
        </option>
      ))}
      {temSemCargo && <option value={SEM_CARGO}>Sem cargo</option>}
    </select>
  );
}

// Um dos dois cards: cabeçalho com ícone e total, e a tabela com ~5 linhas
// visíveis; o resto rola com o cabeçalho da tabela fixo.
function CardAvaliacoes({
  titulo,
  descricao,
  icone: Icone,
  tomIcone,
  linhas,
  colunas,
  celulas,
  vazio,
  acao,
  filtro,
  total,
  selo,
}: {
  titulo: string;
  descricao: string;
  icone: LucideIcon;
  tomIcone: string;
  linhas: AvaliacaoLinha[];
  colunas: [string, string];
  celulas: (avaliacao: AvaliacaoLinha) => React.ReactNode;
  vazio: string;
  acao?: React.ReactNode;
  // Abas logo abaixo do cabeçalho (ex.: pendentes / finalizadas).
  filtro?: React.ReactNode;
  // Total do título quando a tabela mostra só parte das linhas.
  total?: number;
  // Destaque ao lado do título (ex.: quantas urgentes).
  selo?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-primary-border bg-white">
      <div className="flex items-center justify-between gap-3 p-4 pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white ${tomIcone}`}>
            <Icone className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 font-semibold leading-tight">
              {titulo}
              <span className="rounded-full bg-primary-soft px-2 text-xs font-medium tabular-nums text-primary">
                {total ?? linhas.length}
              </span>
              {selo}
            </h3>
            <p className="truncate text-xs text-zinc-500">{descricao}</p>
          </div>
        </div>
        {acao}
      </div>
      {filtro && <div className="flex flex-wrap items-center gap-2 px-4 pb-3">{filtro}</div>}

      {/* Altura fixa: os dois cards ficam sempre do mesmo tamanho; o que passar
          disso rola, com o cabeçalho da tabela fixo. */}
      <div className="mx-3 mb-3 h-[300px] overflow-auto rounded-lg border border-primary-border/60">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="border-b-2 border-primary-border bg-primary-soft/40 text-primary">
              <th className="px-2.5 py-2">Colaborador</th>
              <th className="whitespace-nowrap px-2.5 py-2">Período</th>
              <th className="whitespace-nowrap px-2.5 py-2">Status</th>
              <th className="whitespace-nowrap px-2.5 py-2">{colunas[0]}</th>
              <th className="whitespace-nowrap px-2.5 py-2">{colunas[1]}</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((avaliacao) => (
              <tr
                key={avaliacao.id}
                className="border-b border-primary-border/40 last:border-b-0 hover:bg-primary-soft/20"
              >
                <td className="px-2.5 py-2">
                  <Link
                    href={`/admin/colaboradores/${avaliacao.colaboradorId}`}
                    className="text-primary underline underline-offset-2"
                  >
                    {avaliacao.colaboradorNome}
                  </Link>
                  {/* Matrícula, cargo e gestor numa linha só pra caber em meia tela. */}
                  <span className="block text-[11px] text-zinc-500">
                    {[avaliacao.matricula, avaliacao.cargo, avaliacao.gestorNome && `Gestor: ${avaliacao.gestorNome}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </td>
                <td className="whitespace-nowrap px-2.5 py-2">{avaliacao.marco} dias</td>
                <td className="whitespace-nowrap px-2.5 py-2">
                  <span className={avaliacao.status === "expirada" ? "text-red-600" : ""}>
                    {STATUS_LABEL[avaliacao.status] ?? avaliacao.status}
                  </span>
                  {avaliacao.previstaPara && (
                    <span className="block text-[11px] text-zinc-400">ainda não criada</span>
                  )}
                  {avaliacao.motivoNaoAvaliada && (
                    <span
                      className="block text-[11px] text-zinc-500"
                      title={avaliacao.observacaoNaoAvaliada ?? undefined}
                    >
                      {avaliacao.motivoNaoAvaliada === "desligado" ? "Desligado" : "Afastado"}
                      {avaliacao.observacaoNaoAvaliada ? " · ver obs." : ""}
                    </span>
                  )}
                </td>
                {celulas(avaliacao)}
              </tr>
            ))}
            {linhas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                  {vazio}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
