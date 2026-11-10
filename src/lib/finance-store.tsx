import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { buildSeed, newId, ROLES, schoolYearOf, type Budget, type Role, type Transaction, type TxStatus } from "./finance";

const STORAGE_KEY = "sikeu-data-v2";

interface FinanceState {
  transactions: Transaction[];
  budgets: Budget[];
  role: Role;
}

interface FinanceContextValue extends FinanceState {
  now: Date;
  permissions: (typeof ROLES)[Role];
  setRole: (role: Role) => void;
  addTransaction: (tx: Omit<Transaction, "id" | "periodId">) => void;
  deleteTransaction: (id: string) => void;
  setStatus: (id: string, status: TxStatus) => void;
  upsertBudget: (b: Omit<Budget, "id" | "periodId"> & { id?: string | undefined }) => void;
  deleteBudget: (id: string) => void;
  clearAll: () => void;
  loadSample: () => void;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [now] = useState(() => new Date());
  const [state, setState] = useState<FinanceState>(() => ({ ...buildSeed(now), role: "bendahara" }));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as FinanceState;
        if (Array.isArray(parsed.transactions) && Array.isArray(parsed.budgets)) setState(parsed);
      }
    } catch {
      // abaikan data rusak
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, hydrated]);

  const setRole = useCallback((role: Role) => setState((s) => ({ ...s, role })), []);
  const addTransaction = useCallback(
    (tx: Omit<Transaction, "id" | "periodId">) =>
      setState((s) => ({
        ...s,
        transactions: [{ ...tx, id: newId(), periodId: schoolYearOf(new Date(`${tx.date}T00:00:00`)).id }, ...s.transactions],
      })),
    [],
  );
  const deleteTransaction = useCallback(
    (id: string) => setState((s) => ({ ...s, transactions: s.transactions.filter((t) => t.id !== id) })),
    [],
  );
  const setStatus = useCallback(
    (id: string, status: TxStatus) =>
      setState((s) => ({
        ...s,
        transactions: s.transactions.map((t) => (t.id === id ? { ...t, status } : t)),
      })),
    [],
  );
  const upsertBudget = useCallback(
    (b: Omit<Budget, "id" | "periodId"> & { id?: string | undefined }) =>
      setState((s) => {
        if (b.id) return { ...s, budgets: s.budgets.map((x) => (x.id === b.id ? { ...x, ...b, id: x.id } : x)) };
        return { ...s, budgets: [...s.budgets, { ...b, id: newId("bdg"), periodId: schoolYearOf(now).id }] };
      }),
    [],
  );
  const deleteBudget = useCallback(
    (id: string) => setState((s) => ({ ...s, budgets: s.budgets.filter((b) => b.id !== id) })),
    [],
  );
  const clearAll = useCallback(() => setState((s) => ({ ...s, transactions: [], budgets: [] })), []);
  const loadSample = useCallback(() => setState((s) => ({ ...s, ...buildSeed(new Date()) })), []);

  const value = useMemo<FinanceContextValue>(
    () => ({
      ...state,
      now,
      permissions: ROLES[state.role],
      setRole,
      addTransaction,
      deleteTransaction,
      setStatus,
      upsertBudget,
      deleteBudget,
      clearAll,
      loadSample,
    }),
    [state, now, setRole, addTransaction, deleteTransaction, setStatus, upsertBudget, deleteBudget, clearAll, loadSample],
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance must be used within FinanceProvider");
  return ctx;
}
