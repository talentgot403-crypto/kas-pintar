import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  applyEdit,
  buildSeed,
  DEFAULT_LARGE_EXPENSE,
  emptyData,
  inBook,
  isCashBook,
  initialStatus,
  newId,
  normalizeMember,
  peopleFromMembers,
  ROLES,
  schoolYearOf,
  type Budget,
  type CashBook,
  type Member,
  type MemberInput,
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
  /** Daftar pengurus & penerus yang diisi sendiri oleh Bendahara. */
  members: Member[];
  /** Buku kas yang sedang dibuka (Kas OSIS / Kas Angkatan). */
  book: CashBook;
}

interface FinanceContextValue extends FinanceState {
  now: Date;
  /** Nama per peran, diambil dari daftar pengurus periode aktif. */
  people: PeopleNames;
  /** Transaksi & anggaran milik buku kas yang sedang dibuka saja. */
  bookTransactions: Transaction[];
  bookBudgets: Budget[];
  setBook: (book: CashBook) => void;
  permissions: (typeof ROLES)[Role];
  setRole: (role: Role) => void;
  /** Status ditentukan otomatis: pengeluaran ≥ batas menunggu persetujuan Pembina. */
  addTransaction: (tx: TxInput) => Transaction;
  updateTransaction: (id: string, patch: TxInput) => Transaction | null;
  setThreshold: (amount: number) => void;
  addMember: (input: MemberInput) => Member;
  updateMember: (id: string, input: MemberInput) => void;
  deleteMember: (id: string) => Member | undefined;
  restoreMember: (member: Member) => void;
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
    transactions: [],
    budgets: [],
    members: [],
    role: "bendahara",
    largeExpenseThreshold: DEFAULT_LARGE_EXPENSE,
    book: "osis",
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
            members: Array.isArray(parsed.members) ? parsed.members : [],
            book: isCashBook(parsed.book) ? parsed.book : "osis",
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
  const setBook = useCallback((book: CashBook) => setState((s) => ({ ...s, book })), []);
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
  const addMember = useCallback((input: MemberInput) => {
    const member: Member = { ...normalizeMember(input), id: newId("usr"), access: "aktif" };
    setState((s) => ({ ...s, members: [...s.members, member] }));
    return member;
  }, []);
  const updateMember = useCallback(
    (id: string, input: MemberInput) =>
      setState((s) => ({
        ...s,
        members: s.members.map((m) => (m.id === id ? { ...m, ...normalizeMember(input) } : m)),
      })),
    [],
  );
  const deleteMember = useCallback(
    (id: string) => {
      const removed = state.members.find((m) => m.id === id);
      setState((s) => ({ ...s, members: s.members.filter((m) => m.id !== id) }));
      return removed;
    },
    [state.members],
  );
  const restoreMember = useCallback(
    (member: Member) =>
      setState((s) => (s.members.some((m) => m.id === member.id) ? s : { ...s, members: [...s.members, member] })),
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
        return {
          ...s,
          budgets: [...s.budgets, { ...b, id: newId("bdg"), periodId: schoolYearOf(now).id, book: s.book }],
        };
      }),
    [],
  );
  const deleteBudget = useCallback(
    (id: string) => setState((s) => ({ ...s, budgets: s.budgets.filter((b) => b.id !== id) })),
    [],
  );
  const clearAll = useCallback(() => {
    const { transactions, budgets, members } = emptyData();
    setState((s) => ({ ...s, transactions, budgets, members }));
  }, []);
  const loadSample = useCallback(() => {
    const { transactions, budgets, members } = buildSeed(new Date());
    setState((s) => ({ ...s, transactions, budgets, members }));
  }, []);
  const people = useMemo(() => peopleFromMembers(state.members, schoolYearOf(now).id), [state.members, now]);
  const bookTransactions = useMemo(() => inBook(state.transactions, state.book), [state.transactions, state.book]);
  const bookBudgets = useMemo(() => inBook(state.budgets, state.book), [state.budgets, state.book]);

  const value = useMemo<FinanceContextValue>(
    () => ({
      ...state,
      now,
      people,
      bookTransactions,
      bookBudgets,
      setBook,
      permissions: ROLES[state.role],
      setRole,
      addTransaction,
      updateTransaction,
      setThreshold,
      addMember,
      updateMember,
      deleteMember,
      restoreMember,
      deleteTransaction,
      setStatus,
      upsertBudget,
      deleteBudget,
      clearAll,
      loadSample,
    }),
    [
      state,
      now,
      people,
      bookTransactions,
      bookBudgets,
      setBook,
      setRole,
      addTransaction,
      updateTransaction,
      setThreshold,
      addMember,
      updateMember,
      deleteMember,
      restoreMember,
      deleteTransaction,
      setStatus,
      upsertBudget,
      deleteBudget,
      clearAll,
      loadSample,
    ],
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("useFinance must be used within FinanceProvider");
  return ctx;
}
