import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Archive, ArrowRight, CalendarRange, Clock, Eye, Lock, RefreshCcw, UserRoundCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader, Panel } from "@/components/finance-ui";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CASH_BOOKS,
  formatDate,
  formatRupiah,
  membersOf,
  nextSchoolYear,
  periodSummary,
  ROLES,
  sortPeriods,
  type Period,
} from "@/lib/finance";
import { useFinance } from "@/lib/finance-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/periode")({
  head: () => ({
    meta: [
      { title: "Periode Kepengurusan — SIKeu Sistem Informasi Kebendaharaan" },
      {
        name: "description",
        content: "Kelola periode kepengurusan OSIS: tutup buku, arsipkan periode lama, dan mulai periode baru dari nol.",
      },
      { property: "og:title", content: "Periode Kepengurusan — SIKeu" },
      { property: "og:description", content: "Tutup buku, arsip otomatis, dan periode baru yang mulai dari nol." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PeriodePage,
});

function BookBalances({ balances }: { balances: ReturnType<typeof periodSummary>["balances"] }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {CASH_BOOKS.map((b) => (
        <div key={b.id} className="rounded-xl border bg-muted/40 p-3">
          <p className="text-xs text-muted-foreground">{b.label}</p>
          <p className="num mt-1 font-bold">{formatRupiah(balances[b.id])}</p>
        </div>
      ))}
    </div>
  );
}

function PeriodePage() {
  const { periods, activePeriod, selectedPeriodId, setSelectedPeriod, transactions, members, role, startNewPeriod } =
    useFinance();
  const navigate = useNavigate();
  const canHandover = ROLES[role].canHandover;
  const next = nextSchoolYear(activePeriod);
  const summary = periodSummary(transactions, activePeriod.id);
  const successors = membersOf(members, next.id);
  const [carry, setCarry] = useState(false);
  const [access, setAccess] = useState<"read-only" | "dicabut">("read-only");
  const [confirm, setConfirm] = useState(false);

  const run = () => {
    const res = startNewPeriod({ carryBalance: carry, oldMemberAccess: access });
    if (!res.ok) {
      toast.error("Tutup buku gagal", { description: res.error });
      return;
    }
    toast.success(`Periode ${res.next.label} dimulai`, {
      description: `Periode ${res.closed.label} sudah diarsipkan. ${carry ? "Sisa saldo dibawa sebagai Saldo Awal." : "Saldo mulai dari Rp 0."}`,
    });
  };

  const view = (p: Period) => {
    setSelectedPeriod(p.id);
    void navigate({ to: "/" });
  };

  return (
    <>
      <PageHeader
        title="Periode Kepengurusan"
        description="Setiap periode punya pembukuan sendiri. Periode yang ditutup otomatis menjadi arsip hanya-baca."
      />

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Panel
          title={`Periode aktif ${activePeriod.label}`}
          description={`${formatDate(activePeriod.start)} – ${formatDate(activePeriod.end)}`}
          action={<Badge variant="success">Aktif</Badge>}
        >
          <BookBalances balances={summary.balances} />
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span>{summary.count} transaksi tercatat</span>
            {summary.pending > 0 && (
              <span className="flex items-center gap-1.5 font-medium text-warning-foreground">
                <Clock className="size-4" /> {summary.pending} menunggu persetujuan Pembina
              </span>
            )}
          </div>
        </Panel>

        <Panel
          title={`Tutup Buku & Mulai ${next.label}`}
          description="Untuk serah terima jabatan di akhir masa kepengurusan."
        >
          <ul className="mb-5 grid gap-2 text-sm">
            <li className="flex gap-2">
              <Archive className="mt-0.5 size-4 shrink-0 text-primary" />
              Periode {activePeriod.label} diarsipkan dan tidak bisa diubah lagi.
            </li>
            <li className="flex gap-2">
              <RefreshCcw className="mt-0.5 size-4 shrink-0 text-primary" />
              Periode {next.label} dimulai dari nol: tanpa transaksi, tanpa anggaran
              {carry ? ", dengan sisa saldo sebagai Saldo Awal." : ", saldo Rp 0."}
            </li>
            <li className="flex gap-2">
              <UserRoundCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              {successors.length > 0
                ? `${successors.length} penerus ${next.label} langsung menjadi pengurus aktif.`
                : `Belum ada penerus ${next.label}. Isi dulu di halaman Pengguna & Peran.`}
            </li>
          </ul>

          {canHandover ? (
            <>
              <div className="grid gap-4 rounded-xl border bg-muted/30 p-4">
                <div className="flex items-start gap-3">
                  <Checkbox id="carry" checked={carry} onCheckedChange={(v) => setCarry(v === true)} />
                  <Label htmlFor="carry" className="grid gap-1 font-normal leading-snug">
                    <span className="font-medium">Bawa sisa saldo ke periode baru</span>
                    <span className="text-xs text-muted-foreground">
                      Biarkan kosong agar periode baru benar-benar mulai dari Rp 0.
                    </span>
                  </Label>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="old-access">Akses pengurus lama setelah tutup buku</Label>
                  <Select value={access} onValueChange={(v) => setAccess(v as "read-only" | "dicabut")}>
                    <SelectTrigger id="old-access" className="bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="read-only">Hanya-baca (bisa melihat arsip)</SelectItem>
                      <SelectItem value="dicabut">Dicabut</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {summary.pending > 0 && (
                <p className="mt-3 text-sm text-warning-foreground">
                  Selesaikan {summary.pending} transaksi yang menunggu persetujuan Pembina sebelum tutup buku.
                </p>
              )}
              <Button className="mt-4 w-full" disabled={summary.pending > 0} onClick={() => setConfirm(true)}>
                Tutup Buku {activePeriod.label} <ArrowRight />
              </Button>
            </>
          ) : (
            <p className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground">
              <Lock className="size-3.5" /> Hanya Bendahara Utama yang dapat menutup buku.
            </p>
          )}
        </Panel>
      </div>

      <Panel title="Riwayat Periode" description="Pilih periode untuk melihat dashboard, transaksi, dan laporannya.">
        <ul className="divide-y">
          {sortPeriods(periods).map((p) => {
            const s = periodSummary(transactions, p.id);
            const isActive = p.status === "aktif";
            return (
              <li key={p.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 md:flex-row md:items-center">
                <div className="flex min-w-44 items-center gap-3">
                  <div
                    className={cn(
                      "flex size-10 items-center justify-center rounded-xl",
                      isActive ? "bg-success-soft text-success" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {isActive ? <CalendarRange className="size-5" /> : <Archive className="size-5" />}
                  </div>
                  <div>
                    <p className="font-semibold">{p.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {isActive ? "Sedang berjalan" : p.closedAt ? `Ditutup ${formatDate(p.closedAt)}` : "Arsip"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-1 flex-wrap gap-x-6 gap-y-1 text-sm">
                  {CASH_BOOKS.map((b) => (
                    <span key={b.id}>
                      <span className="text-muted-foreground">{b.label}: </span>
                      <span className="num font-semibold">{formatRupiah(s.balances[b.id])}</span>
                    </span>
                  ))}
                  <span className="text-muted-foreground">{s.count} transaksi</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={isActive ? "success" : "muted"}>{isActive ? "Aktif" : "Arsip · hanya-baca"}</Badge>
                  <Button
                    size="sm"
                    variant={p.id === selectedPeriodId ? "secondary" : "outline"}
                    onClick={() => view(p)}
                    aria-label={`Lihat periode ${p.label}`}
                  >
                    <Eye /> Lihat
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </Panel>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tutup buku periode {activePeriod.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              Periode {activePeriod.label} akan diarsipkan dan tidak bisa diubah lagi. Periode {next.label} dimulai{" "}
              {carry ? "dengan sisa saldo tiap buku kas sebagai Saldo Awal." : "dari Rp 0 untuk Kas OSIS dan Kas Angkatan."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={run}>Ya, tutup buku</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
