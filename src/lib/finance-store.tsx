import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { format } from "date-fns";

import {
  activePeriod as findActivePeriod,
  applyEdit,
  archivePermissions,
  buildSeed,
  DEFAULT_LARGE_EXPENSE,
  emptyData,
  ensurePeriods,
  inBook,
  inPeriod,
  isCashBook,
  initialStatus,
  newId,
  normalizeMember,
  peopleFromMembers,
  referenceDate,
  ROLES,
  schoolYearOf,
  startNewPeriod as runStartNewPeriod,
  type Budget,
  type CashBook,
  type Member,
  type MemberInput,
  type NewPeriodOptions,
  type NewPeriodResult,
  type PeopleNames,
  type Period,
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
  /** Periode kepengurusan; tepat satu yang aktif, sisanya arsip hanya-baca. */
  periods: Period[];
  /** Periode yang sedang dilihat (aktif atau arsip). */
  selectedPeriodId: string;
}

interface FinanceContextValue extends FinanceState {
  now: Date;
  /** Tanggal acuan "bulan ini": hari ini, atau tanggal tutup buku bila melihat arsip. */
  refDate: Date;
  activePeriod: Period;
  selectedPeriod: Period;
  /** true bila periode yang dilihat sudah ditutup (hanya-baca). */
  isArchive: boolean;
  setSelectedPeriod: (periodId: string) => void;
  /** Tutup buku periode aktif dan mulai periode berikutnya dari nol. */
  startNewPeriod: (opts: Omit<NewPeriodOptions, "today">) => NewPeriodResult;
  /** Nama per peran, diambil dari daftar pengurus periode aktif. */
  people: PeopleNames;
  /** Transaksi & anggaran milik buku kas dan periode yang sedang dibuka saja. */
  bookTransactions: Transaction[];
  bookBudgets: Budget[];
  setBook: (book: CashBook) => void;
  /** Hak akses peran; periode arsip selalu hanya-baca. */
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
  const [state, setState] = useState<FinanceState>(() => {
    const periods = ensurePeriods([], [], now);
    return {
      transactions: [],
      budgets: [],
      members: [],
      role: "bendahara",
      largeExpenseThreshold: DEFAULT_LARGE_EXPENSE,
      book: "osis",
      periods,
      selectedPeriodId: periods[0]!.id,
    };
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as FinanceState;
        if (Array.isArray(parsed.transactions) && Array.isArray(parsed.budgets)) {
          const periods = ensurePeriods(
            parsed.periods,
            [...parsed.transactions.map((t) => t.periodId), ...parsed.budgets.map((b) => b.periodId)],
            new Date(),
          );
          const active = findActivePeriod({ periods })!;
          setState({
            ...parsed,
            largeExpenseThreshold:
              typeof parsed.largeExpenseThreshold === "number" && parsed.largeExpenseThreshold > 0
                ? parsed.largeExpenseThreshold
                : DEFAULT_LARGE_EXPENSE,
            members: Array.isArray(parsed.members) ? parsed.members : [],
            book: isCashBook(parsed.book) ? parsed.book : "osis",
            periods,
            selectedPeriodId: periods.some((p) => p.id === parsed.selectedPeriodId) ? parsed.selectedPeriodId : active.id,
          });
        }
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
  const setSelectedPeriod = useCallback(
    (periodId: string) =>
      setState((s) => (s.periods.some((p) => p.id === periodId) ? { ...s, selectedPeriodId: periodId } : s)),
    [],
  );
  const active = findActivePeriod(state) ?? state.periods[0]!;
  const selected = state.periods.find((p) => p.id === state.selectedPeriodId) ?? active;
  const isArchive = selected.status !== "aktif";
  const addTransaction = useCallback(
    (input: TxInput) => {
      // Transaksi baru selalu masuk ke periode aktif; arsip tidak bisa ditambah.
      const tx: Transaction = {
        ...input,
        id: newId(),
        periodId: active.id,
        status: initialStatus(input.type, input.amount, state.largeExpenseThreshold),
      };
      setState((s) => ({ ...s, transactions: [tx, ...s.transactions] }));
      return tx;
    },
    [state.largeExpenseThreshold, active.id],
  );
  const updateTransaction = useCallback(
    (id: string, patch: TxInput) => {
      const prev = state.transactions.find((t) => t.id === id);
      if (!prev || prev.carryOver || prev.periodId !== active.id) return null;
      const next = applyEdit(prev, patch, state.largeExpenseThreshold);
      setState((s) => ({ ...s, transactions: s.transactions.map((t) => (t.id === id ? next : t)) }));
      return next;
    },
    [state.transactions, state.largeExpenseThreshold, active.id],
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
          budgets: [
            ...s.budgets,
            { ...b, id: newId("bdg"), periodId: findActivePeriod(s)?.id ?? schoolYearOf(new Date()).id, book: s.book },
          ],
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
    const periods = ensurePeriods([], [], new Date());
    setState((s) => ({ ...s, transactions, budgets, members, periods, selectedPeriodId: periods[0]!.id }));
  }, []);
  const loadSample = useCallback(() => {
    const { transactions, budgets, members, periods, selectedPeriodId } = buildSeed(new Date());
    setState((s) => ({ ...s, transactions, budgets, members, periods, selectedPeriodId }));
  }, []);
  const startNewPeriod = useCallback(
    (opts: Omit<NewPeriodOptions, "today">) => {
      const res = runStartNewPeriod(state, { ...opts, today: format(new Date(), "yyyy-MM-dd") });
      if (res.ok) setState((s) => ({ ...s, ...res.data, selectedPeriodId: res.next.id }));
      return res;
    },
    [state],
  );
  const refDate = useMemo(() => referenceDate(selected, now), [selected, now]);
  const permissions = useMemo(() => archivePermissions(ROLES[state.role], isArchive), [state.role, isArchive]);
  const people = useMemo(() => peopleFromMembers(state.members, active.id), [state.members, active.id]);
  const periodTransactions = useMemo(() => inPeriod(state.transactions, selected.id), [state.transactions, selected.id]);
  const bookTransactions = useMemo(() => inBook(periodTransactions, state.book), [periodTransactions, state.book]);
  const bookBudgets = useMemo(
    () => inBook(inPeriod(state.budgets, selected.id), state.book),
    [state.budgets, selected.id, state.book],
  );

  const value = useMemo<FinanceContextValue>(
    () => ({
      ...state,
      now,
      refDate,
      activePeriod: active,
      selectedPeriod: selected,
      isArchive,
      setSelectedPeriod,
      startNewPeriod,
      people,
      bookTransactions,
      bookBudgets,
      setBook,
      permissions,
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
      refDate,
      active,
      selected,
      isArchive,
      setSelectedPeriod,
      startNewPeriod,
      permissions,
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
