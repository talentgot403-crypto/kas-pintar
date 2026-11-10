import { format, subMonths } from "date-fns";
import { id as localeId } from "date-fns/locale";

export type TxType = "masuk" | "keluar";
export type TxStatus = "selesai" | "menunggu" | "dibatalkan";
export type Role = "bendahara" | "ketua" | "anggota";

export interface Transaction {
  id: string;
  date: string; // yyyy-MM-dd
  description: string;
  category: string;
  type: TxType;
  amount: number;
  status: TxStatus;
}

export interface Budget {
  id: string;
  category: string;
  allocation: number; // per bulan
}

export const INCOME_CATEGORIES = ["Iuran", "Donasi", "Sponsor", "Lainnya"] as const;
export const EXPENSE_CATEGORIES = [
  "Operasional",
  "Konsumsi",
  "Kegiatan",
  "Perlengkapan",
  "Transportasi",
] as const;
export const ALL_CATEGORIES = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];

export const STATUS_LABEL: Record<TxStatus, string> = {
  selesai: "Selesai",
  menunggu: "Menunggu",
  dibatalkan: "Dibatalkan",
};

export interface RoleInfo {
  label: string;
  description: string;
  canCreate: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canManageBudget: boolean;
  canExport: boolean;
}

export const ROLES: Record<Role, RoleInfo> = {
  bendahara: {
    label: "Bendahara Utama",
    description: "Mencatat transaksi, mengelola anggaran, dan menyusun laporan.",
    canCreate: true,
    canDelete: true,
    canApprove: false,
    canManageBudget: true,
    canExport: true,
  },
  ketua: {
    label: "Ketua",
    description: "Meninjau dan menyetujui transaksi yang menunggu persetujuan.",
    canCreate: false,
    canDelete: false,
    canApprove: true,
    canManageBudget: false,
    canExport: true,
  },
  anggota: {
    label: "Anggota (Viewer)",
    description: "Hanya dapat melihat ringkasan dan laporan keuangan.",
    canCreate: false,
    canDelete: false,
    canApprove: false,
    canManageBudget: false,
    canExport: false,
  },
};

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export function formatRupiah(n: number) {
  return rupiah.format(n).replace(/\u00a0/g, " ");
}

export function formatCompact(n: number) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(1).replace(".", ",")} M`;
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1).replace(".", ",")} jt`;
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)} rb`;
  return `${sign}${abs}`;
}

export function formatDate(date: string) {
  return format(new Date(`${date}T00:00:00`), "d MMM yyyy", { locale: localeId });
}

export function monthKey(d: Date | string) {
  return typeof d === "string" ? d.slice(0, 7) : format(d, "yyyy-MM");
}

export function monthLabel(d: Date, long = false) {
  return format(d, long ? "MMMM yyyy" : "MMM", { locale: localeId });
}

/** Transaksi yang dibatalkan tidak dihitung dalam saldo maupun anggaran. */
export function isCounted(tx: Transaction) {
  return tx.status !== "dibatalkan";
}

export function totals(txs: Transaction[]) {
  let income = 0;
  let expense = 0;
  for (const tx of txs) {
    if (!isCounted(tx)) continue;
    if (tx.type === "masuk") income += tx.amount;
    else expense += tx.amount;
  }
  return { income, expense, net: income - expense };
}

export function summarize(txs: Transaction[], budgets: Budget[], now: Date) {
  const all = totals(txs);
  const key = monthKey(now);
  const month = totals(txs.filter((t) => monthKey(t.date) === key));
  const usage = budgetUsage(budgets, txs, now);
  const allocation = usage.reduce((s, b) => s + b.allocation, 0);
  const used = usage.reduce((s, b) => s + b.used, 0);
  return {
    balance: all.net,
    incomeMonth: month.income,
    expenseMonth: month.expense,
    budgetAllocation: allocation,
    budgetRemaining: allocation - used,
  };
}

export function monthlySeries(txs: Transaction[], now: Date, months = 6) {
  const out: { key: string; label: string; masuk: number; keluar: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = subMonths(now, i);
    const key = monthKey(d);
    const t = totals(txs.filter((x) => monthKey(x.date) === key));
    out.push({ key, label: monthLabel(d), masuk: t.income, keluar: t.expense });
  }
  return out;
}

export interface BudgetUsage extends Budget {
  used: number;
  remaining: number;
  percent: number;
}

/** Pemakaian anggaran = pengeluaran bulan berjalan (tidak dibatalkan) per kategori. */
export function budgetUsage(budgets: Budget[], txs: Transaction[], now: Date): BudgetUsage[] {
  const key = monthKey(now);
  return budgets.map((b) => {
    const used = txs
      .filter(
        (t) =>
          t.type === "keluar" && isCounted(t) && t.category === b.category && monthKey(t.date) === key,
      )
      .reduce((s, t) => s + t.amount, 0);
    const percent = b.allocation > 0 ? Math.round((used / b.allocation) * 100) : 0;
    return { ...b, used, remaining: b.allocation - used, percent };
  });
}

export function usageTone(percent: number): "success" | "warning" | "danger" {
  if (percent >= 90) return "danger";
  if (percent >= 70) return "warning";
  return "success";
}

export interface TxFilter {
  from?: string;
  to?: string;
  type?: TxType | "semua";
  category?: string;
  query?: string;
}

export function filterTransactions(txs: Transaction[], f: TxFilter) {
  const q = f.query?.trim().toLowerCase();
  return txs
    .filter((t) => {
      if (f.from && t.date < f.from) return false;
      if (f.to && t.date > f.to) return false;
      if (f.type && f.type !== "semua" && t.type !== f.type) return false;
      if (f.category && f.category !== "semua" && t.category !== f.category) return false;
      if (q && !t.description.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id.localeCompare(a.id)));
}

export function byCategory(txs: Transaction[], type: TxType) {
  const map = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== type || !isCounted(t)) continue;
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  }
  return [...map.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function toCSV(txs: Transaction[]) {
  const head = ["Tanggal", "Keterangan", "Kategori", "Jenis", "Jumlah", "Status"];
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = txs.map((t) =>
    [
      t.date,
      esc(t.description),
      t.category,
      t.type === "masuk" ? "Masuk" : "Keluar",
      String(t.amount),
      STATUS_LABEL[t.status],
    ].join(";"),
  );
  return [head.join(";"), ...rows].join("\n");
}

export function newId() {
  return `tx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Data contoh 6 bulan terakhir, relatif terhadap tanggal hari ini. */
