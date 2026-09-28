"use server";

import Papa from "papaparse";
import ExcelJS from "exceljs";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireStaff } from "@/lib/supabase/dal";
import { lerEstrutura, lerTurno } from "@/lib/turnos";

// Matrícula que já existe mas veio com outra data de início: não é mexida,
// o admin confere e decide (a data muda de onde os períodos contam).
export type ConflitoDeData = { matricula: string; nome: string; dataAtual: string; dataPlanilha: string };

export type ImportFormState =
  | {
      error?: string;
      inseridos?: number;
      atualizados?: number;
      ignorados?: number;
      // Matrícula que aparece mais de uma vez na mesma planilha (vale a primeira).
      repetidas?: string[];
      conflitos?: ConflitoDeData[];
      // Linhas puladas por falta de dado obrigatório, com o que faltou.
      incompletas?: LinhaIncompleta[];
      // Cargo da planilha que não bate com nenhum cargo cadastrado: o
      // colaborador entra sem cargo (períodos padrão 30/60/90).
      cargosNaoEncontrados?: string[];
    }
  | undefined;

export type LinhaIncompleta = { linha: number; matricula: string; nome: string; falta: string[] };

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

export type ColaboradorFormState = { error?: string; sucesso?: boolean } | undefined;

// Novato conta os períodos da admissão; capacitação (mudança de cargo), da
// data em que mudou de cargo. As duas ficam em data_admissao — é a data de
// início da trilha; o formulário só troca o nome do campo.
function lerTipo(formData: FormData) {
  const tipo = String(formData.get("tipo") ?? "novato").trim();
  return tipo === "capacitacao" ? "capacitacao" : "novato";
}

// Matrícula identifica o colaborador na empresa — duas pessoas com a mesma
// matrícula confundem a tabela e o export. `ignorarId` é o próprio registro
// na edição.
async function matriculaEmUso(
  supabase: Awaited<ReturnType<typeof createClient>>,
  matricula: string,
  ignorarId?: string
) {
  let query = supabase.from("colaboradores").select("nome").eq("matricula", matricula).limit(1);
  if (ignorarId) query = query.neq("id", ignorarId);
  const { data } = await query;
  return data?.[0]?.nome ?? null;
}

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
  const tipo = lerTipo(formData);
  const estruturaMacro = lerEstrutura(String(formData.get("estrutura_macro") ?? ""));
  const turno = lerTurno(String(formData.get("turno") ?? ""));

  if (!nome || !matricula || !dataAdmissao || !gestorNome || !gestorEmail) {
    return { error: "Preencha todos os campos." };
  }

  const supabase = await createClient();
  const donoDaMatricula = await matriculaEmUso(supabase, matricula);
  if (donoDaMatricula) {
    return { error: `A matrícula ${matricula} já pertence a ${donoDaMatricula}.` };
  }

  const { error } = await supabase.from("colaboradores").insert({
    nome,
    matricula,
    data_admissao: dataAdmissao,
    gestor_nome: gestorNome,
    gestor_email: gestorEmail,
    cargo_id: cargoId || null,
    tipo,
    estrutura_macro: estruturaMacro,
    turno,
  });

  if (error) {
    return { error: "Não foi possível cadastrar o colaborador." };
  }

  revalidatePath("/admin/colaboradores");
}

