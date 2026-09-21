import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";

function escapeCsv(valor: string | number | null | undefined) {
  const texto = String(valor ?? "");
  return `"${texto.replace(/"/g, '""')}"`;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireStaff();
  const { id } = await params;
  const marco = new URL(request.url).searchParams.get("marco");
  const supabase = await createClient();

  const { data: categoria } = await supabase
    .from("categorias_treinamento")
    .select("nome")
    .eq("id", id)
    .single();

  let query = supabase
    .from("respostas")
    .select(
      "nota, created_at, avaliacoes!inner(marco, colaboradores(nome, matricula, gestor_nome, gestor_email))"
    )
    .eq("categoria_final_id", id)
    .order("created_at", { ascending: false });

  if (marco) query = query.eq("avaliacoes.marco", Number(marco));

  const { data: respostas } = await query;

  const linhas = [
    ["Matrícula", "Colaborador", "Marco", "Nota", "Gestor"].map(escapeCsv).join(";"),
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

    linhas.push(
      [
        colaborador?.matricula,
        colaborador?.nome,
        avaliacao ? `${avaliacao.marco} dias` : "",
        resposta.nota,
        colaborador?.gestor_nome,
      ]
        .map(escapeCsv)
        .join(";")
    );
  }

  const csv = "﻿" + linhas.join("\n");
  const sufixoMarco = marco ? `-${marco}-dias` : "";
  const nomeArquivo = `${(categoria?.nome ?? "treinamento").replace(/[^a-z0-9]+/gi, "-")}${sufixoMarco}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
    },
  });
}
