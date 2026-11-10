import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Database, Landmark, PiggyBank, Plus, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";

import { EmptyState, PageHeader, Panel, StatCard, StatusBadge, UsageBar } from "@/components/finance-ui";
import { TransactionDialog } from "@/components/transaction-dialog";
import { Button } from "@/components/ui/button";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  budgetUsage,
  byCategory,
  filterTransactions,
  formatCompact,
  formatDate,
  formatRupiah,
  monthKey,
  monthlySeries,
  summarize,
} from "@/lib/finance";
import { useFinance } from "@/lib/finance-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — SIKeu Sistem Informasi Kebendaharaan" },
      { name: "description", content: "Ringkasan saldo kas, pemasukan, pengeluaran, dan sisa anggaran bulan berjalan." },
      { property: "og:title", content: "Dashboard Kebendaharaan — SIKeu" },
      { property: "og:description", content: "Ringkasan saldo kas, pemasukan, pengeluaran, dan sisa anggaran bulan berjalan." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const chartConfig = {
  masuk: { label: "Pemasukan", color: "var(--chart-1)" },
  keluar: { label: "Pengeluaran", color: "var(--chart-2)" },
} satisfies ChartConfig;

const PIE_COLORS = ["var(--chart-2)", "var(--chart-1)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function Dashboard() {
  const { transactions, budgets, now, permissions, loadSample } = useFinance();
  const [open, setOpen] = useState(false);

  const s = useMemo(() => summarize(transactions, budgets, now), [transactions, budgets, now]);
  const series = useMemo(() => monthlySeries(transactions, now, 6), [transactions, now]);
  const recent = useMemo(() => filterTransactions(transactions, {}).slice(0, 6), [transactions]);
  const usage = useMemo(() => budgetUsage(budgets, transactions, now), [budgets, transactions, now]);
  const composition = useMemo(
    () => byCategory(transactions.filter((t) => monthKey(t.date) === monthKey(now)), "keluar"),
    [transactions, now],
  );
  const empty = transactions.length === 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Ringkasan kondisi keuangan organisasi secara real-time."
        actions={
          permissions.canCreate && (
            <Button onClick={() => setOpen(true)}>
              <Plus /> Tambah Transaksi
            </Button>
          )
        }
      />

      <div className="relative mb-6 overflow-hidden rounded-2xl bg-hero p-6 text-primary-foreground shadow-elevated sm:p-8">
        <div className="absolute -right-16 -top-16 size-64 rounded-full bg-primary-foreground/10" />
        <div className="absolute -bottom-24 right-24 size-48 rounded-full bg-primary-foreground/5" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-primary-foreground/80">
              <Landmark className="size-4" /> Total Saldo Kas
            </div>
            <p className="num mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">{formatRupiah(s.balance)}</p>
            <p className="mt-2 text-sm text-primary-foreground/75">
              Akumulasi seluruh transaksi yang tidak dibatalkan.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:w-80">
            <div className="rounded-xl bg-primary-foreground/10 p-3 backdrop-blur">
              <p className="text-xs text-primary-foreground/70">Arus bersih bulan ini</p>
              <p className="num mt-1 font-bold">{formatCompact(s.incomeMonth - s.expenseMonth)}</p>
            </div>
            <div className="rounded-xl bg-primary-foreground/10 p-3 backdrop-blur">
              <p className="text-xs text-primary-foreground/70">Jumlah transaksi</p>
              <p className="num mt-1 font-bold">{transactions.length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Saldo" value={formatRupiah(s.balance)} icon={Wallet} tone="primary" hint="Saldo kas saat ini" />
        <StatCard
          label="Pemasukan Bulan Ini"
          value={formatRupiah(s.incomeMonth)}
          icon={ArrowDownLeft}
          tone="success"
          hint="Iuran, donasi, sponsor"
        />
        <StatCard
          label="Pengeluaran Bulan Ini"
          value={formatRupiah(s.expenseMonth)}
          icon={ArrowUpRight}
          tone="danger"
          hint="Seluruh pos pengeluaran"
        />
        <StatCard
          label="Sisa Anggaran"
          value={formatRupiah(s.budgetRemaining)}
          icon={PiggyBank}
          tone={s.budgetRemaining < 0 ? "danger" : "warning"}
          hint={s.budgetAllocation ? `dari ${formatRupiah(s.budgetAllocation)} alokasi` : "Belum ada alokasi"}
        />
      </div>

      {empty ? (
        <Panel>
          <EmptyState
            icon={Database}
            title="Belum ada data keuangan"
            description="Mulai dengan mencatat transaksi pertama, atau muat data contoh untuk melihat bagaimana dashboard bekerja."
            action={
              <>
                {permissions.canCreate && (
                  <Button onClick={() => setOpen(true)}>
                    <Plus /> Catat Transaksi
                  </Button>
                )}
                <Button variant="outline" onClick={loadSample}>
                  Muat data contoh
                </Button>
              </>
            }
          />
        </Panel>
      ) : (
        <>
          <div className="mb-6 grid gap-6 xl:grid-cols-3">
            <Panel title="Arus Kas Bulanan" description="Pemasukan vs pengeluaran 6 bulan terakhir" className="xl:col-span-2">
              <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
                <BarChart data={series} barGap={4}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} className="capitalize" />
                  <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v) => formatCompact(Number(v))} />
                  <ChartTooltip
                    cursor={{ radius: 8 }}
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => (
                          <div className="flex w-full items-center justify-between gap-4">
                            <span className="text-muted-foreground">{chartConfig[name as keyof typeof chartConfig]?.label}</span>
                            <span className="num font-semibold">{formatRupiah(Number(value))}</span>
                          </div>
                        )}
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="masuk" fill="var(--color-masuk)" radius={[6, 6, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="keluar" fill="var(--color-keluar)" radius={[6, 6, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ChartContainer>
            </Panel>

            <Panel
              title="Transaksi Terbaru"
              action={
                <Button asChild variant="ghost" size="sm">
                  <Link to="/transaksi">
                    Semua <ArrowRight />
                  </Link>
                </Button>
              }
            >
              <ul className="divide-y">
                {recent.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg",
                        t.type === "masuk" ? "bg-success-soft text-success" : "bg-primary-soft text-primary",
                      )}
                    >
                      {t.type === "masuk" ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(t.date)} · {t.category}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={cn("num text-sm font-semibold", t.type === "masuk" ? "text-success" : "text-foreground")}>
                        {t.type === "masuk" ? "+" : "−"}
                        {formatCompact(t.amount)}
                      </p>
                      {t.status !== "selesai" && (
                        <div className="mt-0.5">
                          <StatusBadge status={t.status} />
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <div className="grid gap-6 lg:grid-cols-5">
            <Panel
              title="Penggunaan Anggaran"
              description="Bulan berjalan"
              className="lg:col-span-3"
              action={
                <Button asChild variant="ghost" size="sm">
                  <Link to="/anggaran">
                    Kelola <ArrowRight />
                  </Link>
                </Button>
              }
            >
              {usage.length === 0 ? (
                <EmptyState compact icon={PiggyBank} title="Belum ada anggaran" description="Tetapkan alokasi per pos untuk memantau penggunaan dana." />
              ) : (
                <div className="grid gap-5">
                  {usage.map((b) => (
                    <div key={b.id}>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium">{b.category}</span>
                        <span className="num text-muted-foreground">
                          {formatCompact(b.used)} / {formatCompact(b.allocation)} ·{" "}
                          <span className="font-semibold text-foreground">{b.percent}%</span>
                        </span>
                      </div>
                      <UsageBar percent={b.percent} />
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Komposisi Pengeluaran" description="Bulan berjalan per kategori" className="lg:col-span-2">
              {composition.length === 0 ? (
                <EmptyState compact icon={ArrowUpRight} title="Belum ada pengeluaran" description="Pengeluaran bulan ini akan tampil di sini." />
              ) : (
                <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col xl:flex-row">
                  <ChartContainer config={{}} className="aspect-square h-44 shrink-0">
                    <PieChart>
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            hideLabel
                            formatter={(value, name) => (
                              <div className="flex w-full justify-between gap-4">
                                <span>{name}</span>
                                <span className="num font-semibold">{formatRupiah(Number(value))}</span>
                              </div>
                            )}
                          />
                        }
                      />
                      <Pie data={composition} dataKey="amount" nameKey="category" innerRadius={48} outerRadius={78} paddingAngle={3} strokeWidth={0}>
                        {composition.map((c, i) => (
                          <Cell key={c.category} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  <ul className="grid w-full gap-2.5">
                    {composition.map((c, i) => (
                      <li key={c.category} className="flex items-center gap-2 text-sm">
                        <span className="size-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="flex-1 text-muted-foreground">{c.category}</span>
                        <span className="num font-semibold">{formatCompact(c.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Panel>
          </div>
        </>
      )}

      <TransactionDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
