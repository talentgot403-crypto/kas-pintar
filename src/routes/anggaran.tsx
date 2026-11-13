import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Pencil, PiggyBank, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { BookSelect, EmptyState, PageHeader, Panel, StatCard, UsageBar } from "@/components/finance-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BOOK_LABEL,
  EXPENSE_CATEGORIES,
  budgetUsage,
  formatRupiah,
  monthLabel,
  usageTone,
  type Budget,
} from "@/lib/finance";
import { useFinance } from "@/lib/finance-store";

export const Route = createFileRoute("/anggaran")({
  head: () => ({
    meta: [
      { title: "Anggaran — SIKeu Sistem Informasi Kebendaharaan" },
      { name: "description", content: "Pantau alokasi anggaran per pos dan persentase dana yang sudah terpakai." },
      { property: "og:title", content: "Manajemen Anggaran — SIKeu" },
      { property: "og:description", content: "Pantau alokasi anggaran per pos dan persentase dana terpakai." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnggaranPage,
});

const TONE_LABEL = { success: "Aman", warning: "Waspada", danger: "Kritis" } as const;
const TONE_BADGE = { success: "success", warning: "warning", danger: "danger" } as const;

function AnggaranPage() {
  const { bookBudgets: budgets, bookTransactions: transactions, book, now, permissions, deleteBudget } = useFinance();
  const [editing, setEditing] = useState<Budget | "new" | null>(null);
  const usage = useMemo(() => budgetUsage(budgets, transactions, now), [budgets, transactions, now]);
  const alloc = usage.reduce((s, b) => s + b.allocation, 0);
  const used = usage.reduce((s, b) => s + b.used, 0);
  const totalPct = alloc ? Math.round((used / alloc) * 100) : 0;
  const over = usage.filter((b) => b.percent >= 100).length;

  return (
    <>
      <PageHeader
        title="Anggaran"
        description={`Alokasi dana ${BOOK_LABEL[book]} per pos untuk periode ${monthLabel(now, true)}.`}
        actions={
          <>
            <BookSelect />
            {permissions.canManageBudget && (
              <Button onClick={() => setEditing("new")}>
                <Plus /> Tambah Pos Anggaran
              </Button>
            )}
          </>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Alokasi" value={formatRupiah(alloc)} icon={PiggyBank} tone="primary" hint={`${usage.length} pos anggaran`} />
        <StatCard
          label="Total Terpakai"
          value={formatRupiah(used)}
          icon={PiggyBank}
          tone={usageTone(totalPct) === "danger" ? "danger" : "success"}
          hint={`${totalPct}% dari total alokasi`}
        />
        <StatCard
          label="Pos Melebihi Anggaran"
          value={String(over)}
          icon={AlertTriangle}
          tone={over ? "danger" : "warning"}
          hint={over ? "Perlu perhatian bendahara" : "Semua pos masih dalam batas"}
        />
      </div>

      <Panel title="Alokasi per Pos" description="Persentase dihitung dari pengeluaran bulan berjalan.">
        {usage.length === 0 ? (
          <EmptyState
            icon={PiggyBank}
            title="Belum ada pos anggaran"
            description="Tetapkan alokasi dana untuk setiap kategori pengeluaran agar penggunaan dana dapat dipantau."
            action={
              permissions.canManageBudget && (
                <Button onClick={() => setEditing("new")}>
                  <Plus /> Buat Pos Anggaran
                </Button>
              )
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {usage.map((b) => {
              const tone = usageTone(b.percent);
              return (
                <div key={b.id} className="rounded-xl border p-5 transition-shadow hover:shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{b.category}</p>
                      <p className="num mt-0.5 text-sm text-muted-foreground">Alokasi {formatRupiah(b.allocation)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant={TONE_BADGE[tone]}>{TONE_LABEL[tone]}</Badge>
                      {permissions.canManageBudget && (
                        <>
                          <Button variant="ghost" size="icon" aria-label={`Ubah ${b.category}`} onClick={() => setEditing(b)}>
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Hapus ${b.category}`}
                            onClick={() => {
                              deleteBudget(b.id);
                              toast.success(`Pos ${b.category} dihapus`);
                            }}
                          >
                            <Trash2 />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="mt-5 flex items-end justify-between">
                    <p className="num text-3xl font-bold tracking-tight">{b.percent}%</p>
                    <p className="text-right text-xs text-muted-foreground">
                      Terpakai
                      <span className="num block text-sm font-semibold text-foreground">{formatRupiah(b.used)}</span>
                    </p>
                  </div>
                  <UsageBar percent={b.percent} className="mt-3" />
                  <p className="num mt-3 text-xs text-muted-foreground">
                    {b.remaining >= 0 ? (
                      <>Sisa {formatRupiah(b.remaining)}</>
                    ) : (
                      <span className="font-semibold text-destructive">Melebihi {formatRupiah(-b.remaining)}</span>
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <BudgetDialog editing={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function BudgetDialog({ editing, onClose }: { editing: Budget | "new" | null; onClose: () => void }) {
  const { bookBudgets: budgets, book, upsertBudget } = useFinance();
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const isNew = editing === "new";

  useEffect(() => {
    if (editing === "new") {
      setCategory("");
      setAmount("");
    } else if (editing) {
      setCategory(editing.category);
      setAmount(String(editing.allocation));
    }
    setError("");
  }, [editing]);

  const available = EXPENSE_CATEGORIES.filter(
    (c) => !budgets.some((b) => b.category === c) || (editing !== "new" && editing?.category === c),
  );
  const numeric = Number(amount.replace(/\D/g, ""));

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!category) return setError("Pilih kategori pos anggaran");
    if (!numeric) return setError("Alokasi harus lebih dari 0");
    upsertBudget({ id: isNew ? undefined : (editing as Budget).id, category, allocation: numeric });
    toast.success(isNew ? "Pos anggaran ditambahkan" : "Anggaran diperbarui");
    onClose();
  }

  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isNew ? "Tambah Pos Anggaran" : "Ubah Alokasi"}</DialogTitle>
          <DialogDescription>Alokasi {BOOK_LABEL[book]} berlaku per bulan untuk kategori pengeluaran.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <div className="grid gap-1.5">
            <Label>Kategori</Label>
            <Select value={category} onValueChange={setCategory} disabled={!isNew}>
              <SelectTrigger aria-label="Kategori anggaran">
                <SelectValue placeholder={available.length ? "Pilih kategori" : "Semua kategori sudah dianggarkan"} />
              </SelectTrigger>
              <SelectContent>
                {available.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="b-amount">Alokasi per bulan</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">Rp</span>
              <Input
                id="b-amount"
                inputMode="numeric"
                className="num pl-10"
                placeholder="0"
                value={numeric ? numeric.toLocaleString("id-ID") : ""}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit">Simpan</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
