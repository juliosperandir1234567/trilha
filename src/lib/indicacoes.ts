// Uma resposta com nota 1 a 3 indica uma competência e, opcionalmente, um ou
// mais treinamentos (tabela resposta_treinamentos). O admin marca cada
// treinamento como feito; indicação só de competência (sem treinamento) é
// marcada na própria resposta (respostas.treinamento_realizado_em).

export type TreinamentoDaResposta = {
  id: string;
  treinamento_id: string;
  realizado_em: string | null;
  treinamentos: { nome: string; cargos: { nome: string } | null } | null;
};

export type RespostaComIndicacao = {
  id: string;
  categoria_final_id?: string | null;
  // Presente quando a consulta traz o nome da competência.
  categorias_treinamento?: { nome: string } | null;
  treinamento_realizado_em: string | null;
  resposta_treinamentos?: TreinamentoDaResposta[] | null;
};

// Cada item é algo que o admin marca como feito.
export type ItemDeTreinamento = {
  // "rt:<id>" (treinamento) ou "r:<id>" (só a competência).
  chave: string;
  respostaId: string;
  respostaTreinamentoId: string | null;
  treinamentoId: string | null;
  nome: string | null;
  cargo: string | null;
  realizadoEm: string | null;
};

// Select do Supabase com o que as funções abaixo precisam (colar dentro do
// select de respostas).
export const SELECT_TREINAMENTOS =
  "resposta_treinamentos(id, treinamento_id, realizado_em, treinamentos(nome, cargos(nome)))";

function temIndicacao(r: RespostaComIndicacao) {
  return !!(r.categoria_final_id || r.categorias_treinamento);
}

export function itensDeTreinamento(r: RespostaComIndicacao): ItemDeTreinamento[] {
  if (!temIndicacao(r)) return [];
  const linhas = r.resposta_treinamentos ?? [];
  if (linhas.length === 0) {
    return [
      {
        chave: `r:${r.id}`,
        respostaId: r.id,
        respostaTreinamentoId: null,
        treinamentoId: null,
        nome: null,
        cargo: null,
        realizadoEm: r.treinamento_realizado_em,
      },
    ];
  }
  return linhas.map((t) => ({
    chave: `rt:${t.id}`,
    respostaId: r.id,
    respostaTreinamentoId: t.id,
    treinamentoId: t.treinamento_id,
    nome: t.treinamentos?.nome ?? null,
    cargo: t.treinamentos?.cargos?.nome ?? null,
    realizadoEm: t.realizado_em,
  }));
}

export function treinamentosPendentes(respostas: RespostaComIndicacao[]) {
  return respostas.flatMap(itensDeTreinamento).filter((i) => !i.realizadoEm).length;
}
