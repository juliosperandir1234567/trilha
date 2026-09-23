"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Settings,
  ListChecks,
  GraduationCap,
  Briefcase,
  Users,
  UserCog,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin", label: "Visão geral", icon: LayoutDashboard },
  { href: "/admin/cargos", label: "Cargos", icon: Briefcase },
  { href: "/admin/categorias", label: "Competências", icon: GraduationCap },
  { href: "/admin/perguntas", label: "Perguntas", icon: ListChecks },
  { href: "/admin/colaboradores", label: "Colaboradores", icon: Users },
  { href: "/admin/usuarios", label: "Usuários", icon: UserCog },
  { href: "/admin/configuracoes", label: "Configurações", icon: Settings },
  { href: "/admin/ajuda", label: "Ajuda", icon: HelpCircle },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <>
      {NAV_ITEMS.map((item) => {
        const ativo = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
              ativo
                ? "bg-white font-medium text-primary"
                : "text-sidebar-fg hover:bg-white/10"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
