// Régua avaliativa de 1 a 5. A função avaliacao-token (Supabase) repete os
// limites NOTA_MAXIMA e NOTA_MAXIMA_INDICACAO — se mudar aqui, mudar lá.
export const NOTAS = [
  {
    valor: 1,
    nome: "Inaceitável",
    descricao:
      "Desempenho muito abaixo do esperado, com falhas graves ou recorrentes que impactam negativamente os resultados e exigem ações imediatas de correção.",
    cor: "#dc2626",
  },
  {
    valor: 2,
    nome: "Insatisfatório",
    descricao:
      "Desempenho inferior ao padrão esperado para o cargo, demonstrando a necessidade de acompanhamento mais próximo e desenvolvimento direcionado.",
    cor: "#ef4444",
  },
  {
    valor: 3,
    nome: "Satisfatório",
    descricao:
      "Corresponde ao desempenho esperado para a função. Indica que o colaborador está cumprindo corretamente suas responsabilidades e entregando os resultados conforme o padrão definido.",
    cor: "#d97706",
  },
  {
    valor: 4,
    nome: "Muito bom",
    descricao:
      "Desempenho acima da média, com entregas consistentes, qualidade nas atividades e contribuição efetiva para os resultados da área.",
    cor: "#16a34a",
  },
  {
    valor: 5,
    nome: "Acima do esperado",
    descricao:
      "Desempenho excepcional, com entregas que superam as metas, alto nível de qualidade nas atividades e impacto positivo ampliado nos resultados da área.",
    cor: "#15803d",
  },
] as const;

export const NOTA_MAXIMA = 5;

// Até esta nota o gestor indica competência/treinamento.
export const NOTA_MAXIMA_INDICACAO = 3;

export function nomeDaNota(nota: number) {
  return NOTAS.find((n) => n.valor === nota)?.nome ?? String(nota);
}
