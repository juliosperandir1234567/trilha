const MARCOS = [30, 60, 90, 120, 180, 270] as const;

export function MarcosCheckboxes({ marcosSelecionados }: { marcosSelecionados: number[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {MARCOS.map((marco) => (
        <label
          key={marco}
          className="flex items-center gap-1.5 rounded-md border border-black/15 px-2.5 py-1.5 text-sm dark:border-white/20"
        >
          <input
            type="checkbox"
            name="marcos"
            value={marco}
            defaultChecked={marcosSelecionados.includes(marco)}
            className="accent-primary"
          />
          {marco} dias
        </label>
      ))}
    </div>
  );
}
