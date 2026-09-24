import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";

function escapeCsv(valor: string | number | null | undefined) {
  const texto = String(valor ?? "");
  return `"${texto.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  await requireStaff();
  const params = new URL(request.url).searchParams;
  const marco = params.get("marco");
  const status = params.get("status");
  const critico = params.get("critico");
  const admissaoDe = params.get("admissao_de");
  const admissaoAte = params.get("admissao_ate");
  const supabase = await createClient();

  let query = supabase
    .from("respostas")
    .select(
      "nota, comentario, created_at, categorias_treinamento:categoria_final_id(nome), treinamentos:treinamento_final_id(nome), avaliacao_id, avaliacoes!inner(marco, status, colaboradores(data_admissao, nome, matricula, gestor_nome, gestor_email))"
    )
    .not("categoria_final_id", "is", null)
    .order("created_at", { ascending: false });

  if (marco) query = query.eq("avaliacoes.marco", Number(marco));

  if (status) query = query.eq("avaliacoes.status", status);

  const [{ data: respostasBrutas }, { data: notasCriticas }] = await Promise.all([
    query,
    critico
      ? supabase.from("respostas").select("avaliacao_id").eq("nota", 1)
      : Promise.resolve({ data: null }),
  ]);

  // Mesmos filtros da Visão geral. Admissão e notas críticas são filtrados
  // aqui porque dependem de tabela aninhada / de outra resposta da avaliação.
  const avaliacoesCriticas = new Set((notasCriticas ?? []).map((r) => r.avaliacao_id));
  const respostas = (respostasBrutas ?? []).filter((r) => {
    if (critico && !avaliacoesCriticas.has(r.avaliacao_id)) return false;
    const dataAdmissao = (
      r.avaliacoes as unknown as { colaboradores: { data_admissao: string | null } | null }
    ).colaboradores?.data_admissao;
    if (admissaoDe || admissaoAte) {
      if (!dataAdmissao) return false;
      if (admissaoDe && dataAdmissao < admissaoDe) return false;
      if (admissaoAte && dataAdmissao > admissaoAte) return false;
    }
    return true;
  });

  const linhas = [
    ["Matrícula", "Colaborador", "Período", "Nota", "Gestor", "Competência", "Treinamento", "Comentário"]
      .map(escapeCsv)
      .join(";"),
  ];

  for (const resposta of respostas) {
    const avaliacao = resposta.avaliacoes as unknown as {
      marco: number;
      colaboradores: {
        nome: string;
        matricula: string | null;
        gestor_nome: string;
        gestor_email: string;
      } | null;
    } | null;
    const colaborador = avaliacao?.colaboradores;
    const categoria = resposta.categorias_treinamento as unknown as { nome: string } | null;
    const treinamento = resposta.treinamentos as unknown as { nome: string } | null;

    linhas.push(
      [
        colaborador?.matricula,
        colaborador?.nome,
        avaliacao ? `${avaliacao.marco} dias` : "",
        resposta.nota,
        colaborador?.gestor_nome,
        categoria?.nome,
        treinamento?.nome,
        resposta.comentario,
      ]
        .map(escapeCsv)
        .join(";")
    );
  }

  const csv = "﻿" + linhas.join("\n");
  const sufixoMarco = marco ? `-${marco}-dias` : "";
  const nomeArquivo = `treinamentos-indicados${sufixoMarco}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
    },
  });
}