export function buildSeed(now: Date): { transactions: Transaction[]; budgets: Budget[] } {
  const today = now.getDate();
  const day = (monthsAgo: number, d: number) => {
    const base = subMonths(new Date(now.getFullYear(), now.getMonth(), 1), monthsAgo);
    const capped = monthsAgo === 0 ? Math.min(d, today) : d;
    return format(new Date(base.getFullYear(), base.getMonth(), capped), "yyyy-MM-dd");
  };

  const txs: Transaction[] = [];
  let n = 0;
  const add = (
    monthsAgo: number,
    d: number,
    description: string,
    category: string,
    type: TxType,
    amount: number,
    status: TxStatus = "selesai",
  ) => {
    n += 1;
    txs.push({ id: `seed-${String(n).padStart(3, "0")}`, date: day(monthsAgo, d), description, category, type, amount, status });
  };

  add(6, 28, "Saldo awal kas organisasi", "Lainnya", "masuk", 12_500_000);
  const wiggle = [1, 1.08, 0.94, 1.12, 0.97, 1.05];
  for (let m = 5; m >= 1; m--) {
    const w = wiggle[m] ?? 1;
    add(m, 5, "Iuran anggota bulanan", "Iuran", "masuk", Math.round(4_200_000 * w));
    add(m, 9, "Donasi kegiatan sosial", "Donasi", "masuk", Math.round(1_500_000 * w));
    add(m, 7, "Sewa sekretariat & listrik", "Operasional", "keluar", 1_350_000);
    add(m, 14, "Konsumsi rapat bulanan", "Konsumsi", "keluar", Math.round(780_000 * w));
    add(m, 20, "Program kerja bulanan", "Kegiatan", "keluar", Math.round(2_100_000 * w));
    add(m, 24, "Transport koordinasi lapangan", "Transportasi", "keluar", Math.round(420_000 * w));
    if (m % 2 === 1) add(m, 18, "Sponsor mitra usaha", "Sponsor", "masuk", 2_500_000);
    if (m % 2 === 0) add(m, 26, "Alat tulis & cetak dokumen", "Perlengkapan", "keluar", 560_000);
  }

  add(0, 2, "Iuran anggota bulanan", "Iuran", "masuk", 4_650_000);
  add(0, 4, "Donasi alumni", "Donasi", "masuk", 2_000_000);
  add(0, 5, "Sewa sekretariat & listrik", "Operasional", "keluar", 1_350_000);
  add(0, 6, "Konsumsi rapat koordinasi", "Konsumsi", "keluar", 865_000);
  add(0, 8, "Snack kegiatan bakti sosial", "Konsumsi", "keluar", 520_000);
  add(0, 9, "Perlengkapan banner & spanduk", "Perlengkapan", "keluar", 1_050_000);
  add(0, 10, "Sewa sound system acara", "Kegiatan", "keluar", 1_400_000, "menunggu");
  add(0, 10, "Transport survei lokasi", "Transportasi", "keluar", 310_000);
  add(0, 10, "Pembelian printer (dibatalkan)", "Perlengkapan", "keluar", 2_300_000, "dibatalkan");
  add(0, 10, "Sponsor kegiatan akhir tahun", "Sponsor", "masuk", 3_000_000, "menunggu");

  const budgets: Budget[] = [
    { id: "bdg-1", category: "Operasional", allocation: 2_000_000 },
    { id: "bdg-2", category: "Konsumsi", allocation: 1_500_000 },
    { id: "bdg-3", category: "Kegiatan", allocation: 3_000_000 },
    { id: "bdg-4", category: "Perlengkapan", allocation: 1_000_000 },
    { id: "bdg-5", category: "Transportasi", allocation: 750_000 },
  ];

  return { transactions: txs, budgets };
}
