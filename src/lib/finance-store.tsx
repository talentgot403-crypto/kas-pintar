import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  applyEdit,
  buildSeed,
  DEFAULT_LARGE_EXPENSE,
  EMPTY_PEOPLE,
  emptyData,
  initialStatus,
  newId,
  ROLES,
  SAMPLE_PEOPLE,
  schoolYearOf,
  type Budget,
  type PeopleNames,
  type Role,
  type Transaction,
  type TxInput,
  type TxStatus,
} from "./finance";

const STORAGE_KEY = "sikeu-data-v3";

interface FinanceState {
  transactions: Transaction[];
  budgets: Budget[];
  role: Role;
  largeExpenseThreshold: number;
  people: PeopleNames;
}

interface FinanceContextValue extends FinanceState {
  now: Date;
  permissions: (typeof ROLES)[Role];
  setRole: (role: Role) => void;
  /** Status ditentukan otomatis: pengeluaran ≥ batas menunggu persetujuan Pembina. */
  addTransaction: (tx: TxInput) => Transaction;
  updateTransaction: (id: string, patch: TxInput) => Transaction | null;
  setThreshold: (amount: number) => void;
  setPersonName: (role: Role, name: string) => void;
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
  const [state, setState] = useState<FinanceState>(() => ({
    ...emptyData(),
    role: "bendahara",
    largeExpenseThreshold: DEFAULT_LARGE_EXPENSE,
  }));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as FinanceState;
        if (Array.isArray(parsed.transactions) && Array.isArray(parsed.budgets))
          setState({
            ...parsed,
            largeExpenseThreshold:
              typeof parsed.largeExpenseThreshold === "number" && parsed.largeExpenseThreshold > 0
                ? parsed.largeExpenseThreshold
                : DEFAULT_LARGE_EXPENSE,
            people: { ...EMPTY_PEOPLE, ...(parsed.people ?? {}) },
          });
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
    (input: TxInput) => {
      const tx: Transaction = {
        ...input,
        id: newId(),
        periodId: schoolYearOf(new Date(`${input.date}T00:00:00`)).id,
        status: initialStatus(input.type, input.amount, state.largeExpenseThreshold),
      };
      setState((s) => ({ ...s, transactions: [tx, ...s.transactions] }));
      return tx;
    },
    [state.largeExpenseThreshold],
  );
  const updateTransaction = useCallback(
    (id: string, patch: TxInput) => {
      const prev = state.transactions.find((t) => t.id === id);
      if (!prev || prev.carryOver) return null;
      const next = applyEdit(prev, patch, state.largeExpenseThreshold);
      setState((s) => ({ ...s, transactions: s.transactions.map((t) => (t.id === id ? next : t)) }));
      return next;
    },
    [state.transactions, state.largeExpenseThreshold],
  );
  const setThreshold = useCallback(
    (amount: number) => setState((s) => ({ ...s, largeExpenseThreshold: Math.max(1, Math.round(amount)) })),
    [],
  );
  const setPersonName = useCallback(
    (role: Role, name: string) => setState((s) => ({ ...s, people: { ...s.people, [role]: name.trim() } })),
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
  const clearAll = useCallback(() => setState((s) => ({ ...s, ...emptyData() })), []);
  const loadSample = useCallback(
    () => setState((s) => ({ ...s, ...buildSeed(new Date()), people: { ...SAMPLE_PEOPLE } })),
    [],
  );

  const value = useMemo<FinanceContextValue>(
    () => ({
      ...state,
      now,
      permissions: ROLES[state.role],
      setRole,
      addTransaction,
      updateTransaction,
      setThreshold,
      setPersonName,
      deleteTransaction,
      setStatus,
      upsertBudget,
      deleteBudget,
      clearAll,
      loadSample,
    }),
    [state, now, setRole, addTransaction, updateTransaction, setThreshold, setPersonName, deleteTransaction, setStatus, upsertBudget, deleteBudget, clearAll, loadSample],
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance must be used within FinanceProvider");
  return ctx;
}