export async function updateColaborador(
  _prevState: ColaboradorFormState,
  formData: FormData
): Promise<ColaboradorFormState> {
  await requireStaff();

  const id = String(formData.get("id") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();
  const matricula = String(formData.get("matricula") ?? "").trim();
  const dataAdmissao = String(formData.get("data_admissao") ?? "").trim();
  const gestorNome = String(formData.get("gestor_nome") ?? "").trim();
  const gestorEmail = String(formData.get("gestor_email") ?? "").trim();
  const cargoId = String(formData.get("cargo_id") ?? "").trim();
  const tipo = lerTipo(formData);
  const estruturaMacro = lerEstrutura(String(formData.get("estrutura_macro") ?? ""));
  const turno = lerTurno(String(formData.get("turno") ?? ""));
  const ativo = formData.get("ativo") === "on";

  if (!id || !nome || !matricula || !dataAdmissao || !gestorNome || !gestorEmail) {
    return { error: "Preencha todos os campos." };
  }

  const supabase = await createClient();
  const donoDaMatricula = await matriculaEmUso(supabase, matricula, id);
  if (donoDaMatricula) {
    return { error: `A matrícula ${matricula} já pertence a ${donoDaMatricula}.` };
  }

  const { error } = await supabase
    .from("colaboradores")
    .update({
      nome,
      matricula,
      data_admissao: dataAdmissao,
      gestor_nome: gestorNome,
      gestor_email: gestorEmail,
      cargo_id: cargoId || null,
      tipo,
      estrutura_macro: estruturaMacro,
      turno,
      ativo,
    })
    .eq("id", id);

  if (error) {
    return { error: "Não foi possível salvar as alterações." };
  }

  revalidatePath("/admin/colaboradores");
  revalidatePath(`/admin/colaboradores/${id}`);
  revalidatePath("/admin");
  return { sucesso: true };
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
    data_fim_experiencia: string | null;
    situacao: string | null;
    gestor_matricula: string | null;
    estrutura_id: string | null;
    gestor_nome: string;
    gestor_email: string;
    cargo_nome: string;
    tipo: string;
    estrutura_macro: string | null;
    turno: string | null;
  }[] = [];
  let ignorados = 0;
  const incompletas: LinhaIncompleta[] = [];

  linhas.forEach((linha, indice) => {
    // Primeira coluna preenchida entre os nomes aceitos (célula vazia do CSV
    // vem como "", não como ausente).
    const campo = (...chaves: string[]) => {
      for (const chave of chaves) {
        const valor = (linha[chave] ?? "").trim();
        if (valor) return valor;
      }
      return "";
    };

    const nome = campo("nome", "colaborador", "nome do colaborador");
    const matricula = campo("matricula", "matricula do colaborador");
    const gestorNome = campo("gestor", "gestor_nome", "nome_gestor", "nome do gestor", "analista", "responsavel");
    const gestorEmail = campo(
      "email do gestor",
      "e-mail do gestor",
      "email gestor",
      "e-mail gestor",
      "gestor_email",
      "email_gestor",
      "email do analista",
      "e-mail do analista",
      "email",
      "e-mail"
    );
    const cargoNome = campo("cargo", "ds_cargo", "ds_cargo_exp");
    const tipoBruto = campo("tipo", "tipo_colaborador", "novato ou capacitacao").toLowerCase();
    const tipo = tipoBruto.startsWith("capacit") ? "capacitacao" : "novato";
    const estruturaMacro = lerEstrutura(campo("estrutura_macro", "estrutura macro", "estrutura"));
    const turno = lerTurno(campo("turno"));

    // Planilha do RH: novato traz a DATA_ADMISSAO; capacitação traz a
    // EXPERIENCIA_INI (início da capacitação) e a admissão vem vazia. Cada
    // tipo olha primeiro a sua coluna e usa a outra se ela faltar.
    const colunasAdmissao = ["data_admissao", "data de admissao", "data admissao", "admissao"];
    const colunasInicioCapacitacao = [
      "experiencia_ini",
      "data_alteracao_cargo",
      "data de alteracao de cargo",
      "data de inicio",
    ];
    const dataBruta =
      tipo === "capacitacao"
        ? campo(...colunasInicioCapacitacao, ...colunasAdmissao)
        : campo(...colunasAdmissao, ...colunasInicioCapacitacao);
    const dataAdmissao = dataBruta ? parseDataAdmissao(dataBruta) : null;
    const situacao = campo("situacao").toUpperCase() || null;
    const estruturaId = campo("id_estrutura", "estrutura_id") || null;
    const gestorMatricula = campo("matricula_gestor", "gestor_matricula", "matricula do gestor") || null;
    const fimBruto = campo("experiencia_fim_1", "experiencia_fim", "fim da experiencia");
    const dataFim = fimBruto ? parseDataAdmissao(fimBruto) : null;

    const falta = [
      !matricula && "matrícula",
      !nome && "nome",
      !dataAdmissao && (tipo === "capacitacao" ? "data de início (EXPERIENCIA_INI)" : "data de admissão"),
      !gestorNome && "nome do gestor",
      !gestorEmail && "e-mail do gestor",
    ].filter((f): f is string => !!f);
    if (falta.length > 0) {
      ignorados += 1;
      // Linha totalmente vazia (fim da planilha) não entra no aviso.
      if (nome || matricula) incompletas.push({ linha: indice + 2, matricula, nome, falta });
      return;
    }

    registros.push({
      nome,
      matricula,
      data_admissao: dataAdmissao!,
      data_fim_experiencia: dataFim,
      situacao,
      gestor_matricula: gestorMatricula,
      estrutura_id: estruturaId,
      gestor_nome: gestorNome,
      gestor_email: gestorEmail,
      cargo_nome: cargoNome,
      tipo,
      estrutura_macro: estruturaMacro,
      turno,
    });
  });

  if (registros.length === 0) {
    return {
      error:
        "Nenhuma linha válida encontrada. Confira as colunas: MATRICULA, NOME, DATA_ADMISSAO (novato) ou EXPERIENCIA_INI (capacitação), NOME_GESTOR e EMAIL_GESTOR.",
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

  // A matrícula identifica o colaborador: se ela já existe, é a mesma pessoa
  // e a trajetória (avaliações já feitas) continua. Só entra cadastro novo
  // pra matrícula nova.
  const matriculas = [...new Set(registros.map((r) => r.matricula))];
  const { data: existentes, error: erroExistentes } = await supabase
    .from("colaboradores")
    .select("id, nome, matricula, data_admissao")
    .in("matricula", matriculas);
  if (erroExistentes) {
    return { error: "Não foi possível importar os colaboradores." };
  }
  const existentePorMatricula = new Map((existentes ?? []).map((c) => [c.matricula as string, c]));

  const cargosNaoEncontrados = [
    ...new Set(registros.map((r) => r.cargo_nome).filter((c) => c && !idPorCargo.has(c.toLowerCase()))),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  const vistas = new Set<string>();
  const repetidas: string[] = [];
  const conflitos: ConflitoDeData[] = [];
  const paraInserir = [];
  const paraAtualizar = [];

  for (const { cargo_nome, ...registro } of registros) {
    if (vistas.has(registro.matricula)) {
      if (!repetidas.includes(registro.matricula)) repetidas.push(registro.matricula);
      continue;
    }
    vistas.add(registro.matricula);

    const gestorId = idPorEmail.get(registro.gestor_email.toLowerCase()) ?? null;
    const cargoId = cargo_nome ? idPorCargo.get(cargo_nome.toLowerCase()) ?? null : null;
    const existente = existentePorMatricula.get(registro.matricula);

    if (!existente) {
      paraInserir.push({ ...registro, gestor_id: gestorId, cargo_id: cargoId });
      continue;
    }

    if (existente.data_admissao !== registro.data_admissao) {
      conflitos.push({
        matricula: registro.matricula,
        nome: existente.nome,
        dataAtual: existente.data_admissao,
        dataPlanilha: registro.data_admissao,
      });
      continue;
    }

    // Mesma pessoa, mesma data: atualiza o cadastro. Coluna opcional vazia
    // na planilha não apaga o que já estava preenchido.
    paraAtualizar.push({
      id: existente.id,
      campos: {
        nome: registro.nome,
        tipo: registro.tipo,
        gestor_nome: registro.gestor_nome,
        gestor_email: registro.gestor_email,
        gestor_id: gestorId,
        ...(registro.estrutura_macro ? { estrutura_macro: registro.estrutura_macro } : {}),
        ...(registro.turno ? { turno: registro.turno } : {}),
        ...(cargoId ? { cargo_id: cargoId } : {}),
        ...(registro.data_fim_experiencia ? { data_fim_experiencia: registro.data_fim_experiencia } : {}),
        ...(registro.situacao ? { situacao: registro.situacao } : {}),
        ...(registro.gestor_matricula ? { gestor_matricula: registro.gestor_matricula } : {}),
        ...(registro.estrutura_id ? { estrutura_id: registro.estrutura_id } : {}),
      },
    });
  }

  if (paraInserir.length > 0) {
    const { error } = await supabase.from("colaboradores").insert(paraInserir);
    if (error) {
      return { error: "Não foi possível importar os colaboradores." };
    }
  }

  for (const { id, campos } of paraAtualizar) {
    const { error } = await supabase.from("colaboradores").update(campos).eq("id", id);
    if (error) {
      return {
        error: `Os novos foram cadastrados, mas não foi possível atualizar a matrícula ${
          (existentes ?? []).find((c) => c.id === id)?.matricula
        }.`,
      };
    }
  }

  revalidatePath("/admin/colaboradores");
  revalidatePath("/admin");
  return {
    inseridos: paraInserir.length,
    atualizados: paraAtualizar.length,
    ignorados,
    repetidas,
    conflitos,
    incompletas,
    cargosNaoEncontrados,
  };
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
