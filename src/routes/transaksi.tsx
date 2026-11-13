import { createFileRoute } from "@tanstack/react-router";
import { Check, Clock, FilterX, MoreHorizontal, Pencil, Plus, ReceiptText, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { BookSelect, EmptyState, PageHeader, Panel, StatusBadge, TypeBadge } from "@/components/finance-ui";
import { TransactionDialog } from "@/components/transaction-dialog";
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
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ALL_CATEGORIES,
  BOOK_LABEL,
  filterTransactions,
  formatDate,
  formatRupiah,
  isEditable,
  totals,
  type Transaction,
  type TxType,
} from "@/lib/finance";
import { useFinance } from "@/lib/finance-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/transaksi")({
  head: () => ({
    meta: [
      { title: "Transaksi — SIKeu Sistem Informasi Kebendaharaan" },
      { name: "description", content: "Catat dan filter pemasukan serta pengeluaran kas berdasarkan tanggal, jenis, dan kategori." },
      { property: "og:title", content: "Pencatatan Transaksi — SIKeu" },
      { property: "og:description", content: "Catat dan filter pemasukan serta pengeluaran kas organisasi." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TransaksiPage,
});

function TransaksiPage() {
  const {
    bookTransactions: transactions,
    book,
    permissions,
    setStatus,
    deleteTransaction,
    loadSample,
    largeExpenseThreshold,
  } = useFinance();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (tx: Transaction) => {
    setEditing(tx);
    setOpen(true);
  };
  const pending = transactions.filter((x) => x.status === "menunggu").length;
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState<TxType | "semua">("semua");
  const [category, setCategory] = useState("semua");
  const [query, setQuery] = useState("");
  const [toDelete, setToDelete] = useState<Transaction | null>(null);

  const rows = useMemo(
    () => filterTransactions(transactions, { from, to, type, category, query }),
    [transactions, from, to, type, category, query],
  );
  const t = totals(rows);
  const filtered = Boolean(from || to || type !== "semua" || category !== "semua" || query);
  const reset = () => {
    setFrom("");
    setTo("");
    setType("semua");
    setCategory("semua");
    setQuery("");
  };
  const hasMenu = permissions.canApprove || permissions.canDelete;
  const hasActions = hasMenu || permissions.canEdit;

  const approve = (tx: Transaction, ok: boolean) => {
    setStatus(tx.id, ok ? "selesai" : "dibatalkan");
    toast.success(ok ? "Transaksi disetujui" : "Transaksi dibatalkan", { description: tx.description });
  };

  const RowActions = ({ tx }: { tx: Transaction }) => {
    if (!hasActions) return null;
    return (
      <div className="flex items-center justify-end gap-0.5">
        {permissions.canEdit && isEditable(tx) && (
          <Button variant="ghost" size="icon" aria-label={`Ubah ${tx.description}`} title="Ubah" onClick={() => openEdit(tx)}>
            <Pencil />
          </Button>
        )}
        {hasMenu && (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Aksi transaksi">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {permissions.canApprove && (
            <>
              <DropdownMenuItem disabled={tx.status === "selesai"} onClick={() => approve(tx, true)}>
                <Check className="text-success" /> Setujui
              </DropdownMenuItem>
              <DropdownMenuItem disabled={tx.status === "dibatalkan"} onClick={() => approve(tx, false)}>
                <X /> Batalkan
              </DropdownMenuItem>
            </>
          )}
          {permissions.canApprove && permissions.canDelete && <DropdownMenuSeparator />}
          {permissions.canDelete && (
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setToDelete(tx)}>
              <Trash2 /> Hapus
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
        )}
      </div>
    );
  };

  return (
    <>
      <PageHeader
        title="Transaksi"
        description={`Pencatatan pemasukan & pengeluaran ${BOOK_LABEL[book]}.`}
        actions={
          <>
            <BookSelect />
            {permissions.canCreate && (
              <Button onClick={openNew}>
                <Plus /> Tambah Transaksi
              </Button>
            )}
          </>
        }
      />

      {pending > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning-foreground">
          <Clock className="mt-0.5 size-4 shrink-0" />
          <p>
            <span className="font-semibold">
              {pending} transaksi {BOOK_LABEL[book]} menunggu persetujuan Pembina.
            </span>{" "}
            {permissions.canApprove
              ? "Setujui atau batalkan lewat tombol aksi di setiap baris."
              : `Pengeluaran mulai ${formatRupiah(largeExpenseThreshold)} perlu diverifikasi Pembina OSIS.`}
          </p>
        </div>
      )}

      <Panel className="mb-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto] lg:items-end">
          <div className="col-span-2 grid gap-1.5 lg:col-span-1">
            <Label htmlFor="f-q">Cari keterangan</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="f-q" className="pl-9" placeholder="Cari…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="f-from">Dari tanggal</Label>
            <Input id="f-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="f-to">Sampai tanggal</Label>
            <Input id="f-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Jenis</Label>
            <Select value={type} onValueChange={(v) => setType(v as TxType | "semua")}>
              <SelectTrigger aria-label="Filter jenis">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua jenis</SelectItem>
                <SelectItem value="masuk">Masuk</SelectItem>
                <SelectItem value="keluar">Keluar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Kategori</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger aria-label="Filter kategori">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="semua">Semua kategori</SelectItem>
                {ALL_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" className="col-span-2 lg:col-span-1" onClick={reset} disabled={!filtered}>
            <FilterX /> Reset
          </Button>
        </div>
      </Panel>

      <Panel
        title={`${rows.length} transaksi`}
        description={filtered ? `Hasil sesuai filter · ${BOOK_LABEL[book]}` : `Seluruh catatan ${BOOK_LABEL[book]}`}
        action={
          rows.length > 0 && (
            <div className="hidden gap-4 text-right text-xs sm:flex">
              <div>
                <p className="text-muted-foreground">Masuk</p>
                <p className="num text-sm font-semibold text-success">{formatRupiah(t.income)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Keluar</p>
                <p className="num text-sm font-semibold">{formatRupiah(t.expense)}</p>
              </div>
            </div>
          )
        }
      >
        {transactions.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title={`Belum ada transaksi di ${BOOK_LABEL[book]}`}
            description="Catatan pemasukan dan pengeluaran buku kas ini akan muncul di sini setelah Anda menambahkannya."
            action={
              <>
                {permissions.canCreate && (
                  <Button onClick={openNew}>
                    <Plus /> Tambah Transaksi
                  </Button>
                )}
                <Button variant="outline" onClick={loadSample}>
                  Muat data contoh
                </Button>
              </>
            }
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={FilterX}
            title="Tidak ada transaksi yang cocok"
            description="Coba ubah rentang tanggal, jenis, atau kategori pada filter di atas."
            action={
              <Button variant="outline" onClick={reset}>
                Reset filter
              </Button>
            }
          />
        ) : (
          <>
            <div className="-mx-5 hidden md:block sm:-mx-6">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-6">Tanggal</TableHead>
                    <TableHead>Keterangan</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead className="text-right">Jumlah</TableHead>
                    <TableHead>Status</TableHead>
                    {hasActions && <TableHead className="w-24 pr-6" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((tx) => (
                    <TableRow key={tx.id} className={cn(tx.status === "dibatalkan" && "opacity-60")}>
                      <TableCell className="num whitespace-nowrap pl-6 text-muted-foreground">{formatDate(tx.date)}</TableCell>
                      <TableCell className="max-w-xs truncate font-medium">{tx.description}</TableCell>
                      <TableCell className="text-muted-foreground">{tx.category}</TableCell>
                      <TableCell>
                        <TypeBadge type={tx.type} />
                      </TableCell>
                      <TableCell
                        className={cn(
                          "num whitespace-nowrap text-right font-semibold",
                          tx.type === "masuk" && "text-success",
                          tx.status === "dibatalkan" && "line-through",
                        )}
                      >
                        {tx.type === "masuk" ? "+" : "−"} {formatRupiah(tx.amount)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={tx.status} />
                      </TableCell>
                      {hasActions && (
                        <TableCell className="pr-6">
                          <RowActions tx={tx} />
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ul className="grid gap-3 md:hidden">
              {rows.map((tx) => (
                <li key={tx.id} className={cn("rounded-xl border p-4", tx.status === "dibatalkan" && "opacity-60")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{tx.description}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDate(tx.date)} · {tx.category}
                      </p>
                    </div>
                    <RowActions tx={tx} />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      <TypeBadge type={tx.type} />
                      <StatusBadge status={tx.status} />
                    </div>
                    <p className={cn("num font-semibold", tx.type === "masuk" && "text-success")}>
                      {tx.type === "masuk" ? "+" : "−"} {formatRupiah(tx.amount)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      <TransactionDialog open={open} onOpenChange={setOpen} editing={editing} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus transaksi?</AlertDialogTitle>
            <AlertDialogDescription>
              “{toDelete?.description}” sebesar {toDelete && formatRupiah(toDelete.amount)} akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (toDelete) {
                  deleteTransaction(toDelete.id);
                  toast.success("Transaksi dihapus");
                }
                setToDelete(null);
              }}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
