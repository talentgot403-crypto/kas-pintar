import { createFileRoute } from "@tanstack/react-router";
import { format, startOfMonth, startOfYear, subMonths } from "date-fns";
import { FileSpreadsheet, FileText, Lock, Printer, ScrollText } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState, PageHeader, Panel } from "@/components/finance-ui";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  byCategory,
  filterTransactions,
  formatDate,
  formatRupiah,
  monthLabel,
  toCSV,
  totals,
} from "@/lib/finance";
import { useFinance } from "@/lib/finance-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/laporan")({
  head: () => ({
    meta: [
      { title: "Laporan — SIKeu Sistem Informasi Kebendaharaan" },
      { name: "description", content: "Laporan keuangan ringkas per periode dengan opsi cetak, PDF, dan Excel." },
      { property: "og:title", content: "Laporan Keuangan — SIKeu" },
      { property: "og:description", content: "Laporan keuangan ringkas per periode dengan opsi cetak dan unduh." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LaporanPage,
});

type Period = "bulan" | "3bulan" | "6bulan" | "tahun";
const PERIOD_LABEL: Record<Period, string> = {
  bulan: "Bulan ini",
  "3bulan": "3 bulan",
  "6bulan": "6 bulan",
  tahun: "Tahun ini",
};

function LaporanPage() {
  const { transactions, now, permissions, people } = useFinance();
  const [period, setPeriod] = useState<Period>("bulan");

  const from = useMemo(() => {
    const d =
      period === "bulan"
        ? startOfMonth(now)
        : period === "3bulan"
          ? startOfMonth(subMonths(now, 2))
          : period === "6bulan"
            ? startOfMonth(subMonths(now, 5))
            : startOfYear(now);
    return format(d, "yyyy-MM-dd");
  }, [period, now]);
  const to = format(now, "yyyy-MM-dd");

  const rows = useMemo(() => filterTransactions(transactions, { from, to }), [transactions, from, to]);
  const opening = useMemo(() => totals(transactions.filter((t) => t.date < from)).net, [transactions, from]);
  const t = totals(rows);
  const incomeCats = byCategory(rows, "masuk");
  const expenseCats = byCategory(rows, "keluar");

  const exportExcel = () => {
    const blob = new Blob(["\ufeff" + toCSV(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-keuangan-${from}-sd-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("File Excel (CSV) diunduh");
  };
  const exportPdf = () =>
    toast.info("Ekspor PDF (simulasi)", { description: "Gunakan tombol Cetak lalu pilih “Simpan sebagai PDF”." });

  return (
    <>
      <PageHeader
        title="Laporan Keuangan"
        description="Ringkasan arus kas per periode untuk rapat pengurus dan pertanggungjawaban."
        actions={
          permissions.canExport ? (
            <>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer /> Cetak
              </Button>
              <Button variant="outline" onClick={exportPdf}>
                <FileText /> PDF
              </Button>
              <Button onClick={exportExcel} disabled={!rows.length}>
                <FileSpreadsheet /> Excel
              </Button>
            </>
          ) : (
            <p className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground">
              <Lock className="size-3.5" /> Ekspor hanya untuk Bendahara & Pembina
            </p>
          )
        }
      />

      <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)} className="mb-6 print:hidden">
        <TabsList>
          {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
            <TabsTrigger key={p} value={p}>
              {PERIOD_LABEL[p]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Panel>
        <div className="flex flex-col gap-1 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Laporan Arus Kas</p>
            <h2 className="mt-1 text-xl font-bold">Organisasi — Kas Umum</h2>
          </div>
          <p className="num text-sm text-muted-foreground">
            Periode {formatDate(from)} – {formatDate(to)}
          </p>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="Tidak ada transaksi pada periode ini"
            description="Pilih periode lain atau catat transaksi terlebih dahulu untuk menyusun laporan."
          />
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-4 border-b py-5 lg:grid-cols-4">
              {[
                { k: "Saldo awal", v: opening },
                { k: "Total pemasukan", v: t.income, cls: "text-success" },
                { k: "Total pengeluaran", v: t.expense },
                { k: "Saldo akhir", v: opening + t.net, cls: "text-primary" },
              ].map((x) => (
                <div key={x.k}>
                  <dt className="text-xs text-muted-foreground">{x.k}</dt>
                  <dd className={cn("num mt-1 text-lg font-bold", x.cls)}>{formatRupiah(x.v)}</dd>
                </div>
              ))}
            </dl>

            <div className="grid gap-8 py-5 md:grid-cols-2">
              <CategoryTable title="Rincian Pemasukan" rows={incomeCats} total={t.income} tone="success" />
              <CategoryTable title="Rincian Pengeluaran" rows={expenseCats} total={t.expense} tone="primary" />
            </div>

            <div className="border-t pt-5">
              <h3 className="mb-3 text-sm font-semibold">Daftar Transaksi ({rows.length})</h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 font-medium">Tanggal</th>
                      <th className="py-2 font-medium">Keterangan</th>
                      <th className="py-2 font-medium">Kategori</th>
                      <th className="py-2 text-right font-medium">Masuk</th>
                      <th className="py-2 text-right font-medium">Keluar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows
                      .filter((r) => r.status !== "dibatalkan")
                      .map((r) => (
                        <tr key={r.id} className="border-b last:border-0">
                          <td className="num whitespace-nowrap py-2 text-muted-foreground">{formatDate(r.date)}</td>
                          <td className="py-2">
                            {r.description}
                            {r.status === "menunggu" && <span className="ml-1 text-xs text-warning-foreground">(menunggu)</span>}
                          </td>
                          <td className="py-2 text-muted-foreground">{r.category}</td>
                          <td className="num py-2 text-right text-success">{r.type === "masuk" ? formatRupiah(r.amount) : <span className="text-muted-foreground">—</span>}</td>
                          <td className="num py-2 text-right">{r.type === "keluar" ? formatRupiah(r.amount) : <span className="text-muted-foreground">—</span>}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-8 hidden grid-cols-2 gap-8 text-center text-sm print:grid">
              <div>
                <p>Mengetahui, Pembina OSIS</p>
                <p className="mt-16 font-semibold">{people.pembina || "(....................)"}</p>
              </div>
              <div>
                <p>Bendahara Utama</p>
                <p className="mt-16 font-semibold">{people.bendahara || "(....................)"}</p>
              </div>
            </div>
          </>
        )}
      </Panel>
      <p className="mt-4 text-center text-xs text-muted-foreground print:hidden">
        Dibuat otomatis oleh SIKeu · {monthLabel(now, true)}
      </p>
    </>
  );
}

function CategoryTable({
  title,
  rows,
  total,
  tone,
}: {
  title: string;
  rows: { category: string; amount: number }[];
  total: number;
  tone: "success" | "primary";
}) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="rounded-lg bg-muted px-4 py-6 text-center text-sm text-muted-foreground">Tidak ada data</p>
      ) : (
        <ul className="grid gap-3">
          {rows.map((r) => {
            const pct = total ? Math.round((r.amount / total) * 100) : 0;
            return (
              <li key={r.category}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{r.category}</span>
                  <span className="num font-medium">
                    {formatRupiah(r.amount)} <span className="text-xs text-muted-foreground">({pct}%)</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", tone === "success" ? "bg-success" : "bg-primary")}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
          <li className="flex justify-between border-t pt-3 text-sm font-semibold">
            <span>Total</span>
            <span className="num">{formatRupiah(total)}</span>
          </li>
        </ul>
      )}
    </div>
  );
}
