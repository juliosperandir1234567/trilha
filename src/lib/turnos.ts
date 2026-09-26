// Turnos do colaborador. O banco (check em colaboradores.turno) repete os
// valores — se mudar aqui, mudar lá.
export const TURNOS = [
  { valor: "fixo", nome: "Fixo" },
  { valor: "diurno", nome: "Diurno" },
  { valor: "vespertino", nome: "Vespertino" },
  { valor: "noturno", nome: "Noturno" },
] as const;

export function nomeDoTurno(valor: string | null | undefined) {
  return TURNOS.find((t) => t.valor === valor)?.nome ?? null;
}

// Aceita o valor ou o nome, com ou sem acento/maiúscula (ex: planilha).
export function lerTurno(bruto: string | null | undefined): string | null {
  const texto = (bruto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
  return TURNOS.find((t) => t.valor === texto)?.valor ?? null;
}

// Estrutura macro é texto livre, mas sempre em maiúsculas e sem espaço
// sobrando, pra "utag" e "UTAG " agruparem juntas.
export function lerEstrutura(bruto: string | null | undefined): string | null {
  const texto = (bruto ?? "").trim().replace(/\s+/g, " ").toUpperCase();
  return texto || null;
}
