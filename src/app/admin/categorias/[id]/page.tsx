import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PERIODOS_FILTRO } from "@/lib/periodos";

const MARCOS_FILTRO = PERIODOS_FILTRO;

export default async function CategoriaDetalhePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ marco?: string }>;
}) {
  const { id } = await params;
  const { marco } = await searchParams;
  const supabase = await createClient();

  const { data: categoria } = await supabase
    .from("categorias_treinamento")
    .select("id, nome")
    .eq("id", id)
    .single();

  if (!categoria) notFound();

  let query = supabase
    .from("respostas")
    .select(
      "id, nota, comentario, created_at, treinamentos:treinamento_final_id(nome), avaliacoes!inner(marco, colaboradores(id, nome, matricula, gestor_nome, gestor_email))"
    )
    .eq("categoria_final_id", id)
    .order("created_at", { ascending: false });

  if (marco) query = query.eq("avaliacoes.marco", Number(marco));

  const { data: respostas } = await query;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/categorias" className="text-sm text-primary underline underline-offset-2">
            ← Voltar
          </Link>
          <h1 className="mt-2 text-xl font-semibold">
            Indicados: {categoria.nome}
            {marco ? ` — ${marco} dias` : ""}
          </h1>
        </div>
        <a
          href={`/admin/categorias/${id}/export${marco ? `?marco=${marco}` : ""}`}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
        >
          <Download className="h-4 w-4" />
          Exportar CSV
        </a>
      </div>

      <div className="flex gap-2">
        {MARCOS_FILTRO.map((opcao) => {
          const ativo = (marco ?? "") === opcao.valor;
          const href = opcao.valor
            ? `/admin/categorias/${id}?marco=${opcao.valor}`
            : `/admin/categorias/${id}`;
          return (
            <Link
              key={opcao.label}
              href={href}
              className={`rounded-full px-3 py-1 text-sm ${
                ativo
                  ? "bg-primary text-primary-foreground"
                  : "border border-primary-border text-primary hover:bg-primary-soft"
              }`}
            >
              {opcao.label}
            </Link>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-lg border border-primary-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b-2 border-primary-border bg-primary-soft/40 text-primary">
              <th className="whitespace-nowrap px-4 py-3">Matrícula</th>
              <th className="px-4 py-3">Colaborador</th>
              <th className="whitespace-nowrap px-4 py-3">Período</th>
              <th className="whitespace-nowrap px-4 py-3">Nota</th>
              <th className="px-4 py-3">Treinamento</th>
              <th className="px-4 py-3">Comentário</th>
              <th className="px-4 py-3">Gestor</th>
            </tr>
          </thead>
          <tbody>
            {(respostas ?? []).map((resposta) => {
              const avaliacao = resposta.avaliacoes as unknown as {
                marco: number;
                colaboradores: {
                  id: string;
                  nome: string;
                  matricula: string | null;
                  gestor_nome: string;
                  gestor_email: string;
                } | null;
              } | null;
              const colaborador = avaliacao?.colaboradores;
              const treinamento = resposta.treinamentos as unknown as { nome: string } | null;

              return (
                <tr
                  key={resposta.id}
                  className="border-b border-primary-border/40 last:border-b-0 hover:bg-primary-soft/20"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-500">{colaborador?.matricula}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/colaboradores/${colaborador?.id}`}
                      className="text-primary underline underline-offset-2"
                    >
                      {colaborador?.nome}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{avaliacao?.marco} dias</td>
                  <td className="whitespace-nowrap px-4 py-3">{resposta.nota}</td>
                  <td className="px-4 py-3">{treinamento?.nome ?? "-"}</td>
                  <td className="px-4 py-3 text-zinc-500 italic">{resposta.comentario ?? "-"}</td>
                  <td className="px-4 py-3 text-zinc-500">{colaborador?.gestor_nome}</td>
                </tr>
              );
            })}
            {(respostas ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-zinc-500">
                  Nenhum colaborador indicado para este treinamento ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
