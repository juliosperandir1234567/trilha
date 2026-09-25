// Períodos de avaliação possíveis (dias após a data de início). Cada cargo
// escolhe quais usa. O banco (check em avaliacoes/perguntas) e a função
// enviar-avaliacao-agora repetem esta lista — se mudar aqui, mudar lá.
export const PERIODOS = [30, 45, 60, 90, 120, 180, 270] as const;

// Botões de filtro por período ("Todos" + um por período).
export const PERIODOS_FILTRO = [
  { label: "Todos", valor: "" },
  ...PERIODOS.map((p) => ({ label: `${p} dias`, valor: String(p) })),
];
