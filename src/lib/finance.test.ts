import { describe, expect, it } from "vitest";

import { budgetUsage, filterTransactions, ROLES, summarize, type Transaction } from "./finance";

const now = new Date(2026, 10, 15); // 15 Nov 2026

const tx = (p: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(),
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
    const [u] = budgetUsage([{ id: "b", category: "Konsumsi", allocation: 1_200_000 }], txs, now);
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
    expect(ROLES.ketua.canCreate).toBe(false);
    expect(ROLES.anggota.canCreate).toBe(false);
    expect(ROLES.ketua.canApprove).toBe(true);
    expect(ROLES.bendahara.canApprove).toBe(false);
    expect(ROLES.anggota.canExport).toBe(false);
  });
});
