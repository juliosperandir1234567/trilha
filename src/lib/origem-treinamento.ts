// De onde vem o treinamento (ex.: UAM, Gupy). Aparece junto do nome:
// "Computador de bordo - UAM".
export const ORIGENS_SUGERIDAS = ["UAM", "Gupy"];

export function nomeComOrigem(nome: string, origem: string | null | undefined) {
  return origem ? `${nome} - ${origem}` : nome;
}
