import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";

function escapeCsv(valor: string | number | null | undefined) {
  const texto = String(valor ?? "");
  return `"${texto.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  await requireStaff();
  const marco = new URL(request.url).searchParams.get("marco");
  const supabase = await createClient();

  let query = supabase
    .from("respostas")
    .select(
      "nota, created_at, categorias_treinamento:categoria_final_id(nome), avaliacoes!inner(marco, colaboradores(nome, matricula, gestor_nome, gestor_email))"
    )
    .not("categoria_final_id", "is", null)
    .order("created_at", { ascending: false });

  if (marco) query = query.eq("avaliacoes.marco", Number(marco));

  const { data: respostas } = await query;

  const linhas = [
    ["Matrícula", "Colaborador", "Período", "Nota", "Gestor", "Treinamento indicado"]
      .map(escapeCsv)
      .join(";"),
  ];

  for (const resposta of respostas ?? []) {
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

    linhas.push(
      [
        colaborador?.matricula,
        colaborador?.nome,
        avaliacao ? `${avaliacao.marco} dias` : "",
        resposta.nota,
        colaborador?.gestor_nome,
        categoria?.nome,
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
