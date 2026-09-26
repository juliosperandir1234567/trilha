// Períodos padrão pra quem não tem cargo (mesma regra da rotina diária).
export const MARCOS_PADRAO = [30, 60, 90];

export type AvaliacaoDaTrilha = {
  marco: number;
  status: string;
  // Treinamentos indicados ainda não marcados como feitos.
  treinamentosPendentes: number;
};

// Uma avaliação fecha o período quando está finalizada (respondida e com
// todos os treinamentos feitos) ou quando o gestor informou que não dava pra
// avaliar (afastado/desligado).
export function periodoFechado(avaliacao: AvaliacaoDaTrilha | undefined) {
  if (!avaliacao) return false;
  if (avaliacao.status === "nao_avaliada") return true;
  return avaliacao.status === "respondida" && avaliacao.treinamentosPendentes === 0;
}

// Trilha concluída: todos os períodos do cargo (ou os padrão) fechados.
export function trilhaConcluida(marcos: number[] | null | undefined, avaliacoes: AvaliacaoDaTrilha[]) {
  const periodos = marcos?.length ? marcos : MARCOS_PADRAO;
  const porMarco = new Map(avaliacoes.map((a) => [a.marco, a]));
  return periodos.every((m) => periodoFechado(porMarco.get(m)));
}
