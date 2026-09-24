"use server";

import Papa from "papaparse";
import ExcelJS from "exceljs";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireStaff } from "@/lib/supabase/dal";

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

function celulaParaTexto(valor: ExcelJS.CellValue): string {
  if (valor === null || valor === undefined) return "";
  if (valor instanceof Date) {
    // Datas do Excel não têm fuso — usa os getters UTC pra não escorregar um
    // dia por causa do fuso local do servidor.
    const dia = String(valor.getUTCDate()).padStart(2, "0");
    const mes = String(valor.getUTCMonth() + 1).padStart(2, "0");
    const ano = valor.getUTCFullYear();
    return `${dia}/${mes}/${ano}`;
  }
  if (typeof valor === "object") {
    if ("richText" in valor) {
      return valor.richText.map((parte) => parte.text).join("");
    }
    if ("text" in valor && typeof valor.text === "string") {
      return valor.text;
    }
    if ("result" in valor) {
      return celulaParaTexto(valor.result as ExcelJS.CellValue);
    }
    if ("hyperlink" in valor && "text" in valor) {
      return String(valor.text ?? "");
    }
  }
  return String(valor).trim();
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
  const cargoId = String(formData.get("cargo_id") ?? "").trim();

  if (!nome || !matricula || !dataAdmissao || !gestorNome || !gestorEmail) {
    return { error: "Preencha todos os campos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("colaboradores").insert({
    nome,
    matricula,
    data_admissao: dataAdmissao,
    gestor_nome: gestorNome,
    gestor_email: gestorEmail,
    cargo_id: cargoId || null,
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
    return { error: "Selecione uma planilha." };
  }

  const buffer = await arquivo.arrayBuffer();
  const nomeArquivo = arquivo.name.toLowerCase();
  const ehExcel = nomeArquivo.endsWith(".xlsx");

  let linhas: Record<string, string>[];

  if (ehExcel) {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer);
    } catch {
      return { error: "Não foi possível ler esse arquivo. Salve como .xlsx (Excel) ou .csv e tente de novo." };
    }
    const planilha = workbook.worksheets[0];
    if (!planilha) {
      return { error: "A planilha está vazia." };
    }

    const cabecalhos: string[] = [];
    planilha.getRow(1).eachCell({ includeEmpty: false }, (celula, coluna) => {
      cabecalhos[coluna] = normalizeHeader(String(celula.value ?? ""));
    });

    linhas = [];
    planilha.eachRow((linhaExcel, numeroLinha) => {
      if (numeroLinha === 1) return;
      const linha: Record<string, string> = {};
      linhaExcel.eachCell({ includeEmpty: false }, (celula, coluna) => {
        const chave = cabecalhos[coluna];
        if (!chave) return;
        linha[chave] = celulaParaTexto(celula.value);
      });
      linhas.push(linha);
    });
  } else {
    let texto = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    if (texto.includes("�")) {
      // O Excel do Windows exporta CSV em ANSI (Windows-1252) por padrão, não em
      // UTF-8 — isso quebra qualquer acento (ex: "Admissão"), fazendo o cabeçalho
      // não bater com nada esperado. Tenta de novo assumindo essa codificação.
      texto = new TextDecoder("windows-1252").decode(buffer);
    }

    const { data } = Papa.parse<Record<string, string>>(texto, {
      header: true,
      skipEmptyLines: true,
      transformHeader: normalizeHeader,
    });
    linhas = data;
  }

  const registros: {
    nome: string;
    matricula: string;
    data_admissao: string;
    gestor_nome: string;
    gestor_email: string;
    cargo_nome: string;
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
      linha["email gestor"] ??
      linha["e-mail gestor"] ??
      linha["gestor_email"] ??
      linha["email do analista"] ??
      linha["e-mail do analista"] ??
      linha["email"] ??
      linha["e-mail"] ??
      ""
    ).trim();
    const cargoNome = (linha["cargo"] ?? "").trim();

    const dataAdmissao = dataBruta ? parseDataAdmissao(dataBruta) : null;

    if (!nome || !matricula || !dataAdmissao || !gestorNome || !gestorEmail) {
      ignorados += 1;
      continue;
    }

    registros.push({
      nome,
      matricula,
      data_admissao: dataAdmissao,
      gestor_nome: gestorNome,
      gestor_email: gestorEmail,
      cargo_nome: cargoNome,
    });
  }

  if (registros.length === 0) {
    return {
      error:
        "Nenhuma linha válida encontrada. Confira as colunas: nome, matricula, data_admissao, gestor, email do gestor.",
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

  const { data: cargosExistentes } = await supabase.from("cargos").select("id, nome");
  const idPorCargo = new Map(
    (cargosExistentes ?? []).map((c) => [c.nome.trim().toLowerCase(), c.id])
  );

  const paraInserir = registros.map(({ cargo_nome, ...registro }) => ({
    ...registro,
    gestor_id: idPorEmail.get(registro.gestor_email.toLowerCase()) ?? null,
    cargo_id: cargo_nome ? idPorCargo.get(cargo_nome.toLowerCase()) ?? null : null,
  }));

  const { error } = await supabase.from("colaboradores").insert(paraInserir);

  if (error) {
    return { error: "Não foi possível importar os colaboradores." };
  }

  revalidatePath("/admin/colaboradores");
  return { inseridos: paraInserir.length, ignorados };
}

export type DeleteColaboradoresFormState = { error?: string } | undefined;

export async function deleteColaboradores(
  _prevState: DeleteColaboradoresFormState,
  formData: FormData
): Promise<DeleteColaboradoresFormState> {
  const { user } = await requireAdmin();

  const ids = formData.getAll("ids").map(String).filter(Boolean);
  const senha = String(formData.get("senha") ?? "");

  if (ids.length === 0) {
    return { error: "Selecione ao menos um colaborador." };
  }
  if (!senha) {
    return { error: "Informe sua senha para confirmar." };
  }

  const verificador = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
  const { error: senhaInvalida } = await verificador.auth.signInWithPassword({
    email: user.email!,
    password: senha,
  });

  if (senhaInvalida) {
    return { error: "Senha incorreta." };
  }

  const supabase = await createClient();
  // Exclui em cascata as avaliações, respostas e links desses colaboradores
  // (constraint ON DELETE CASCADE) — ação irreversível de propósito, por
  // isso exige senha de admin.
  const { error } = await supabase.from("colaboradores").delete().in("id", ids);

  if (error) {
    return { error: "Não foi possível excluir os colaboradores selecionados." };
  }

  revalidatePath("/admin/colaboradores");
  revalidatePath("/admin");
}
