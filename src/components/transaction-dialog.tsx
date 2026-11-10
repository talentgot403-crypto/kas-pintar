import { format } from "date-fns";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Check, Loader2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

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
  categoriesFor,
  duplicateCandidates,
  formatDate,
  formatRupiah,
  type AiAnalysis,
  type TxStatus,
  type TxType,
} from "@/lib/finance";
import { useFinance } from "@/lib/finance-store";
import { suggestTransactionInsights } from "@/lib/transaction-ai.functions";
import { cn } from "@/lib/utils";

type Errors = Partial<Record<"date" | "description" | "category" | "amount", string>>;

const CONFIDENCE_LABEL = { tinggi: "Keyakinan tinggi", sedang: "Keyakinan sedang", rendah: "Keyakinan rendah" } as const;

export function TransactionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { addTransaction, transactions } = useFinance();
  const analyze = useServerFn(suggestTransactionInsights);
  const [type, setType] = useState<TxType>("masuk");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<TxStatus>("selesai");
  const [errors, setErrors] = useState<Errors>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);

  useEffect(() => {
    if (open) {
      setType("masuk");
      setDate(format(new Date(), "yyyy-MM-dd"));
      setDescription("");
      setCategory("");
      setAmount("");
      setStatus("selesai");
      setErrors({});
      setAnalysis(null);
      setAiError("");
      setAiLoading(false);
    }
  }, [open]);

  const categories = categoriesFor(type);
  const numeric = Number(amount.replace(/\D/g, ""));

  // Hasil AI hanya berlaku untuk isian yang dianalisis; reset bila isian berubah.
  useEffect(() => {
    setAnalysis(null);
    setAiError("");
  }, [type, date, description, numeric]);

  const byId = useMemo(() => new Map(transactions.map((t) => [t.id, t])), [transactions]);
  const duplicateRows = (analysis?.duplicates ?? []).flatMap((d) => {
    const tx = byId.get(d.id);
    return tx ? [{ tx, reason: d.reason }] : [];
  });

  async function runAi() {
    if (description.trim().length < 3) {
      setErrors((e) => ({ ...e, description: "Isi keterangan minimal 3 karakter dulu" }));
      return;
    }
    setAiLoading(true);
    setAiError("");
    try {
      const draft = { date, description: description.trim(), type, amount: numeric };
      const res = await analyze({ data: { draft, candidates: duplicateCandidates(draft, transactions) } });
      if (!res.ok) {
        setAiError(res.error);
        return;
      }
      // Tunda agar efek reset di atas tidak menghapus hasil baru.
      setTimeout(() => {
        setAnalysis(res.analysis);
        if (res.analysis.category && !category) setCategory(res.analysis.category);
      });
    } catch {
      setAiError("Saran AI sedang tidak tersedia. Coba lagi nanti.");
    } finally {
      setAiLoading(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const next: Errors = {};
    if (!date) next.date = "Tanggal wajib diisi";
    if (description.trim().length < 3) next.description = "Keterangan minimal 3 karakter";
    if (description.length > 120) next.description = "Keterangan maksimal 120 karakter";
    if (!category) next.category = "Pilih kategori";
    if (!numeric || numeric <= 0) next.amount = "Jumlah harus lebih dari 0";
    setErrors(next);
    if (Object.keys(next).length) return;

    addTransaction({ date, description: description.trim(), category, type, amount: numeric, status });
    toast.success("Transaksi tersimpan", {
      description: `${type === "masuk" ? "Pemasukan" : "Pengeluaran"} ${formatRupiah(numeric)} berhasil dicatat.`,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Tambah Transaksi</DialogTitle>
          <DialogDescription>Catat pemasukan atau pengeluaran kas organisasi.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-4" noValidate>
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
            {(
              [
                { v: "masuk", label: "Pemasukan", icon: ArrowDownLeft, active: "bg-card text-success shadow-card" },
                { v: "keluar", label: "Pengeluaran", icon: ArrowUpRight, active: "bg-card text-primary shadow-card" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.v}
                type="button"
                onClick={() => {
                  setType(opt.v);
                  setCategory("");
                }}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold text-muted-foreground transition-all",
                  type === opt.v && opt.active,
                )}
              >
                <opt.icon className="size-4" /> {opt.label}
              </button>
            ))}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="tx-desc">Keterangan</Label>
            <div className="flex gap-2">
              <Input
                id="tx-desc"
                placeholder="Contoh: Iuran anggota bulan ini"
                value={description}
                maxLength={120}
                onChange={(e) => setDescription(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0 border-primary/30 text-primary"
                onClick={runAi}
                disabled={aiLoading || description.trim().length < 3}
              >
                {aiLoading ? <Loader2 className="animate-spin" /> : <Sparkles />}
                <span className="hidden sm:inline">{aiLoading ? "Menganalisis…" : "Cek dengan AI"}</span>
                <span className="sm:hidden">AI</span>
              </Button>
            </div>
            {errors.description ? (
              <p className="text-xs text-destructive">{errors.description}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                AI menyarankan kategori dan memeriksa kemungkinan transaksi ganda.
              </p>
            )}
          </div>

          {aiError && (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {aiError}
            </p>
          )}

          {analysis && (
            <div className="grid gap-3" aria-live="polite">
              {analysis.category && (
                <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-semibold">
                      Saran kategori: <span className="text-primary">{analysis.category}</span>
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {CONFIDENCE_LABEL[analysis.confidence]}
                      </span>
                    </p>
                    {analysis.reason && <p className="mt-0.5 text-xs text-muted-foreground">{analysis.reason}</p>}
                  </div>
                  {category !== analysis.category ? (
                    <Button type="button" size="sm" variant="secondary" onClick={() => setCategory(analysis.category!)}>
                      Gunakan
                    </Button>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-medium text-success">
                      <Check className="size-3.5" /> Dipakai
                    </span>
                  )}
                </div>
              )}

              {duplicateRows.length > 0 ? (
                <div className="rounded-xl border border-warning/40 bg-warning-soft p-3 text-sm">
                  <p className="flex items-center gap-2 font-semibold text-warning-foreground">
                    <AlertTriangle className="size-4" /> Kemungkinan transaksi ganda
                  </p>
                  <ul className="mt-2 grid gap-2">
                    {duplicateRows.map(({ tx, reason }) => (
                      <li key={tx.id} className="rounded-lg bg-card px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate font-medium">{tx.description}</span>
                          <span className="num shrink-0 font-semibold">{formatRupiah(tx.amount)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(tx.date)} · {tx.category}
                          {reason && ` — ${reason}`}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-warning-foreground">
                    Periksa dulu sebelum menyimpan. Anda tetap bisa menyimpan jika memang transaksi berbeda.
                  </p>
                </div>
              ) : (
                <p className="flex items-center gap-2 text-xs text-success">
                  <Check className="size-3.5" /> Tidak ditemukan transaksi ganda dalam 30 hari terakhir.
                </p>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="tx-date">Tanggal</Label>
              <Input id="tx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              {errors.date && <p className="text-xs text-destructive">{errors.date}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label>Kategori</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger aria-label="Kategori">
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && <p className="text-xs text-destructive">{errors.category}</p>}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="tx-amount">Jumlah</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                  Rp
                </span>
                <Input
                  id="tx-amount"
                  inputMode="numeric"
                  placeholder="0"
                  className="num pl-10"
                  value={numeric ? numeric.toLocaleString("id-ID") : ""}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TxStatus)}>
                <SelectTrigger aria-label="Status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="selesai">Selesai</SelectItem>
                  <SelectItem value="menunggu">Menunggu persetujuan</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="mt-2 gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit">{duplicateRows.length > 0 ? "Tetap Simpan" : "Simpan Transaksi"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
