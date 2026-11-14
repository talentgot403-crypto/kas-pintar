import { addMonths, differenceInCalendarMonths, format, startOfMonth } from "date-fns";
import { id as localeId } from "date-fns/locale";

export type TxType = "masuk" | "keluar";
export type TxStatus = "selesai" | "menunggu" | "dibatalkan";
export type Role = "bendahara" | "pembina" | "anggota" | "alumni";
export type AccessStatus = "aktif" | "read-only" | "dicabut";
export type PeriodStatus = "aktif" | "ditutup";
/** Buku kas terpisah: saldo & pencatatan Kas OSIS tidak tercampur dengan Kas Angkatan. */
export type CashBook = "osis" | "angkatan";

export interface Transaction {
  id: string;
  periodId: string;
  date: string; // yyyy-MM-dd
  description: string;
  category: string;
  type: TxType;
  amount: number;
  status: TxStatus;
  /** Saldo awal hasil serah terima dari periode sebelumnya. */
  carryOver?: boolean;
  /** Buku kas; data lama tanpa buku dianggap Kas OSIS. */
  book?: CashBook;
}

export interface Budget {
  id: string;
  periodId: string;
  category: string;
  allocation: number; // per bulan
  /** Buku kas; anggaran lama tanpa buku dianggap Kas OSIS. */
  book?: CashBook;
}

export interface Period {
  id: string; // "2025-2026"
  label: string; // "2025/2026"
  start: string;
  end: string;
  status: PeriodStatus;
  closedAt?: string;
  closingBalance?: number;
}

export interface Member {
  id: string;
  name: string;
  jabatan: string;
  role: Role;
  access: AccessStatus;
  periodId: string; // periode kepengurusan
}

export interface OrgState {
  periods: Period[];
  members: Member[];
  transactions: Transaction[];
  budgets: Budget[];
  currentUserId: string;
  selectedPeriodId: string;
  largeExpenseThreshold: number;
}

export const INCOME_CATEGORIES = ["Iuran", "Donasi", "Sponsor", "Lainnya"] as const;
export const EXPENSE_CATEGORIES = [
  "Operasional",
  "Konsumsi",
  "Kegiatan",
  "Perlengkapan",
  "Transportasi",
] as const;
export const CARRY_OVER_CATEGORY = "Saldo Awal";
export const ALL_CATEGORIES = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];
export const DEFAULT_LARGE_EXPENSE = 1_000_000;

export const CASH_BOOKS: { id: CashBook; label: string; description: string }[] = [
  { id: "osis", label: "Kas OSIS", description: "Dana organisasi OSIS" },
  { id: "angkatan", label: "Kas Angkatan", description: "Dana angkatan siswa" },
];
export const BOOK_LABEL: Record<CashBook, string> = { osis: "Kas OSIS", angkatan: "Kas Angkatan" };

export function isCashBook(v: unknown): v is CashBook {
  return v === "osis" || v === "angkatan";
}

/** Buku kas sebuah transaksi/anggaran; tanpa buku = Kas OSIS. */
export function bookOf(item: { book?: CashBook | undefined }): CashBook {
  return item.book === "angkatan" ? "angkatan" : "osis";
}

/** Hanya data milik satu buku kas — dipakai untuk saldo, laporan, anggaran, dan ekspor. */
export function inBook<T extends { book?: CashBook | undefined }>(items: T[], book: CashBook): T[] {
  return items.filter((i) => bookOf(i) === book);
}

export const STATUS_LABEL: Record<TxStatus, string> = {
  selesai: "Selesai",
  menunggu: "Menunggu",
  dibatalkan: "Dibatalkan",
};

export const ACCESS_LABEL: Record<AccessStatus, string> = {
  aktif: "Aktif",
  "read-only": "Read-only",
  dicabut: "Dicabut",
};

// ---------------------------------------------------------------------------
// Peran & hak akses
// ---------------------------------------------------------------------------

export interface RoleInfo {
  label: string;
  short: string;
  description: string;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  canManageBudget: boolean;
  canExport: boolean;
  canManageUsers: boolean;
  canHandover: boolean;
  canConfigure: boolean;
}

