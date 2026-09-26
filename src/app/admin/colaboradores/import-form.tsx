"use client";

import { useActionState } from "react";
import { Upload } from "lucide-react";
import { importColaboradores } from "@/lib/actions/colaboradores";

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
          Colunas esperadas: <code>matricula</code>, <code>nome</code>,{" "}
          <code>data_admissao</code> (dd/mm/aaaa ou aaaa-mm-dd; pra capacitação, a data da
          mudança de cargo), <code>tipo</code> (<code>novato</code> ou{" "}
          <code>capacitacao</code>, opcional — padrão novato),{" "}
          <code>estrutura_macro</code> (opcional, ex.: UTAG), <code>turno</code> (opcional: fixo,
          diurno, vespertino ou noturno), <code>cargo</code> (opcional — precisa bater com o nome de um cargo já cadastrado
          em Cargos), <code>gestor</code>, <code>email do gestor</code>. Pode enviar direto o
          arquivo do Excel (.xlsx) ou exportar como CSV.
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
        <p className="text-sm text-green-700 dark:text-green-500">
          {state.inseridos} colaborador(es) importado(s)
          {state.ignorados ? `, ${state.ignorados} linha(s) ignorada(s) por dados incompletos` : ""}
          .
        </p>
      )}
    </form>
  );
}
