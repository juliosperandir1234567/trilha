import JSZip from "jszip";
import { requireStaff } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";
import { gerarPdfAvaliacao, nomeArquivoPdf, type AvaliacaoPdf } from "@/lib/pdf-avaliacao";
import {
  SELECT_TREINAMENTOS,
  itensDeTreinamento,
  treinamentosPendentes,
  type RespostaComIndicacao,
} from "@/lib/indicacoes";

// Só avaliação finalizada vira PDF: respondida e com todos os treinamentos
// indicados marcados como feitos (sem indicação conta como finalizada).
async function carregarFinalizadas(ids: string[]): Promise<AvaliacaoPdf[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("avaliacoes")
    .select(
      `id, marco, status, data_envio, data_resposta, colaboradores(matricula, nome, gestor_nome, tipo, cargos(nome)), respostas(id, nota, comentario, treinamento_realizado_em, perguntas(texto, ordem), categorias_treinamento:categoria_final_id(nome), ${SELECT_TREINAMENTOS})`
    )
    .in("id", ids)
    .eq("status", "respondida");

  return (data ?? []).flatMap((a) => {
    const colaborador = a.colaboradores as unknown as {
      matricula: string | null;
      nome: string;
      gestor_nome: string;
      tipo: string;
      cargos: { nome: string } | null;
    } | null;
    const respostas = (a.respostas as unknown as (RespostaComIndicacao & {
      nota: number;
      comentario: string | null;
      perguntas: { texto: string; ordem: number | null } | null;
    })[]).sort((x, y) => (x.perguntas?.ordem ?? 0) - (y.perguntas?.ordem ?? 0));

    const finalizada = treinamentosPendentes(respostas) === 0;
    if (!colaborador || !finalizada) return [];

    return [
      {
        matricula: colaborador.matricula,
        nome: colaborador.nome,
        gestorNome: colaborador.gestor_nome,
        tipoColaborador: colaborador.tipo,
        cargo: colaborador.cargos?.nome ?? null,
        marco: a.marco,
        dataEnvio: a.data_envio,
        dataResposta: a.data_resposta,
        respostas: respostas.map((r) => ({
          pergunta: r.perguntas?.texto ?? "",
          nota: r.nota,
          competencia: r.categorias_treinamento?.nome ?? null,
          comentario: r.comentario,
          treinamentos: itensDeTreinamento(r).map((i) => ({ nome: i.nome, realizadoEm: i.realizadoEm })),
        })),
      },
    ];
  });
}

// Nome com acento no download: filename simples + filename* em UTF-8.
function contentDisposition(nome: string) {
  const simples = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, "_");
  return `attachment; filename="${simples}"; filename*=UTF-8''${encodeURIComponent(nome)}`;
}

// Uma avaliação: /admin/avaliacoes/pdf?id=...
export async function GET(request: Request) {
  await requireStaff();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return new Response("Informe a avaliação.", { status: 400 });

  const [avaliacao] = await carregarFinalizadas([id]);
  if (!avaliacao) return new Response("Avaliação não encontrada ou ainda não finalizada.", { status: 404 });

  const pdf = await gerarPdfAvaliacao(avaliacao);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDisposition(nomeArquivoPdf(avaliacao)),
    },
  });
}

// Em massa: formulário da Visão geral manda os ids (campo "ids", separados
// por vírgula) e volta um .zip com um PDF por avaliação.
export async function POST(request: Request) {
  await requireStaff();
  const formData = await request.formData();
  const ids = String(formData.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0) return new Response("Nenhuma avaliação selecionada.", { status: 400 });

  const avaliacoes = await carregarFinalizadas(ids);
  if (avaliacoes.length === 0) {
    return new Response("Nenhuma avaliação finalizada nessa seleção.", { status: 404 });
  }

  const zip = new JSZip();
  const nomesUsados = new Set<string>();
  for (const avaliacao of avaliacoes) {
    let nome = nomeArquivoPdf(avaliacao);
    // Dois arquivos com o mesmo nome no .zip se sobrescrevem.
    for (let n = 2; nomesUsados.has(nome); n++) nome = nomeArquivoPdf(avaliacao).replace(/\.pdf$/, ` (${n}).pdf`);
    nomesUsados.add(nome);
    zip.file(nome, await gerarPdfAvaliacao(avaliacao));
  }

  const conteudo = await zip.generateAsync({ type: "uint8array" });
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }).replace(/\//g, "-");
  return new Response(Buffer.from(conteudo), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": contentDisposition(`avaliacoes-finalizadas-${hoje}.zip`),
    },
  });
}
