"use client";

import { useActionState } from "react";
import { Save, UserPlus } from "lucide-react";
import { createColaborador, updateColaborador } from "@/lib/actions/colaboradores";

type Cargo = { id: string; nome: string };

export type ColaboradorEditavel = {
  id: string;
  nome: string;
  matricula: string | null;
  data_admissao: string;
  gestor_nome: string;
  gestor_email: string;
  cargo_id: string | null;
  ativo: boolean;
};

// Sem `colaborador` é o cadastro; com ele, o mesmo formulário edita.
export function ColaboradorForm({
  cargos,
  colaborador,
}: {
  cargos: Cargo[];
  colaborador?: ColaboradorEditavel;
}) {
  const editando = !!colaborador;
  const [state, action, pending] = useActionState(
    editando ? updateColaborador : createColaborador,
    undefined
  );

  return (
    <form action={action} className="flex flex-col gap-4 rounded-lg border border-primary-border p-4">
      {colaborador && <input type="hidden" name="id" value={colaborador.id} />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="matricula" className="text-sm font-medium">
            Matrícula do colaborador
          </label>
          <input
            id="matricula"
            name="matricula"
            defaultValue={colaborador?.matricula ?? undefined}
            required
            className="w-full rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-primary dark:border-white/20"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="nome" className="text-sm font-medium">
            Nome do colaborador
          </label>
          <input
            id="nome"
            name="nome"
            defaultValue={colaborador?.nome}
            required
            className="w-full rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-primary dark:border-white/20"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="data_admissao" className="text-sm font-medium">
            Data de admissão
          </label>
          <input
            id="data_admissao"
            name="data_admissao"
            defaultValue={colaborador?.data_admissao}
            type="date"
            required
            className="w-full rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-primary dark:border-white/20"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="cargo_id" className="text-sm font-medium">
            Cargo
          </label>
          <select
            id="cargo_id"
            name="cargo_id"
            defaultValue={colaborador?.cargo_id ?? ""}
            className="w-full rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/20"
          >
            <option value="">Sem cargo específico</option>
            {cargos.map((cargo) => (
              <option key={cargo.id} value={cargo.id}>
                {cargo.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="gestor_nome" className="text-sm font-medium">
            Nome do gestor
          </label>
          <input
            id="gestor_nome"
            name="gestor_nome"
            defaultValue={colaborador?.gestor_nome}
            required
            className="w-full rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-primary dark:border-white/20"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="gestor_email" className="text-sm font-medium">
            E-mail do gestor
          </label>
          <input
            id="gestor_email"
            name="gestor_email"
            defaultValue={colaborador?.gestor_email}
            type="email"
            required
            className="w-full rounded-md border border-black/15 px-3 py-2 text-sm outline-none focus:border-primary dark:border-white/20"
          />
        </div>
      </div>

      {editando && (
        <label className="flex w-fit items-center gap-2 text-sm">
          <input type="checkbox" name="ativo" defaultChecked={colaborador.ativo} className="h-4 w-4 accent-primary" />
          Colaborador ativo
          <span className="text-xs text-zinc-500">(inativo não recebe novas avaliações)</span>
        </label>
      )}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
        >
          {editando ? <Save className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
          {editando
            ? pending
              ? "Salvando..."
              : "Salvar alterações"
            : pending
              ? "Cadastrando..."
              : "Cadastrar colaborador"}
        </button>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.sucesso && <p className="text-sm text-green-700">Alterações salvas.</p>}
    </form>
  );
}
