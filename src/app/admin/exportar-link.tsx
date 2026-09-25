"use client";

import { useRouter } from "next/navigation";
import { Download } from "lucide-react";

// Link de download do CSV. Exportar marca as indicações como exportadas, então
// depois do clique a página recarrega os dados pra atualizar "Falta exportar".
export function ExportarLink({
  href,
  children,
  destaque,
}: {
  href: string;
  children: React.ReactNode;
  destaque?: boolean;
}) {
  const router = useRouter();

  return (
    <a
      href={href}
      onClick={() => setTimeout(() => router.refresh(), 2000)}
      className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm ${
        destaque
          ? "bg-primary font-medium text-primary-foreground hover:bg-primary-hover"
          : "border border-primary-border text-primary hover:bg-primary-soft"
      }`}
    >
      <Download className="h-4 w-4" />
      {children}
    </a>
  );
}
