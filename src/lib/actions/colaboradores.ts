"use server";

import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/supabase/dal";

export type ImportFormState =
  | { error?: string; inseridos?: number; ignorados?: number }
  | undefined;

function normalizeHeader(header: string) {
  return header
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

function parseDataAdmissao(valor: string): string | null {
  const trimmed = valor.trim();

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return trimmed;

  const brMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brMatch) {
    const [, dia, mes, ano] = brMatch;
    return `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
  }

  return null;
}

export type ColaboradorFormState = { error?: string } | undefined;

export async function createColaborador(
  _prevState: ColaboradorFormState,
  formData: FormData
): Promise<ColaboradorFormState> {
  await requireStaff();

  const nome = String(formData.get("nome") ?? "").trim();
  const matricula = String(formData.get("matricula") ?? "").trim();
  const dataAdmissao = String(formData.get("data_admissao") ?? "").trim();
  const gestorNome = String(formData.get("gestor_nome") ?? "").trim();
  const gestorEmail = String(formData.get("gestor_email") ?? "").trim();
  const gestorMatricula = String(formData.get("gestor_matricula") ?? "").trim();
  const tipo = String(formData.get("tipo") ?? "novato").trim();

  if (!nome || !matricula || !dataAdmissao || !gestorNome || !gestorEmail || !gestorMatricula) {
    return { error: "Preencha todos os campos." };
  }
  if (!["novato", "capacitacao"].includes(tipo)) {
    return { error: "Tipo inválido." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("colaboradores").insert({
    nome,
    matricula,
    data_admissao: dataAdmissao,
    gestor_nome: gestorNome,
    gestor_email: gestorEmail,
    gestor_matricula: gestorMatricula,
    tipo,
  });

  if (error) {
    return { error: "Não foi possível cadastrar o colaborador." };
  }

  revalidatePath("/admin/colaboradores");
}

export async function importColaboradores(
  _prevState: ImportFormState,
  formData: FormData
): Promise<ImportFormState> {
  await requireStaff();

  const arquivo = formData.get("planilha") as File | null;
  if (!arquivo || arquivo.size === 0) {
    return { error: "Selecione um arquivo CSV." };
  }

  const texto = await arquivo.text();
  const { data: linhas } = Papa.parse<Record<string, string>>(texto, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeHeader,
  });

  const registros: {
    nome: string;
    matricula: string;
    data_admissao: string;
    gestor_nome: string;
    gestor_email: string;
    gestor_matricula: string;
    tipo: string;
  }[] = [];
  let ignorados = 0;

  for (const linha of linhas) {
    const nome = (linha["nome"] ?? linha["colaborador"] ?? linha["nome do colaborador"] ?? "").trim();
    const matricula = (
      linha["matricula"] ??
      linha["matrícula"] ??
      linha["matricula do colaborador"] ??
      ""
    ).trim();
    const dataBruta = (
      linha["data_admissao"] ??
      linha["data de admissao"] ??
      linha["data admissao"] ??
      linha["admissao"] ??
      ""
    ).trim();
    const gestorNome = (
      linha["gestor"] ??
      linha["gestor_nome"] ??
      linha["nome do gestor"] ??
      linha["analista"] ??
      linha["responsavel"] ??
      ""
    ).trim();
    const gestorEmail = (
      linha["email do gestor"] ??
      linha["e-mail do gestor"] ??
      linha["gestor_email"] ??
      linha["email do analista"] ??
      linha["e-mail do analista"] ??
      linha["email"] ??
      linha["e-mail"] ??
      ""
    ).trim();
    const gestorMatricula = (
      linha["matricula do gestor"] ??
      linha["matrícula do gestor"] ??
      linha["gestor_matricula"] ??
      ""
    ).trim();
    const tipoBruto = (linha["tipo"] ?? linha["novato ou capacitacao"] ?? "novato")
      .trim()
      .toLowerCase();
    const tipo = tipoBruto.startsWith("capacit") ? "capacitacao" : "novato";

    const dataAdmissao = dataBruta ? parseDataAdmissao(dataBruta) : null;

    if (!nome || !matricula || !dataAdmissao || !gestorNome || !gestorEmail || !gestorMatricula) {
      ignorados += 1;
      continue;
    }

    registros.push({
      nome,
      matricula,
      data_admissao: dataAdmissao,
      gestor_nome: gestorNome,
      gestor_email: gestorEmail,
      gestor_matricula: gestorMatricula,
      tipo,
    });
  }

  if (registros.length === 0) {
    return {
      error:
        "Nenhuma linha válida encontrada. Confira as colunas: nome, matricula, data_admissao, gestor, matricula do gestor, email do gestor.",
    };
  }

  const supabase = await createClient();

  const emails = [...new Set(registros.map((r) => r.gestor_email.toLowerCase()))];
  const { data: usuariosExistentes } = await supabase
    .from("usuarios")
    .select("id, email")
    .in("email", emails);

  const idPorEmail = new Map(
    (usuariosExistentes ?? []).map((u) => [u.email.toLowerCase(), u.id])
  );

  const paraInserir = registros.map((registro) => ({
    ...registro,
    gestor_id: idPorEmail.get(registro.gestor_email.toLowerCase()) ?? null,
  }));

  const { error } = await supabase.from("colaboradores").insert(paraInserir);

  if (error) {
    return { error: "Não foi possível importar os colaboradores." };
  }

  revalidatePath("/admin/colaboradores");
  return { inseridos: paraInserir.length, ignorados };
}
