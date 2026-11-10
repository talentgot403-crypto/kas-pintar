import { format } from "date-fns";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

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
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, formatRupiah, type TxStatus, type TxType } from "@/lib/finance";
import { useFinance } from "@/lib/finance-store";
import { cn } from "@/lib/utils";

type Errors = Partial<Record<"date" | "description" | "category" | "amount", string>>;

export function TransactionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { addTransaction } = useFinance();
  const [type, setType] = useState<TxType>("masuk");
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<TxStatus>("selesai");
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    if (open) {
      setType("masuk");
      setDate(format(new Date(), "yyyy-MM-dd"));
      setDescription("");
      setCategory("");
      setAmount("");
      setStatus("selesai");
      setErrors({});
    }
  }, [open]);

  const categories = type === "masuk" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const numeric = Number(amount.replace(/\D/g, ""));

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
      <DialogContent className="sm:max-w-lg">
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

          <div className="grid gap-1.5">
            <Label htmlFor="tx-desc">Keterangan</Label>
            <Input
              id="tx-desc"
              placeholder="Contoh: Iuran anggota bulan ini"
              value={description}
              maxLength={120}
              onChange={(e) => setDescription(e.target.value)}
            />
            {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
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
            <Button type="submit">Simpan Transaksi</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
