import "server-only";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { NOTAS, nomeDaNota } from "@/lib/escala";

export type RespostaPdf = {
  pergunta: string;
  nota: number;
  competencia: string | null;
  comentario: string | null;
  // Treinamentos indicados; sem treinamento específico, um item com nome
  // null representa a própria competência.
  treinamentos: { nome: string | null; realizadoEm: string | null }[];
};

export type AvaliacaoPdf = {
  matricula: string | null;
  nome: string;
  gestorNome: string;
  tipoColaborador: string;
  cargo: string | null;
  marco: number;
  dataEnvio: string | null;
  dataResposta: string | null;
  respostas: RespostaPdf[];
};

// Logo da usina (Configurações). O pdf-lib só embute PNG e JPG.
export type LogoPdf = { bytes: Uint8Array; tipo: "png" | "jpg" };

// Descobre o formato pelos primeiros bytes; outro formato fica sem logo.
export function lerLogo(bytes: Uint8Array): LogoPdf | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { bytes, tipo: "png" };
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return { bytes, tipo: "jpg" };
  return null;
}

// Caixa onde a logo cabe no canto superior direito, mantendo a proporção.
const LOGO_LARGURA_MAX = 110;
const LOGO_ALTURA_MAX = 55;

const MARGEM = 50;
const LARGURA = 595.28; // A4
const ALTURA = 841.89;
const VERDE = rgb(0.13, 0.4, 0.2);
const CINZA = rgb(0.4, 0.4, 0.4);

// Cor da nota, a mesma da escala no sistema (hex #rrggbb -> rgb do pdf-lib).
function corDaNota(nota: number) {
  const hex = NOTAS.find((n) => n.valor === nota)?.cor;
  if (!hex) return undefined;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return rgb(r, g, b);
}

