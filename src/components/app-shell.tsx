import { Link } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  BarChart3,
  Check,
  ChevronDown,
  FileText,
  LayoutDashboard,
  Menu,
  PiggyBank,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ROLES, monthLabel, personDisplay, type Role } from "@/lib/finance";
import { useFinance } from "@/lib/finance-store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/transaksi", label: "Transaksi", icon: ArrowLeftRight },
  { to: "/anggaran", label: "Anggaran", icon: PiggyBank },
  { to: "/laporan", label: "Laporan", icon: FileText },
  { to: "/pengguna", label: "Pengguna & Peran", icon: Users },
] as const;

function SidebarNav({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          activeOptions={{ exact: item.to === "/" }}
          className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:text-sidebar-accent-foreground"
        >
          <item.icon className="size-4 shrink-0 transition-colors group-data-[status=active]:text-sidebar-primary" />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3 px-2">
      <div className="flex size-10 items-center justify-center rounded-xl bg-brand shadow-elevated">
        <Wallet className="size-5 text-primary-foreground" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold text-sidebar-accent-foreground">SIKeu</p>
        <p className="text-xs text-sidebar-muted">Sistem Kebendaharaan</p>
      </div>
    </div>
  );
}

function SidebarBody({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  const { role, permissions } = useFinance();
  return (
    <div className="flex h-full flex-col gap-8 bg-sidebar p-4 text-sidebar-foreground">
      <Brand />
      <div className="flex flex-col gap-2">
        <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">Menu</p>
        <SidebarNav onNavigate={onNavigate} />
      </div>
      <div className="mt-auto rounded-xl border border-sidebar-border bg-sidebar-accent/60 p-4">
        <div className="flex items-center gap-2 text-sidebar-primary">
          <ShieldCheck className="size-4" />
          <p className="text-xs font-semibold uppercase tracking-wide">Akses aktif</p>
        </div>
        <p className="mt-2 text-sm font-semibold text-sidebar-accent-foreground">{ROLES[role].label}</p>
        <p className="mt-1 text-xs leading-relaxed text-sidebar-muted">{permissions.description}</p>
      </div>
    </div>
  );
}

function RoleMenu() {
  const { role, setRole, people } = useFinance();
  const person = personDisplay(role, people);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-3 rounded-full border bg-card py-1 pl-1 pr-3 shadow-card transition-colors hover:bg-muted">
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary-soft text-xs font-bold text-primary">{person.initials}</AvatarFallback>
          </Avatar>
          <div className="hidden text-left leading-tight sm:block">
            <p className="text-sm font-semibold">{person.name}</p>
            <p className="text-xs text-muted-foreground">{ROLES[role].label}</p>
          </div>
          <ChevronDown className="size-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
          Simulasi masuk sebagai
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(Object.keys(ROLES) as Role[]).map((r) => (
          <DropdownMenuItem key={r} onClick={() => setRole(r)} className="flex items-center gap-3 py-2">
            <Avatar className="size-7">
              <AvatarFallback className="bg-secondary text-[10px] font-bold">{personDisplay(r, people).initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 leading-tight">
              <p className="text-sm font-medium">{personDisplay(r, people).name}</p>
              <p className="text-xs text-muted-foreground">{ROLES[r].label}</p>
            </div>
            {r === role && <Check className="size-4 text-success" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { now } = useFinance();

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 print:hidden lg:block">
        <SidebarBody />
      </aside>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 border-0 p-0">
          <SheetTitle className="sr-only">Menu navigasi</SheetTitle>
          <SidebarBody onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="lg:pl-64 print:pl-0">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur print:hidden sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Buka menu">
            <Menu />
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BarChart3 className="hidden size-4 sm:block" />
            <span className="hidden sm:inline">Periode berjalan:</span>
            <span className="font-semibold capitalize text-foreground">{monthLabel(now, true)}</span>
          </div>
          <div className="ml-auto">
            <RoleMenu />
          </div>
        </header>
        <main className={cn("mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8")}>{children}</main>
      </div>
    </div>
  );
}
