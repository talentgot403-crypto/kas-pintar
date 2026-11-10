import { createFileRoute } from "@tanstack/react-router";
import { Check, Database, Minus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ROLE_PERSON } from "@/components/app-shell";
import { PageHeader, Panel } from "@/components/finance-ui";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROLES, type Role, type RoleInfo } from "@/lib/finance";
import { useFinance } from "@/lib/finance-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pengguna")({
  head: () => ({
    meta: [
      { title: "Pengguna & Peran — SIKeu Sistem Informasi Kebendaharaan" },
      { name: "description", content: "Simulasi peran Bendahara Utama, Ketua, dan Anggota beserta hak akses masing-masing." },
      { property: "og:title", content: "Pengguna & Peran — SIKeu" },
      { property: "og:description", content: "Simulasi peran Bendahara, Ketua, dan Anggota beserta hak aksesnya." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PenggunaPage,
});

const PERMS: { key: keyof RoleInfo; label: string }[] = [
  { key: "canCreate", label: "Mencatat transaksi" },
  { key: "canDelete", label: "Menghapus transaksi" },
  { key: "canApprove", label: "Menyetujui / membatalkan transaksi" },
  { key: "canManageBudget", label: "Mengelola anggaran" },
  { key: "canExport", label: "Mencetak & mengekspor laporan" },
];

function PenggunaPage() {
  const { role, setRole, clearAll, loadSample, transactions } = useFinance();
  const roles = Object.keys(ROLES) as Role[];

  return (
    <>
      <PageHeader title="Pengguna & Peran" description="Simulasi peran pengurus. Pilih peran untuk melihat perbedaan hak akses." />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {roles.map((r) => {
          const active = r === role;
          return (
            <button
              key={r}
              onClick={() => {
                setRole(r);
                toast.success(`Masuk sebagai ${ROLES[r].label}`);
              }}
              className={cn(
                "rounded-2xl border bg-card p-5 text-left shadow-card transition-all hover:-translate-y-0.5",
                active && "border-primary ring-2 ring-primary/20",
              )}
            >
              <div className="flex items-center gap-3">
                <Avatar className="size-11">
                  <AvatarFallback className={cn("font-bold", active ? "bg-primary text-primary-foreground" : "bg-secondary")}>
                    {ROLE_PERSON[r].initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-semibold">{ROLE_PERSON[r].name}</p>
                  <p className="text-xs text-muted-foreground">{ROLES[r].label}</p>
                </div>
                {active && <Badge variant="success">Aktif</Badge>}
              </div>
              <p className="mt-4 text-sm text-muted-foreground">{ROLES[r].description}</p>
            </button>
          );
        })}
      </div>

      <Panel title="Matriks Hak Akses" className="mb-6">
        <div className="-mx-5 overflow-x-auto sm:-mx-6">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-3 pl-6 font-medium">Kemampuan</th>
                {roles.map((r) => (
                  <th key={r} className={cn("py-3 text-center font-medium", r === role && "text-primary")}>
                    {ROLES[r].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMS.map((p) => (
                <tr key={p.key} className="border-b last:border-0">
                  <td className="py-3 pl-6">{p.label}</td>
                  {roles.map((r) => (
                    <td key={r} className={cn("py-3 text-center", r === role && "bg-primary-soft/50")}>
                      {ROLES[r][p.key] ? (
                        <Check className="mx-auto size-4 text-success" aria-label="Ya" />
                      ) : (
                        <Minus className="mx-auto size-4 text-muted-foreground/50" aria-label="Tidak" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Data Demo" description="Data tersimpan di peramban ini. Kosongkan untuk melihat tampilan saat belum ada data.">
        <div className="flex flex-wrap items-center gap-3">
          <div className="mr-auto flex items-center gap-2 text-sm text-muted-foreground">
            <Database className="size-4" /> {transactions.length} transaksi tersimpan
          </div>
          <Button
            variant="outline"
            onClick={() => {
              loadSample();
              toast.success("Data contoh dimuat ulang");
            }}
          >
            <RotateCcw /> Muat data contoh
          </Button>
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              clearAll();
              toast.success("Semua data dikosongkan");
            }}
          >
            <Trash2 /> Kosongkan data
          </Button>
        </div>
      </Panel>
    </>
  );
}
