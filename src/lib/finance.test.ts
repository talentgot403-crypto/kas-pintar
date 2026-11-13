import { describe, expect, it } from "vitest";

import {
  applyEdit,
  balanceOf,
  boardPeriods,
  bookOf,
  buildSeed,
  inBook,
  performHandover,
  toCSV,
  budgetUsage,
  duplicateCandidates,
  filterTransactions,
  initialStatus,
  isEditable,
  peopleFromMembers,
  personDisplay,
  ROLES,
  sanitizeAnalysis,
  summarize,
  validateMember,
  type Member,
  type Transaction,
} from "./finance";

const now = new Date(2026, 10, 15); // 15 Nov 2026

const tx = (p: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(),
  periodId: "2026-2027",
  date: "2026-11-05",
  description: "x",
  category: "Iuran",
  type: "masuk",
  amount: 0,
  status: "selesai",
  ...p,
});

describe("finance rules", () => {
  it("excludes cancelled transactions from balance and monthly totals", () => {
    const txs = [
      tx({ amount: 1_000_000 }),
      tx({ type: "keluar", category: "Konsumsi", amount: 300_000 }),
      tx({ type: "keluar", category: "Konsumsi", amount: 500_000, status: "dibatalkan" }),
      tx({ date: "2026-10-01", amount: 200_000 }),
    ];
    const s = summarize(txs, [], now);
    expect(s.balance).toBe(900_000);
    expect(s.incomeMonth).toBe(1_000_000);
    expect(s.expenseMonth).toBe(300_000);
  });

  it("budget usage counts only this month's expenses in the category", () => {
    const txs = [
      tx({ type: "keluar", category: "Konsumsi", amount: 900_000 }),
      tx({ type: "keluar", category: "Konsumsi", amount: 400_000, date: "2026-10-20" }),
      tx({ type: "keluar", category: "Operasional", amount: 100_000 }),
    ];
    const u = budgetUsage([{ id: "b", periodId: "2026-2027", category: "Konsumsi", allocation: 1_200_000 }], txs, now)[0]!;
    expect(u.used).toBe(900_000);
    expect(u.percent).toBe(75);
    expect(u.remaining).toBe(300_000);
  });

  it("filters by inclusive date range, type and category", () => {
    const txs = [
      tx({ id: "a", date: "2026-11-01" }),
      tx({ id: "b", date: "2026-11-10", type: "keluar", category: "Konsumsi" }),
      tx({ id: "c", date: "2026-11-20" }),
    ];
    expect(filterTransactions(txs, { from: "2026-11-01", to: "2026-11-10" }).map((t) => t.id)).toEqual(["b", "a"]);
    expect(filterTransactions(txs, { type: "keluar" }).map((t) => t.id)).toEqual(["b"]);
    expect(filterTransactions(txs, { category: "Iuran" }).map((t) => t.id)).toEqual(["c", "a"]);
  });

  it("only the treasurer can record transactions; only the chair approves; viewers cannot export", () => {
    expect(ROLES.bendahara.canCreate).toBe(true);
    expect(ROLES.pembina.canCreate).toBe(false);
    expect(ROLES.anggota.canCreate).toBe(false);
    expect(ROLES.pembina.canApprove).toBe(true);
    expect(ROLES.bendahara.canApprove).toBe(false);
    expect(ROLES.anggota.canExport).toBe(false);
  });
});

describe("AI helper rules", () => {
  const draft = { date: "2026-11-10", description: "Konsumsi rapat", type: "keluar" as const, amount: 500_000 };

  it("only compares same-type, non-cancelled transactions within 30 days", () => {
    const txs = [
      tx({ id: "ok", type: "keluar", date: "2026-10-12" }),
      tx({ id: "too-old", type: "keluar", date: "2026-10-10" }),
      tx({ id: "income", type: "masuk", date: "2026-11-10" }),
      tx({ id: "cancelled", type: "keluar", date: "2026-11-10", status: "dibatalkan" }),
    ];
    expect(duplicateCandidates(draft, txs).map((t) => t.id)).toEqual(["ok"]);
  });

  it("puts equal amounts first and sends at most 25 candidates", () => {
    const txs = Array.from({ length: 30 }, (_, i) =>
      tx({ id: `t${i}`, type: "keluar", date: "2026-11-09", amount: i === 29 ? 500_000 : 1 }),
    );
    const out = duplicateCandidates(draft, txs);
    expect(out).toHaveLength(25);
    expect(out[0]?.id).toBe("t29");
  });

  it("drops a suggested category not valid for the transaction type and unknown duplicate ids", () => {
    const out = sanitizeAnalysis(
      { category: "Iuran", confidence: "tinggi", reason: "x", duplicates: [{ id: "a", reason: "" }, { id: "zzz", reason: "" }] },
      "keluar",
      ["a"],
    );
    expect(out.category).toBeNull();
    expect(out.duplicates.map((d) => d.id)).toEqual(["a"]);
  });
});