export const ROLES: Record<Role, RoleInfo> = {
  bendahara: {
    label: "Bendahara Utama",
    short: "Bendahara",
    description: "Pengurus aktif: mencatat, mengubah & menghapus transaksi, mengelola anggaran, pengguna, dan serah terima.",
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canApprove: false,
    canManageBudget: true,
    canExport: true,
    canManageUsers: true,
    canHandover: true,
    canConfigure: false,
  },
  pembina: {
    label: "Pembina OSIS / Pengawas",
    short: "Pembina",
    description: "Melihat laporan, memverifikasi pengeluaran besar, dan mengunduh laporan.",
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canApprove: true,
    canManageBudget: false,
    canExport: true,
    canManageUsers: false,
    canHandover: false,
    canConfigure: true,
  },
  anggota: {
    label: "Anggota (Viewer)",
    short: "Anggota",
    description: "Pengurus lain: hanya dapat melihat ringkasan dan laporan keuangan.",
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canApprove: false,
    canManageBudget: false,
    canExport: false,
    canManageUsers: false,
    canHandover: false,
    canConfigure: false,
  },
  alumni: {
    label: "Pengurus Lama (Alumni)",
    short: "Alumni",
    description: "Pengurus periode sebelumnya: akses hanya-baca, atau dicabut saat serah terima.",
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canApprove: false,
    canManageBudget: false,
    canExport: false,
    canManageUsers: false,
    canHandover: false,
    canConfigure: false,
  },
};

export type Permissions = Omit<RoleInfo, "label" | "short" | "description"> & {
  canView: boolean;
  /** Alasan akses dibatasi, untuk ditampilkan di UI. */
  reason: null | "dicabut" | "read-only" | "arsip";
};

const NO_ACCESS: Permissions = {
  canView: false,
  canCreate: false,
  canEdit: false,
  canDelete: false,
  canApprove: false,
  canManageBudget: false,
  canExport: false,
  canManageUsers: false,
  canHandover: false,
  canConfigure: false,
  reason: "dicabut",
};

/**
 * Hak akses efektif = peran × status akses × status periode yang sedang dilihat.
 * Periode yang sudah ditutup (arsip) selalu hanya-baca untuk semua peran.
 */
export function permissionsFor(member: Member | undefined, period: Period | undefined): Permissions {
  if (!member || member.access === "dicabut") return NO_ACCESS;
  const r = ROLES[member.role];
  if (member.access === "read-only") return { ...NO_ACCESS, canView: true, canExport: r.canExport, reason: "read-only" };
  const open = period?.status === "aktif";
  return {
    canView: true,
    canCreate: open && r.canCreate,
    canEdit: open && r.canEdit,
    canDelete: open && r.canDelete,
    canApprove: open && r.canApprove,
    canManageBudget: open && r.canManageBudget,
    canExport: r.canExport,
    canManageUsers: r.canManageUsers,
    canHandover: r.canHandover,
    canConfigure: r.canConfigure,
    reason: open ? null : "arsip",
  };
}

// ---------------------------------------------------------------------------
// Persetujuan pengeluaran besar
// ---------------------------------------------------------------------------

export function needsApproval(type: TxType, amount: number, threshold: number) {
  return type === "keluar" && amount >= threshold;
}

/** Pengeluaran ≥ batas wajib diverifikasi Pembina; selain itu langsung selesai. */
export function initialStatus(type: TxType, amount: number, threshold: number): TxStatus {
  return needsApproval(type, amount, threshold) ? "menunggu" : "selesai";
}

/**
 * Status setelah transaksi diubah: transaksi batal tetap batal; pengeluaran besar
 * yang jumlah/jenisnya berubah harus diverifikasi ulang.
 */
export function statusAfterEdit(
  prev: Pick<Transaction, "type" | "amount" | "status">,
  next: Pick<Transaction, "type" | "amount">,
  threshold: number,
): TxStatus {
  if (prev.status === "dibatalkan") return "dibatalkan";
  if (!needsApproval(next.type, next.amount, threshold)) return "selesai";
  const changed = prev.amount !== next.amount || prev.type !== next.type;
  return changed || prev.status === "menunggu" ? "menunggu" : "selesai";
}

/** Isian formulir transaksi; status & periode dihitung oleh aturan, bukan dipilih pengguna. */
export type TxInput = Pick<Transaction, "date" | "description" | "category" | "type" | "amount"> & { book: CashBook };

/** Saldo awal hasil serah terima tidak boleh diubah manual. */
export function isEditable(tx: Transaction) {
  return !tx.carryOver;
}

