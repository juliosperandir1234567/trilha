"use client";

import { useActionState } from "react";
import { Upload } from "lucide-react";
import { importColaboradores } from "@/lib/actions/colaboradores";

const dataBR = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("pt-BR");

export function ImportForm() {
  const [state, action, pending] = useActionState(importColaboradores, undefined);

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="planilha" className="text-sm font-medium">
          Planilha (.xlsx ou .csv)
        </label>
        <input
          id="planilha"
          name="planilha"
          type="file"
          accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="text-sm"
        />
        <p className="text-xs text-zinc-500">
          Aceita a planilha do RH direto: <code>MATRICULA</code>, <code>NOME</code>,{" "}
          <code>SITUACAO</code>, <code>TURNO</code>, <code>DS_CARGO_EXP</code> (precisa bater com o nome
          de um cargo em Cargos), <code>EXPERIENCIA_INI</code>, <code>EXPERIENCIA_FIM_1</code>,{" "}
          <code>DATA_ADMISSAO</code>, <code>TIPO_COLABORADOR</code> (novato ou capacitação),{" "}
          <code>MATRICULA_GESTOR</code>, <code>NOME_GESTOR</code> e <code>EMAIL_GESTOR</code>. Os
          períodos contam da <strong>DATA_ADMISSAO</strong> pra novato e da{" "}
          <strong>EXPERIENCIA_INI</strong> pra capacitação. DIAS_EMPRESA, PROXIMA_AVALIACAO e
          DATA_PROXIMA_AVALIACAO são ignoradas: o sistema calcula as dele. Opcional:{" "}
          <code>ESTRUTURA_MACRO</code> (ex.: UTAG). Pode enviar o .xlsx ou um .csv. Matrícula já cadastrada não duplica: o
          cadastro é atualizado e a trajetória continua.
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex w-fit items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
      >
        <Upload className="h-4 w-4" />
        {pending ? "Importando..." : "Importar"}
      </button>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.inseridos !== undefined && (
        <div className="flex flex-col gap-2 text-sm">
          <p className="text-green-700 dark:text-green-500">
            {state.inseridos} novo(s) cadastrado(s) · {state.atualizados ?? 0} já existente(s) atualizado(s)
            {state.incompletas?.length ? ` · ${state.incompletas.length} linha(s) com dado faltando` : ""}.
          </p>
          {!!state.cargosNaoEncontrados?.length && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900">
              <p className="font-medium">
                Cargo(s) da planilha sem cadastro em Cargos — esses colaboradores entraram sem cargo (períodos
                padrão 30/60/90):
              </p>
              <p className="mt-1 text-xs">{state.cargosNaoEncontrados.join(" · ")}</p>
              <p className="mt-1 text-xs">
                Cadastre o cargo com o mesmo nome em Cargos e importe de novo: o cargo é preenchido sem duplicar
                ninguém.
              </p>
            </div>
          )}
          {!!state.incompletas?.length && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-900">
              <p className="font-medium">{state.incompletas.length} linha(s) não importada(s) por falta de dado:</p>
              <ul className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto text-xs">
                {state.incompletas.map((l) => (
                  <li key={l.linha}>
                    Linha {l.linha}
                    {l.matricula ? ` · ${l.matricula}` : ""}
                    {l.nome ? ` ${l.nome}` : ""} — falta {l.falta.join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!!state.repetidas?.length && (
            <p className="text-amber-700">
              Matrícula repetida na planilha (valeu a primeira linha): {state.repetidas.join(", ")}.
            </p>
          )}
          {!!state.conflitos?.length && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900">
              <p className="font-medium">
                {state.conflitos.length} colaborador(es) não alterado(s): a data de início na planilha é diferente
                da cadastrada. Confira e, se for o caso, altere na página do colaborador.
              </p>
              <ul className="mt-2 flex flex-col gap-1 text-xs">
                {state.conflitos.map((c) => (
                  <li key={c.matricula}>
                    <span className="font-medium">{c.matricula}</span> {c.nome} — cadastrado{" "}
                    {dataBR(c.dataAtual)}, planilha {dataBR(c.dataPlanilha)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