describe("large expense approval", () => {
  const LIMIT = 1_000_000;
  const base = {
    date: "2026-11-10",
    description: "Sewa sound system",
    category: "Kegiatan",
    type: "keluar" as const,
    book: "osis" as const,
  };

  it("expenses at or above the limit wait for Pembina; below it or income are done immediately", () => {
    expect(initialStatus("keluar", 1_000_000, LIMIT)).toBe("menunggu");
    expect(initialStatus("keluar", 999_999, LIMIT)).toBe("selesai");
    expect(initialStatus("masuk", 5_000_000, LIMIT)).toBe("selesai");
  });

  it("changing the amount of an approved large expense sends it back for approval", () => {
    const prev = tx({ ...base, amount: 1_400_000, status: "selesai" });
    expect(applyEdit(prev, { ...base, amount: 1_500_000 }, LIMIT).status).toBe("menunggu");
  });

  it("editing only the description of an approved large expense keeps it approved", () => {
    const prev = tx({ ...base, amount: 1_400_000, status: "selesai" });
    const next = applyEdit(prev, { ...base, description: "Sewa sound system pensi", amount: 1_400_000 }, LIMIT);
    expect(next.status).toBe("selesai");
    expect(next.description).toBe("Sewa sound system pensi");
  });

  it("lowering a pending expense below the limit completes it; cancelled stays cancelled", () => {
    expect(applyEdit(tx({ ...base, amount: 1_400_000, status: "menunggu" }), { ...base, amount: 900_000 }, LIMIT).status).toBe("selesai");
    expect(applyEdit(tx({ ...base, amount: 1_400_000, status: "dibatalkan" }), { ...base, amount: 2_000_000 }, LIMIT).status).toBe("dibatalkan");
  });

  it("moves an edited transaction to the school year of its new date", () => {
    const next = applyEdit(tx({ ...base, amount: 100_000 }), { ...base, date: "2026-06-30", amount: 100_000 }, LIMIT);
    expect(next.periodId).toBe("2025-2026");
  });

  it("carried-over opening balances cannot be edited; the treasurer can edit, Pembina cannot but sets the limit", () => {
    expect(isEditable(tx({ carryOver: true }))).toBe(false);
    expect(isEditable(tx({}))).toBe(true);
    expect(ROLES.bendahara.canEdit).toBe(true);
    expect(ROLES.pembina.canEdit).toBe(false);
    expect(ROLES.pembina.canConfigure).toBe(true);
    expect(ROLES.bendahara.canConfigure).toBe(false);
  });
});