/** Terapkan perubahan: transaksi tetap di periodenya, status mengikuti aturan persetujuan. */
export function applyEdit(prev: Transaction, patch: TxInput, threshold: number): Transaction {
  return {
    ...prev,
    ...patch,
    periodId: prev.periodId,
    status: statusAfterEdit(prev, patch, threshold),
  };
}

// ---------------------------------------------------------------------------
// Periode / tahun ajaran (Juli – Juni)
// ---------------------------------------------------------------------------

export function schoolYear(startYear: number): Omit<Period, "status"> {
  return {
    id: `${startYear}-${startYear + 1}`,
    label: `${startYear}/${startYear + 1}`,
    start: `${startYear}-07-01`,
    end: `${startYear + 1}-06-30`,
  };
}

export function schoolYearOf(d: Date) {
  return schoolYear(d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1);
}

export function nextSchoolYear(p: Pick<Period, "id">) {
  return schoolYear(Number(p.id.slice(0, 4)) + 1);
}

/** Tanggal acuan "bulan ini": hari ini untuk periode aktif, tanggal tutup buku untuk arsip. */
export function referenceDate(period: Period | undefined, now: Date) {
  if (!period || period.status === "aktif") return now;
  return new Date(`${period.closedAt ?? period.end}T00:00:00`);
}

export function periodMonths(period: Period, ref: Date) {
  const start = new Date(`${period.start}T00:00:00`);
  return Math.min(12, Math.max(1, differenceInCalendarMonths(ref, start) + 1));
}

// ---------------------------------------------------------------------------
// Format
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Perhitungan
// ---------------------------------------------------------------------------

/** Transaksi yang dibatalkan tidak dihitung dalam saldo maupun anggaran. */
export function isCounted(tx: Transaction) {
  return tx.status !== "dibatalkan";
}

/** Arus kas (pemasukan/pengeluaran). Saldo awal hasil serah terima bukan pemasukan. */
export function totals(txs: Transaction[]) {
  let income = 0;
  let expense = 0;
  for (const tx of txs) {
    if (!isCounted(tx) || tx.carryOver) continue;
    if (tx.type === "masuk") income += tx.amount;
    else expense += tx.amount;
  }
  return { income, expense, net: income - expense };
}

/** Saldo kas = saldo awal periode + arus kas bersih. */
export function balanceOf(txs: Transaction[]) {
  return txs.reduce((s, t) => (isCounted(t) ? s + (t.type === "masuk" ? t.amount : -t.amount) : s), 0);
}

export function summarize(txs: Transaction[], budgets: Budget[], now: Date) {
  const key = monthKey(now);
  const month = totals(txs.filter((t) => monthKey(t.date) === key));
  const usage = budgetUsage(budgets, txs, now);
  const allocation = usage.reduce((s, b) => s + b.allocation, 0);
  const used = usage.reduce((s, b) => s + b.used, 0);
  return {
    balance: balanceOf(txs),
    opening: balanceOf(txs.filter((t) => t.carryOver)),
    incomeMonth: month.income,
    expenseMonth: month.expense,
    budgetAllocation: allocation,
    budgetRemaining: allocation - used,
  };
}

