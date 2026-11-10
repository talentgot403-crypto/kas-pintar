import { addMonths, differenceInCalendarMonths, format, startOfMonth } from "date-fns";
import { id as localeId } from "date-fns/locale";

export type TxType = "masuk" | "keluar";
export type TxStatus = "selesai" | "menunggu" | "dibatalkan";
export type Role = "bendahara" | "pembina" | "anggota" | "alumni";
export type AccessStatus = "aktif" | "read-only" | "dicabut";
export type PeriodStatus = "aktif" | "ditutup";

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
}

export interface Budget {
  id: string;
  periodId: string;
  category: string;
  allocation: number; // per bulan
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

export function newId(prefix = "tx") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// ---------------------------------------------------------------------------
// Serah terima jabatan (tutup buku)
// ---------------------------------------------------------------------------

export interface HandoverOptions {
  newTreasurerName: string;
  oldMemberAccess: "read-only" | "dicabut";
  copyBudgets: boolean;
  today: string; // yyyy-MM-dd
}

export type HandoverResult = { ok: true; state: OrgState; closed: Period; next: Period } | { ok: false; error: string };

export function activePeriod(state: Pick<OrgState, "periods">) {
  return state.periods.find((p) => p.status === "aktif");
}

/** Anggota yang akan menjadi alumni saat serah terima (Pembina tetap menjabat). */
export function outgoingMembers(state: Pick<OrgState, "members">, periodId: string) {
  return state.members.filter(
    (m) => m.periodId === periodId && (m.role === "bendahara" || m.role === "anggota"),
  );
}

export function handoverBlockers(state: OrgState) {
  const p = activePeriod(state);
  if (!p) return { pending: 0 };
  return { pending: state.transactions.filter((t) => t.periodId === p.id && t.status === "menunggu").length };
}

export function performHandover(state: OrgState, opts: HandoverOptions): HandoverResult {
  const current = activePeriod(state);
  if (!current) return { ok: false, error: "Tidak ada periode aktif." };
  const name = opts.newTreasurerName.trim();
  if (name.length < 3) return { ok: false, error: "Nama bendahara baru minimal 3 karakter." };
  const { pending } = handoverBlockers(state);
  if (pending > 0) return { ok: false, error: `Masih ada ${pending} transaksi menunggu persetujuan Pembina.` };

  const closingBalance = balanceOf(state.transactions.filter((t) => t.periodId === current.id));
  const closed: Period = { ...current, status: "ditutup", closedAt: opts.today, end: opts.today, closingBalance };
  const nominal = nextSchoolYear(current);
  const next: Period = { ...nominal, start: opts.today, status: "aktif" };

  const transactions = [...state.transactions];
  if (closingBalance !== 0) {
    transactions.unshift({
      id: newId(),
      periodId: next.id,
      date: opts.today,
      description: `Saldo awal dari periode ${current.label}`,
      category: CARRY_OVER_CATEGORY,
      type: closingBalance > 0 ? "masuk" : "keluar",
      amount: Math.abs(closingBalance),
      status: "selesai",
      carryOver: true,
    });
  }

  const outgoing = new Set(outgoingMembers(state, current.id).map((m) => m.id));
  const treasurer: Member = {
    id: newId("usr"),
    name,
    jabatan: "Bendahara Umum",
    role: "bendahara",
    access: "aktif",
    periodId: next.id,
  };
  const members = state.members.map((m): Member => {
    if (outgoing.has(m.id))
      return { ...m, role: "alumni", access: opts.oldMemberAccess, jabatan: `${m.jabatan} ${current.label}` };
    if (m.role === "pembina" && m.periodId === current.id) return { ...m, periodId: next.id };
    return m;
  });

  const budgets = opts.copyBudgets
    ? [
        ...state.budgets,
        ...state.budgets
          .filter((b) => b.periodId === current.id)
          .map((b) => ({ ...b, id: newId("bdg"), periodId: next.id })),
      ]
    : state.budgets;

  return {
    ok: true,
    closed,
    next,
    state: {
      ...state,
      periods: [...state.periods.map((p) => (p.id === current.id ? closed : p)), next],
      transactions,
      budgets,
      members: [...members, treasurer],
      currentUserId: treasurer.id,
      selectedPeriodId: next.id,
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
    budgets: [...budgetFor(prevSY.id, 0.9), ...budgetFor(currentSY.id, 1)],
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