describe("daftar pengurus & penerus", () => {
  const base = { name: "Nadia Putri", jabatan: "Bendahara Umum", role: "bendahara" as const, periodId: "2026-2027" };
  const existing: Member[] = [{ ...base, id: "m1", access: "aktif" }];

  it("current board is this school year and successors are the next one", () => {
    const { current, successor } = boardPeriods(new Date(2026, 10, 12));
    expect(current.label).toBe("2026/2027");
    expect(successor.label).toBe("2027/2028");
    expect(boardPeriods(new Date(2027, 5, 30)).current.label).toBe("2026/2027");
  });

  it("requires a name of at least 2 letters and a jabatan", () => {
    expect(validateMember({ ...base, name: " A " }, [])).toBe("Nama minimal 2 huruf.");
    expect(validateMember({ ...base, jabatan: "  " }, [])).toBe("Jabatan wajib diisi.");
    expect(validateMember(base, [])).toBeNull();
  });

  it("allows only one Bendahara Utama per period, but the successor period can have its own", () => {
    expect(validateMember({ ...base, name: "Raka" }, existing)).toBe("Periode ini sudah punya Bendahara Utama.");
    expect(validateMember({ ...base, name: "Raka", periodId: "2027-2028" }, existing)).toBeNull();
    expect(validateMember({ ...base, name: "Nadia P." }, existing, "m1")).toBeNull();
  });

  it("rejects the same name twice in one period (case-insensitive)", () => {
    expect(validateMember({ ...base, name: "nadia  putri", role: "anggota" }, existing)).toBe(
      "Nama ini sudah terdaftar di periode yang sama.",
    );
  });

  it("header names come from the current period, not the successors", () => {
    const people = peopleFromMembers(
      [...existing, { ...base, id: "m2", name: "Raka", periodId: "2027-2028", access: "aktif" }],
      "2026-2027",
    );
    expect(people.bendahara).toBe("Nadia Putri");
    expect(people.pembina).toBe("");
  });

  it("an empty board shows only role labels", () => {
    expect(personDisplay("bendahara", peopleFromMembers([], "2026-2027")).name).toBe("Bendahara Utama");
  });
});

describe("separate cash books (Kas OSIS / Kas Angkatan)", () => {
  it("transactions without a book belong to Kas OSIS", () => {
    expect(bookOf(tx({}))).toBe("osis");
    expect(bookOf(tx({ book: "angkatan" }))).toBe("angkatan");
  });

  it("each book has its own balance and monthly totals", () => {
    const txs = [
      tx({ amount: 2_000_000 }),
      tx({ type: "keluar", category: "Konsumsi", amount: 500_000 }),
      tx({ amount: 900_000, book: "angkatan" }),
      tx({ type: "keluar", category: "Konsumsi", amount: 150_000, book: "angkatan" }),
    ];
    expect(balanceOf(inBook(txs, "osis"))).toBe(1_500_000);
    expect(balanceOf(inBook(txs, "angkatan"))).toBe(750_000);
    const s = summarize(inBook(txs, "angkatan"), [], now);
    expect(s.incomeMonth).toBe(900_000);
    expect(s.expenseMonth).toBe(150_000);
  });

  it("budget usage only counts expenses from the same book", () => {
    const budgets = [{ id: "b", periodId: "2026-2027", category: "Konsumsi", allocation: 1_000_000, book: "angkatan" as const }];
    const txs = [
      tx({ type: "keluar", category: "Konsumsi", amount: 500_000 }),
      tx({ type: "keluar", category: "Konsumsi", amount: 200_000, book: "angkatan" }),
    ];
    const [u] = budgetUsage(inBook(budgets, "angkatan"), inBook(txs, "angkatan"), now);
    expect(u?.used).toBe(200_000);
    expect(inBook(budgets, "osis")).toHaveLength(0);
  });

  it("Excel export labels every row with its cash book", () => {
    const csv = toCSV([tx({ description: "Iuran", amount: 1 }), tx({ description: "Iuran XII", amount: 2, book: "angkatan" })]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Tanggal;Buku Kas;Keterangan;Kategori;Jenis;Jumlah;Status");
    expect(lines[1]).toContain(";Kas OSIS;");
    expect(lines[2]).toContain(";Kas Angkatan;");
  });

  it("handover carries each book's closing balance into its own book", () => {
    const seed = buildSeed(now);
    const cur = seed.periods.find((p) => p.status === "aktif")!;
    const state = { ...seed, transactions: seed.transactions.filter((t) => t.status !== "menunggu") };
    const osis = balanceOf(inBook(state.transactions.filter((t) => t.periodId === cur.id), "osis"));
    const angkatan = balanceOf(inBook(state.transactions.filter((t) => t.periodId === cur.id), "angkatan"));
    const res = performHandover(state, { newTreasurerName: "Nadia", oldMemberAccess: "read-only", copyBudgets: false, today: "2027-06-30" });
    if (!res.ok) throw new Error(res.error);
    const opening = res.state.transactions.filter((t) => t.periodId === res.next.id && t.carryOver);
    expect(balanceOf(inBook(opening, "osis"))).toBe(osis);
    expect(balanceOf(inBook(opening, "angkatan"))).toBe(angkatan);
    expect(angkatan).toBeGreaterThan(0);
  });
});