function dataBR(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

// "Código-Nome-Avaliação 30 dias-dd-mm-aaaa.pdf", sem caracteres que o
// Windows não aceita em nome de arquivo.
export function nomeArquivoPdf(avaliacao: AvaliacaoPdf) {
  const data = dataBR(avaliacao.dataResposta).replace(/\//g, "-");
  const partes = [avaliacao.matricula ?? "sem-codigo", avaliacao.nome, `Avaliação ${avaliacao.marco} dias`, data];
  return `${partes.join("-").replace(/[\\/:*?"<>|]/g, "").trim()}.pdf`;
}

export async function gerarPdfAvaliacao(avaliacao: AvaliacaoPdf, logo?: LogoPdf | null): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Avaliação de ${avaliacao.marco} dias — ${avaliacao.nome}`);
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);

  // As fontes padrão do PDF só têm o alfabeto latino (acentos do português
  // incluídos); qualquer outro caractere (emoji, por exemplo) vira "?".
  const cacheCaractere = new Map<string, string>();
  function limpar(texto: string, f: PDFFont) {
    return [...texto.replace(/\r?\n/g, " ")]
      .map((c) => {
        if (!cacheCaractere.has(c)) {
          try {
            f.widthOfTextAtSize(c, 10);
            cacheCaractere.set(c, c);
          } catch {
            cacheCaractere.set(c, "?");
          }
        }
        return cacheCaractere.get(c)!;
      })
      .join("");
  }

  let pagina: PDFPage = pdf.addPage([LARGURA, ALTURA]);
  let y = ALTURA - MARGEM;

  function novaPaginaSePreciso(altura: number) {
    if (y - altura < MARGEM) {
      pagina = pdf.addPage([LARGURA, ALTURA]);
      y = ALTURA - MARGEM;
    }
  }

  // Escreve quebrando em linhas pela largura disponível.
  function escrever(
    texto: string,
    opcoes: { tamanho?: number; f?: PDFFont; cor?: ReturnType<typeof rgb>; recuo?: number; espaco?: number } = {}
  ) {
    const tamanho = opcoes.tamanho ?? 10;
    const f = opcoes.f ?? fonte;
    const recuo = opcoes.recuo ?? 0;
    const larguraMax = LARGURA - MARGEM * 2 - recuo;
    const palavras = limpar(texto, f).split(" ");
    let linha = "";
    const linhas: string[] = [];
    for (const palavra of palavras) {
      const tentativa = linha ? `${linha} ${palavra}` : palavra;
      if (f.widthOfTextAtSize(tentativa, tamanho) > larguraMax && linha) {
        linhas.push(linha);
        linha = palavra;
      } else {
        linha = tentativa;
      }
    }
    if (linha) linhas.push(linha);
    for (const l of linhas) {
      novaPaginaSePreciso(tamanho + 4);
      pagina.drawText(l, { x: MARGEM + recuo, y: y - tamanho, size: tamanho, font: f, color: opcoes.cor });
      y -= tamanho + 4;
    }
    y -= opcoes.espaco ?? 0;
  }

  // Logo no canto superior direito da primeira página. Se a imagem não
  // abrir, o PDF sai sem logo.
  if (logo) {
    try {
      const imagem = logo.tipo === "png" ? await pdf.embedPng(logo.bytes) : await pdf.embedJpg(logo.bytes);
      const escala = Math.min(LOGO_LARGURA_MAX / imagem.width, LOGO_ALTURA_MAX / imagem.height, 1);
      const largura = imagem.width * escala;
      const altura = imagem.height * escala;
      pagina.drawImage(imagem, {
        x: LARGURA - MARGEM - largura,
        y: ALTURA - MARGEM - altura,
        width: largura,
        height: altura,
      });
    } catch {
      // imagem corrompida: segue sem logo
    }
  }

  // Cabeçalho: código, nome e gestor.
  escrever("Trilha Desenvolve+", { tamanho: 9, f: negrito, cor: VERDE, espaco: 2 });
  escrever(`Avaliação de ${avaliacao.marco} dias`, { tamanho: 16, f: negrito, espaco: 6 });
  escrever(`Código: ${avaliacao.matricula ?? "-"}`, { tamanho: 11, f: negrito });
  escrever(`Nome: ${avaliacao.nome}`, { tamanho: 11, f: negrito });
  escrever(`Gestor: ${avaliacao.gestorNome}`, { tamanho: 11, f: negrito, espaco: 4 });
  escrever(
    [
      avaliacao.tipoColaborador === "capacitacao" ? "Capacitação (mudança de cargo)" : "Novato",
      avaliacao.cargo ? `Cargo: ${avaliacao.cargo}` : null,
      `Enviada em ${dataBR(avaliacao.dataEnvio)}`,
      `Respondida em ${dataBR(avaliacao.dataResposta)}`,
    ]
      .filter(Boolean)
      .join("  ·  "),
    { tamanho: 9, cor: CINZA, espaco: 6 }
  );
  pagina.drawLine({
    start: { x: MARGEM, y },
    end: { x: LARGURA - MARGEM, y },
    thickness: 1,
    color: VERDE,
  });
  y -= 14;

  avaliacao.respostas.forEach((resposta, i) => {
    novaPaginaSePreciso(40);
    escrever(`${i + 1}. ${resposta.pergunta}`, { tamanho: 10, f: negrito, espaco: 1 });
    escrever(`Nota: ${resposta.nota} — ${nomeDaNota(resposta.nota)}`, {
      recuo: 12,
      f: negrito,
      cor: corDaNota(resposta.nota),
    });
    if (resposta.competencia) {
      escrever(`Indicação: ${resposta.competencia}`, { recuo: 12 });
      for (const treinamento of resposta.treinamentos) {
        const situacao = treinamento.realizadoEm
          ? `realizado em ${dataBR(treinamento.realizadoEm)}`
          : "ainda não realizado";
        escrever(`• ${treinamento.nome ?? "Treinamento da competência"} — ${situacao}`, {
          recuo: 20,
          cor: CINZA,
        });
      }
    }
    if (resposta.comentario) {
      escrever(`Comentário: ${resposta.comentario}`, { recuo: 12, cor: CINZA });
    }
    y -= 8;
  });

  // Rodapé com número da página.
  const paginas = pdf.getPages();
  paginas.forEach((p, i) => {
    p.drawText(limpar(`${avaliacao.nome} — página ${i + 1} de ${paginas.length}`, fonte), {
      x: MARGEM,
      y: MARGEM / 2,
      size: 8,
      font: fonte,
      color: CINZA,
    });
  });

  return pdf.save();
}