export function monthlySeries(txs: Transaction[], now: Date, months = 6) {
  const out: { key: string; label: string; masuk: number; keluar: number }[] = [];
  const first = startOfMonth(addMonths(now, -(months - 1)));
  for (let i = 0; i < months; i++) {
    const d = addMonths(first, i);
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
          t.type === "keluar" && isCounted(t) && !t.carryOver && t.category === b.category && monthKey(t.date) === key,
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
    if (t.type !== type || !isCounted(t) || t.carryOver) continue;
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  }
  return [...map.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

export function toCSV(txs: Transaction[]) {
  const head = ["Tanggal", "Buku Kas", "Keterangan", "Kategori", "Jenis", "Jumlah", "Status"];
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = txs.map((t) =>
    [
      t.date,
      BOOK_LABEL[bookOf(t)],
      esc(t.description),
      t.category,
      t.type === "masuk" ? "Masuk" : "Keluar",
      String(t.amount),
      STATUS_LABEL[t.status],
    ].join(";"),
  );
  return [head.join(";"), ...rows].join("\n");
}

export function newId(prefix = "tx") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// ---------------------------------------------------------------------------
// Periode kepengurusan: arsip otomatis & mulai periode baru
// ---------------------------------------------------------------------------

/** Data yang tersimpan per periode. */
export interface PeriodData {
  periods: Period[];
  transactions: Transaction[];
  budgets: Budget[];
  members: Member[];
}

export interface NewPeriodOptions {
  today: string; // yyyy-MM-dd
  /** Bawa sisa saldo tiap buku kas sebagai "Saldo Awal". Tanpa ini periode baru mulai dari Rp 0. */
  carryBalance: boolean;
  /** Akses pengurus lama (Bendahara & Anggota) setelah periode ditutup. */
  oldMemberAccess: "read-only" | "dicabut";
}

export type NewPeriodResult =
  | { ok: true; data: PeriodData; closed: Period; next: Period }
  | { ok: false; error: string };

export function activePeriod(state: Pick<PeriodData, "periods">) {
  return state.periods.find((p) => p.status === "aktif");
}

/** Hanya data milik satu periode kepengurusan. */
export function inPeriod<T extends { periodId: string }>(items: T[], periodId: string): T[] {
  return items.filter((i) => i.periodId === periodId);
}

/** Periode terbaru di atas. */
export function sortPeriods(periods: Period[]) {
  return [...periods].sort((a, b) => b.id.localeCompare(a.id));
}

const PERIOD_ID = /^\d{4}-\d{4}$/;

function isPeriod(v: unknown): v is Period {
  if (!v || typeof v !== "object") return false;
  const p = v as Partial<Period>;
  return typeof p.id === "string" && PERIOD_ID.test(p.id) && (p.status === "aktif" || p.status === "ditutup");
}

/**
 * Daftar periode yang sah: tepat satu periode aktif. Data lama tanpa daftar periode
 * memakai tahun ajaran hari ini sebagai periode aktif; periode lain di data menjadi arsip.
 */
export function ensurePeriods(saved: unknown, periodIds: string[], now: Date): Period[] {
  const valid = Array.isArray(saved) ? saved.filter(isPeriod) : [];
  if (valid.filter((p) => p.status === "aktif").length === 1) return valid;
  const active = schoolYearOf(now);
  const closed = new Map<string, Period>();
  for (const id of [...valid.map((p) => p.id), ...periodIds]) {
    if (id === active.id || closed.has(id) || !PERIOD_ID.test(id)) continue;
    const kept = valid.find((p) => p.id === id);
    closed.set(id, kept ? { ...kept, status: "ditutup" } : { ...schoolYear(Number(id.slice(0, 4))), status: "ditutup" });
  }
  return [{ ...active, status: "aktif" }, ...closed.values()];
}

/** Saldo tiap buku kas. */
export function bookBalances(txs: Transaction[]): Record<CashBook, number> {
  return { osis: balanceOf(inBook(txs, "osis")), angkatan: balanceOf(inBook(txs, "angkatan")) };
}

/** Ringkasan satu periode: jumlah transaksi, yang menunggu persetujuan, dan saldo per buku. */
export function periodSummary(txs: Transaction[], periodId: string) {
  const own = inPeriod(txs, periodId);
  return {
    count: own.length,
    pending: own.filter((t) => t.status === "menunggu").length,
    balances: bookBalances(own),
  };
}

/** Periode arsip selalu hanya-baca: tidak ada pencatatan, perubahan, persetujuan, atau anggaran. */
export function archivePermissions(info: RoleInfo, archived: boolean): RoleInfo {
  if (!archived) return info;
  return { ...info, canCreate: false, canEdit: false, canDelete: false, canApprove: false, canManageBudget: false };
}

/** Anggota yang menjadi alumni saat periode ditutup (Pembina tetap menjabat). */
export function outgoingMembers(state: Pick<PeriodData, "members">, periodId: string) {
  return state.members.filter(
    (m) => m.periodId === periodId && (m.role === "bendahara" || m.role === "anggota"),
  );
}

/**
 * Tutup buku periode aktif dan mulai periode berikutnya.
 * - Periode lama diarsipkan (hanya-baca); transaksinya tetap tersimpan.
 * - Periode baru dimulai dari nol: tanpa transaksi & anggaran, saldo Rp 0 — kecuali
 *   `carryBalance`, yang membawa sisa saldo tiap buku kas sebagai "Saldo Awal".
 * - Ditolak selama masih ada transaksi menunggu persetujuan Pembina.
 */
export function startNewPeriod(data: PeriodData, opts: NewPeriodOptions): NewPeriodResult {
  const current = activePeriod(data);
  if (!current) return { ok: false, error: "Tidak ada periode aktif." };
  const periodTxs = inPeriod(data.transactions, current.id);
  const pending = periodTxs.filter((t) => t.status === "menunggu").length;
  if (pending > 0)
    return { ok: false, error: `Masih ada ${pending} transaksi menunggu persetujuan Pembina. Selesaikan dulu sebelum tutup buku.` };
  const nominal = nextSchoolYear(current);
  if (data.periods.some((p) => p.id === nominal.id)) return { ok: false, error: `Periode ${nominal.label} sudah ada.` };

  const closed: Period = { ...current, status: "ditutup", closedAt: opts.today, closingBalance: balanceOf(periodTxs) };
  const next: Period = { ...nominal, status: "aktif" };

  const carried: Transaction[] = [];
  if (opts.carryBalance) {
    const balances = bookBalances(periodTxs);
    for (const { id: book, label } of CASH_BOOKS) {
      const amount = balances[book];
      if (amount === 0) continue;
      carried.push({
        id: newId(),
        periodId: next.id,
        date: opts.today,
        description: `Saldo awal ${label} dari periode ${current.label}`,
        category: CARRY_OVER_CATEGORY,
        type: amount > 0 ? "masuk" : "keluar",
        amount: Math.abs(amount),
        status: "selesai",
        carryOver: true,
        book,
      });
    }
  }

  const outgoing = new Set(outgoingMembers(data, current.id).map((m) => m.id));
  const nextHasPembina = data.members.some((m) => m.periodId === next.id && m.role === "pembina");
  const members = data.members.map((m): Member => {
    if (outgoing.has(m.id))
      return { ...m, role: "alumni", access: opts.oldMemberAccess, jabatan: `${m.jabatan} ${current.label}` };
    if (m.role === "pembina" && m.periodId === current.id && !nextHasPembina) return { ...m, periodId: next.id };
    return m;
  });

  return {
    ok: true,
    closed,
    next,
    data: {
      periods: [...data.periods.map((p) => (p.id === current.id ? closed : p)), next],
      transactions: [...carried, ...data.transactions],
      budgets: data.budgets,
      members,
    },
  };
}

// ---------------------------------------------------------------------------
// Data contoh: periode lalu (arsip) + periode berjalan, relatif terhadap hari ini
// ---------------------------------------------------------------------------

export function buildSeed(now: Date): OrgState {
  const currentSY = schoolYearOf(now);
  const prevSY = schoolYear(Number(currentSY.id.slice(0, 4)) - 1);
  const todayStr = format(now, "yyyy-MM-dd");

  const txs: Transaction[] = [];
  let n = 0;
  const add = (
    periodId: string,
    date: Date,
    description: string,
    category: string,
    type: TxType,
    amount: number,
    status: TxStatus = "selesai",
    carryOver = false,
  ) => {
    n += 1;
    txs.push({
      id: `seed-${String(n).padStart(3, "0")}`,
      periodId,
      date: format(date, "yyyy-MM-dd"),
      description,
      category,
      type,
      amount,
      status,
      ...(carryOver ? { carryOver: true } : {}),
    });
  };

  const wiggle = [1, 1.08, 0.94, 1.12, 0.97, 1.05];
  const routine = (periodId: string, month: Date, i: number) => {
    const w = wiggle[i % wiggle.length] ?? 1;
    const d = (day: number) => new Date(month.getFullYear(), month.getMonth(), day);
    add(periodId, d(5), "Iuran kas OSIS bulanan", "Iuran", "masuk", Math.round(1_800_000 * w));
    add(periodId, d(7), "Operasional sekretariat OSIS", "Operasional", "keluar", 350_000);
    add(periodId, d(14), "Konsumsi rapat pengurus", "Konsumsi", "keluar", Math.round(300_000 * w));
    add(periodId, d(20), "Program kerja bulanan", "Kegiatan", "keluar", Math.round(1_100_000 * w));
    if (i % 3 === 0) add(periodId, d(9), "Donasi alumni & komite sekolah", "Donasi", "masuk", 1_000_000);
    if (i % 4 === 1) add(periodId, d(18), "Sponsor pentas seni", "Sponsor", "masuk", 2_000_000);
    if (i % 2 === 0) add(periodId, d(24), "Transport lomba antarsekolah", "Transportasi", "keluar", Math.round(250_000 * w));
    if (i % 3 === 2) add(periodId, d(26), "ATK & cetak proposal", "Perlengkapan", "keluar", 280_000);
  };

  // Periode lalu (arsip)
  const prevStart = new Date(`${prevSY.start}T00:00:00`);
  add(prevSY.id, prevStart, "Saldo awal dari periode sebelumnya", CARRY_OVER_CATEGORY, "masuk", 3_500_000, "selesai", true);
  for (let i = 0; i < 12; i++) routine(prevSY.id, addMonths(prevStart, i), i);
  const prevClosing = balanceOf(txs);

  // Periode berjalan
  const curStart = new Date(`${currentSY.start}T00:00:00`);
  add(currentSY.id, curStart, `Saldo awal dari periode ${prevSY.label}`, CARRY_OVER_CATEGORY, "masuk", prevClosing, "selesai", true);
  const monthsSoFar = differenceInCalendarMonths(now, curStart);
  for (let i = 0; i < monthsSoFar; i++) routine(currentSY.id, addMonths(curStart, i), i);
  const today = now.getDate();
  const cd = (day: number) => new Date(now.getFullYear(), now.getMonth(), Math.min(day, today));
  add(currentSY.id, cd(2), "Iuran kas OSIS bulanan", "Iuran", "masuk", 1_950_000);
  add(currentSY.id, cd(4), "Donasi alumni angkatan 2020", "Donasi", "masuk", 750_000);
  add(currentSY.id, cd(5), "Operasional sekretariat OSIS", "Operasional", "keluar", 350_000);
  add(currentSY.id, cd(6), "Konsumsi rapat koordinasi", "Konsumsi", "keluar", 365_000);
  add(currentSY.id, cd(8), "Snack kegiatan bakti sosial", "Konsumsi", "keluar", 220_000);
  add(currentSY.id, cd(9), "Banner & spanduk class meeting", "Perlengkapan", "keluar", 450_000);
  add(currentSY.id, cd(10), "Sewa sound system pensi", "Kegiatan", "keluar", 1_400_000, "menunggu");
  add(currentSY.id, cd(10), "Transport survei lokasi LDKS", "Transportasi", "keluar", 210_000);
  add(currentSY.id, cd(10), "Pembelian printer (dibatalkan)", "Perlengkapan", "keluar", 2_300_000, "dibatalkan");

  // Kas Angkatan: buku terpisah dari Kas OSIS
  const angkatan = (date: Date, description: string, category: string, type: TxType, amount: number) => {
    add(currentSY.id, date, description, category, type, amount);
    txs[txs.length - 1]!.book = "angkatan";
  };
  for (let i = 0; i < monthsSoFar; i++) {
    const m = addMonths(curStart, i);
    angkatan(new Date(m.getFullYear(), m.getMonth(), 3), "Iuran kas angkatan kelas XII", "Iuran", "masuk", 900_000);
    if (i % 2 === 1)
      angkatan(new Date(m.getFullYear(), m.getMonth(), 16), "Konsumsi rapat panitia angkatan", "Konsumsi", "keluar", 150_000);
  }
  angkatan(cd(3), "Iuran kas angkatan kelas XII", "Iuran", "masuk", 900_000);
  angkatan(cd(7), "DP cetak buku tahunan angkatan", "Perlengkapan", "keluar", 600_000);

  const budgetFor = (periodId: string, f: number): Budget[] => [
    { id: `bdg-${periodId}-1`, periodId, category: "Operasional", allocation: Math.round(500_000 * f) },
    { id: `bdg-${periodId}-2`, periodId, category: "Konsumsi", allocation: Math.round(700_000 * f) },
    { id: `bdg-${periodId}-3`, periodId, category: "Kegiatan", allocation: Math.round(2_000_000 * f) },
    { id: `bdg-${periodId}-4`, periodId, category: "Perlengkapan", allocation: Math.round(500_000 * f) },
    { id: `bdg-${periodId}-5`, periodId, category: "Transportasi", allocation: Math.round(400_000 * f) },
  ];

  const members: Member[] = [
    { id: "usr-1", name: "Siti Rahmawati", jabatan: "Bendahara Umum", role: "bendahara", access: "aktif", periodId: currentSY.id },
    { id: "usr-2", name: "Dra. Hartini, M.Pd.", jabatan: "Pembina OSIS", role: "pembina", access: "aktif", periodId: currentSY.id },
    { id: "usr-3", name: "Andi Pratama", jabatan: "Sekretaris OSIS", role: "anggota", access: "aktif", periodId: currentSY.id },
    { id: "usr-4", name: "Rizky Maulana", jabatan: `Bendahara Umum ${prevSY.label}`, role: "alumni", access: "read-only", periodId: prevSY.id },
    { id: "usr-5", name: "Dewi Lestari", jabatan: `Ketua OSIS ${prevSY.label}`, role: "alumni", access: "dicabut", periodId: prevSY.id },
  ];

  return {
    periods: [
      { ...prevSY, status: "ditutup", closedAt: prevSY.end, closingBalance: prevClosing },
      { ...currentSY, status: "aktif" },
    ],
    members,
    transactions: txs.filter((t) => t.date <= todayStr || t.periodId !== currentSY.id),
    budgets: [
      ...budgetFor(prevSY.id, 0.9),
      ...budgetFor(currentSY.id, 1),
      { id: `bdg-${currentSY.id}-a1`, periodId: currentSY.id, category: "Perlengkapan", allocation: 1_000_000, book: "angkatan" },
      { id: `bdg-${currentSY.id}-a2`, periodId: currentSY.id, category: "Konsumsi", allocation: 300_000, book: "angkatan" },
    ],
    currentUserId: "usr-1",
    selectedPeriodId: currentSY.id,
    largeExpenseThreshold: DEFAULT_LARGE_EXPENSE,
  };
}

// ---------------------------------------------------------------------------
// Bantuan AI: saran kategori & deteksi duplikat
// ---------------------------------------------------------------------------

export interface TxDraft {
  date: string;
  description: string;
  type: TxType;
  amount: number;
}

export type AiCandidate = Pick<Transaction, "id" | "date" | "description" | "category" | "amount">;

export const DUPLICATE_WINDOW_DAYS = 30;
export const DUPLICATE_MAX_CANDIDATES = 25;

export function categoriesFor(type: TxType): readonly string[] {
  return type === "masuk" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

function dayDiff(a: string, b: string) {
  return Math.abs(new Date(`${a}T00:00:00`).getTime() - new Date(`${b}T00:00:00`).getTime()) / 86_400_000;
}

/**
 * Transaksi lama yang layak dibandingkan oleh AI: jenis sama, tidak dibatalkan,
 * bukan saldo awal, dan tanggalnya dalam ±30 hari dari draf. Jumlah yang sama
 * diprioritaskan, lalu tanggal yang paling dekat. Maksimal 25 transaksi.
 */
export function duplicateCandidates(draft: TxDraft, txs: Transaction[]): Transaction[] {
  return txs
    .filter(
      (t) =>
        t.type === draft.type && isCounted(t) && !t.carryOver && dayDiff(t.date, draft.date) <= DUPLICATE_WINDOW_DAYS,
    )
    .map((t) => ({ t, sameAmount: draft.amount > 0 && t.amount === draft.amount, gap: dayDiff(t.date, draft.date) }))
    .sort((a, b) => Number(b.sameAmount) - Number(a.sameAmount) || a.gap - b.gap)
    .slice(0, DUPLICATE_MAX_CANDIDATES)
    .map((x) => x.t);
}

export type AiConfidence = "tinggi" | "sedang" | "rendah";

export interface AiAnalysis {
  category: string | null;
  confidence: AiConfidence;
  reason: string;
  duplicates: { id: string; reason: string }[];
}

/** Hanya terima kategori yang sah untuk jenis transaksi & ID duplikat yang memang dikirim. */
export function sanitizeAnalysis(raw: AiAnalysis, type: TxType, candidateIds: string[]): AiAnalysis {
  const allowed = categoriesFor(type);
  const ids = new Set(candidateIds);
  const seen = new Set<string>();
  return {
    category: raw.category && allowed.includes(raw.category) ? raw.category : null,
    confidence: (["tinggi", "sedang", "rendah"] as const).includes(raw.confidence) ? raw.confidence : "rendah",
    reason: raw.reason.trim().slice(0, 240),
    duplicates: raw.duplicates
      .filter((d) => ids.has(d.id) && !seen.has(d.id) && seen.add(d.id))
      .slice(0, 5)
      .map((d) => ({ id: d.id, reason: d.reason.trim().slice(0, 200) })),
  };
}

// ---------------------------------------------------------------------------
// Nama pengurus per peran + reset data ke kosong (saldo Rp 0)
// ---------------------------------------------------------------------------

export type PeopleNames = Record<Role, string>;

export const EMPTY_PEOPLE: PeopleNames = { bendahara: "", pembina: "", anggota: "", alumni: "" };

/** Nama contoh — hanya dipakai saat "Muat data contoh". */
export const SAMPLE_PEOPLE: PeopleNames = {
  bendahara: "Siti Rahmawati",
  pembina: "Dra. Hartini, M.Pd.",
  anggota: "Andi Pratama",
  alumni: "Rizky Maulana",
};

export function initialsOf(name: string) {
  const parts = name
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 || /\p{Lu}/u.test(w));
  const meaningful = parts.filter((w) => !/^(dra?|drs|s|m|pd|sp|st|ir|hj?)$/i.test(w));
  const words = meaningful.length ? meaningful : parts;
  return words
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/** Nama tampilan: nama yang diisi, atau label peran bila belum diisi. */
export function personDisplay(role: Role, people: PeopleNames | undefined) {
  const name = (people?.[role] ?? "").trim();
  return {
    name: name || ROLES[role].label,
    initials: name ? initialsOf(name) || "?" : initialsOf(ROLES[role].label),
    filled: Boolean(name),
  };
}

/** Data kosong: tanpa transaksi, anggaran, maupun pengguna — saldo kembali Rp 0. */
export function emptyData() {
  return {
    transactions: [] as Transaction[],
    budgets: [] as Budget[],
    members: [] as Member[],
    people: { ...EMPTY_PEOPLE },
  };
}

// ---------------------------------------------------------------------------
// Daftar pengurus & penerus (diisi sendiri oleh Bendahara)
// ---------------------------------------------------------------------------

export type MemberInput = Pick<Member, "name" | "jabatan" | "role" | "periodId">;

const ROLE_ORDER: Role[] = ["bendahara", "pembina", "anggota", "alumni"];

/** Periode pengurus saat ini dan periode penerusnya (tahun ajaran berikutnya). */
export function boardPeriods(now: Date) {
  const current = schoolYearOf(now);
  return { current, successor: nextSchoolYear(current) };
}

/** Pesan galat bila isian pengurus tidak valid, atau null bila boleh disimpan. */
export function validateMember(input: MemberInput, members: Member[], editingId?: string): string | null {
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 2) return "Nama minimal 2 huruf.";
  if (name.length > 60) return "Nama maksimal 60 karakter.";
  if (!input.jabatan.trim()) return "Jabatan wajib diisi.";
  const samePeriod = members.filter((m) => m.periodId === input.periodId && m.id !== editingId);
  if (samePeriod.some((m) => m.name.trim().toLowerCase() === name.toLowerCase()))
    return "Nama ini sudah terdaftar di periode yang sama.";
  if (input.role === "bendahara" && samePeriod.some((m) => m.role === "bendahara"))
    return "Periode ini sudah punya Bendahara Utama.";
  return null;
}

export function normalizeMember(input: MemberInput): MemberInput {
  return {
    ...input,
    name: input.name.trim().replace(/\s+/g, " "),
    jabatan: input.jabatan.trim().replace(/\s+/g, " "),
  };
}

/** Pengurus satu periode, diurutkan menurut peran lalu nama. */
export function membersOf(members: Member[], periodId: string) {
  return members
    .filter((m) => m.periodId === periodId)
    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.name.localeCompare(b.name, "id"));
}

/** Nama yang tampil per peran: diambil dari pengurus periode aktif (alumni dari periode mana pun). */
export function peopleFromMembers(members: Member[], periodId: string): PeopleNames {
  const people: PeopleNames = { ...EMPTY_PEOPLE };
  for (const role of ROLE_ORDER) {
    const found = members.find(
      (m) => m.role === role && m.access !== "dicabut" && (role === "alumni" || m.periodId === periodId),
    );
    if (found) people[role] = found.name;
  }
  return people;
}
