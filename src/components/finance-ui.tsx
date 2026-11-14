import { ArrowDownLeft, ArrowUpRight, BookOpen, CalendarRange, CheckCircle2, Clock, XCircle, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CASH_BOOKS, sortPeriods, STATUS_LABEL, usageTone, type CashBook, type TxStatus, type TxType } from "@/lib/finance";
import { useFinance } from "@/lib/finance-store";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border bg-card p-5 shadow-card sm:p-6", className)}>
      {(title || action) && (
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            {title && <h2 className="text-base font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Pilihan buku kas yang sedang dibuka; berlaku di Dashboard, Transaksi, Anggaran & Laporan. */
export function BookSelect({ className }: { className?: string }) {
  const { book, setBook } = useFinance();
  return (
    <Select value={book} onValueChange={(v) => setBook(v as CashBook)}>
      <SelectTrigger aria-label="Pilih buku kas" className={cn("h-10 w-[11.5rem] bg-card font-semibold", className)}>
        <BookOpen className="size-4 text-primary" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CASH_BOOKS.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Pilihan periode kepengurusan; periode lama tampil sebagai arsip hanya-baca. */
export function PeriodSelect({ className }: { className?: string }) {
  const { periods, selectedPeriodId, setSelectedPeriod } = useFinance();
  return (
    <Select value={selectedPeriodId} onValueChange={setSelectedPeriod}>
      <SelectTrigger aria-label="Pilih periode kepengurusan" className={cn("h-10 w-[12.5rem] bg-card font-semibold", className)}>
        <CalendarRange className="size-4 text-primary" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {sortPeriods(periods).map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.label} · {p.status === "aktif" ? "Aktif" : "Arsip"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const STAT_TONES = {
  primary: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  danger: "bg-destructive-soft text-destructive",
  warning: "bg-warning-soft text-warning-foreground",
} as const;

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  icon: LucideIcon;
  tone?: keyof typeof STAT_TONES;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className={cn("flex size-10 items-center justify-center rounded-xl", STAT_TONES[tone])}>
          <Icon className="size-5" />
        </div>
      </div>
      <p className="num mt-3 text-2xl font-bold tracking-tight">{value}</p>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center", compact ? "py-8" : "py-14")}>
      <div className="relative mb-5">
        <div className="absolute inset-0 scale-150 rounded-full bg-primary-soft blur-xl" />
        <div className="relative flex size-16 items-center justify-center rounded-2xl border bg-card shadow-card">
          <Icon className="size-7 text-primary" />
        </div>
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function TypeBadge({ type }: { type: TxType }) {
  return type === "masuk" ? (
    <Badge variant="success">
      <ArrowDownLeft /> Masuk
    </Badge>
  ) : (
    <Badge variant="info">
      <ArrowUpRight /> Keluar
    </Badge>
  );
}

export function StatusBadge({ status }: { status: TxStatus }) {
  const map = {
    selesai: { variant: "success", icon: CheckCircle2 },
    menunggu: { variant: "warning", icon: Clock },
    dibatalkan: { variant: "muted", icon: XCircle },
  } as const;
  const { variant, icon: Icon } = map[status];
  return (
    <Badge variant={variant}>
      <Icon /> {STATUS_LABEL[status]}
    </Badge>
  );
}

const BAR_TONES = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
} as const;

export function UsageBar({ percent, className }: { percent: number; className?: string }) {
  const tone = usageTone(percent);
  return (
    <div className={cn("h-2.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-700", BAR_TONES[tone])}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}
