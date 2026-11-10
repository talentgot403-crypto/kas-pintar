import { describe, expect, it } from "vitest";

import { budgetUsage, duplicateCandidates, filterTransactions, ROLES, sanitizeAnalysis, summarize, type Transaction } from "./finance";

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
