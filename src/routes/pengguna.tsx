import { createFileRoute } from "@tanstack/react-router";
import { Check, Database, Lock, Minus, Pencil, Plus, RotateCcw, Save, Scale, Trash2, UserRoundPlus, Users } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { EmptyState, PageHeader, Panel } from "@/components/finance-ui";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ACCESS_LABEL,
  boardPeriods,
  formatRupiah,
  initialsOf,
  membersOf,
  ROLES,
  validateMember,
  type Member,
  type Role,
  type RoleInfo,
} from "@/lib/finance";
import { useFinance } from "@/lib/finance-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pengguna")({
  head: () => ({
    meta: [
      { title: "Pengguna & Peran — SIKeu Sistem Informasi Kebendaharaan" },
      { name: "description", content: "Daftar pengurus OSIS periode ini dan penerusnya, diisi sendiri oleh Bendahara, beserta hak akses tiap peran." },
      { property: "og:title", content: "Pengguna & Peran — SIKeu" },
      { property: "og:description", content: "Daftar pengurus OSIS dan penerusnya beserta hak akses tiap peran." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PenggunaPage,
});

const PERMS: { key: keyof RoleInfo; label: string }[] = [
  { key: "canCreate", label: "Mencatat transaksi" },
  { key: "canEdit", label: "Mengubah transaksi" },
  { key: "canDelete", label: "Menghapus transaksi" },
  { key: "canApprove", label: "Menyetujui / membatalkan transaksi" },
  { key: "canConfigure", label: "Mengatur batas pengeluaran besar" },
  { key: "canManageBudget", label: "Mengelola anggaran" },
  { key: "canExport", label: "Mencetak & mengekspor laporan" },
];

function PenggunaPage() {
  const { clearAll, loadSample, transactions, role } = useFinance();
  const roles = Object.keys(ROLES) as Role[];

  return (
    <>
      <PageHeader
        title="Pengguna & Peran"
        description="Isi sendiri daftar pengurus periode ini dan calon penerusnya, lalu lihat hak akses tiap peran."
      />

      <MemberSection />

      <Panel
        title="Matriks Hak Akses"
        description="Ganti peran simulasi lewat tombol profil di kanan atas."
        className="mb-6"
      >
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

      <ThresholdPanel />

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
              toast.success("Saldo direset ke Rp 0", { description: "Semua transaksi, anggaran, dan daftar pengurus dihapus." });
            }}
          >
            <Trash2 /> Reset ke Rp 0
          </Button>
        </div>
      </Panel>
    </>
  );
}

const JABATAN_SUGGESTIONS = [
  "Ketua OSIS",
  "Wakil Ketua OSIS",
  "Sekretaris OSIS",
  "Bendahara Umum",
  "Wakil Bendahara",
  "Koordinator Bidang",
  "Pembina OSIS",
];

const ROLE_DEFAULT_JABATAN: Partial<Record<Role, string>> = {
  bendahara: "Bendahara Umum",
  pembina: "Pembina OSIS",
};

type Slot = "current" | "successor";

function MemberSection() {
  const { members, now, permissions, addMember, updateMember, deleteMember, restoreMember } = useFinance();
  const { current, successor } = boardPeriods(now);
  const canManage = permissions.canManageUsers;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [jabatan, setJabatan] = useState("");
  const [role, setRole] = useState<Role>("anggota");
  const [slot, setSlot] = useState<Slot>("current");
  const [error, setError] = useState("");

  const periodFor = (s: Slot) => (s === "current" ? current : successor);
  const others = members.filter((m) => m.periodId !== current.id && m.periodId !== successor.id);

  function reset(keepSlot = true) {
    setEditingId(null);
    setName("");
    setJabatan("");
    setRole("anggota");
    if (!keepSlot) setSlot("current");
    setError("");
  }

  function startEdit(m: Member) {
    setEditingId(m.id);
    setName(m.name);
    setJabatan(m.jabatan);
    setRole(m.role);
    setSlot(m.periodId === successor.id ? "successor" : "current");
    setError("");
    document.getElementById("member-name")?.focus();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const input = { name, jabatan, role, periodId: periodFor(slot).id };
    const problem = validateMember(input, members, editingId ?? undefined);
    if (problem) {
      setError(problem);
      return;
    }
    const where = slot === "current" ? `pengurus ${current.label}` : `penerus ${successor.label}`;
    if (editingId) {
      updateMember(editingId, input);
      toast.success("Data pengurus diperbarui", { description: `${input.name.trim()} — ${where}` });
    } else {
      addMember(input);
      toast.success(slot === "current" ? "Pengurus ditambahkan" : "Penerus ditambahkan", {
        description: `${input.name.trim()} — ${where}`,
      });
    }
    reset();
  }

  function remove(m: Member) {
    const removed = deleteMember(m.id);
    if (editingId === m.id) reset();
    if (removed)
      toast(`${removed.name} dihapus dari daftar`, {
        action: { label: "Urungkan", onClick: () => restoreMember(removed) },
      });
  }

  return (
    <div className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <Panel
        title={editingId ? "Ubah Data Pengurus" : "Tambah Pengurus"}
        description={
          canManage
            ? "Masukkan nama pengurus periode ini atau calon penerus untuk periode berikutnya."
            : "Hanya Bendahara Utama yang dapat mengisi daftar pengurus."
        }
        className="xl:self-start"
      >
        {canManage ? (
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <div className="flex flex-col gap-1.5">
              <Label>Untuk periode</Label>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Untuk periode">
                {(["current", "successor"] as Slot[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={slot === s}
                    onClick={() => setSlot(s)}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-left transition-colors",
                      slot === s ? "border-primary bg-primary-soft text-primary" : "hover:bg-muted",
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                      {s === "current" ? <Users className="size-4" /> : <UserRoundPlus className="size-4" />}
                      {s === "current" ? "Pengurus aktif" : "Penerus"}
                    </span>
                    <span className="num mt-0.5 block text-xs text-muted-foreground">{periodFor(s).label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="member-name">Nama lengkap</Label>
              <Input
                id="member-name"
                placeholder="Contoh: Nama Siswa"
                value={name}
                maxLength={60}
                onChange={(e) => {
                  setName(e.target.value);
                  setError("");
                }}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="member-role">Peran di aplikasi</Label>
              <Select
                value={role}
                onValueChange={(v) => {
                  const r = v as Role;
                  setRole(r);
                  if (!jabatan.trim() && ROLE_DEFAULT_JABATAN[r]) setJabatan(ROLE_DEFAULT_JABATAN[r]!);
                  setError("");
                }}
              >
                <SelectTrigger id="member-role" aria-label="Peran di aplikasi">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLES) as Role[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLES[r].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="member-jabatan">Jabatan</Label>
              <Input
                id="member-jabatan"
                list="jabatan-options"
                placeholder="Contoh: Ketua OSIS"
                value={jabatan}
                maxLength={60}
                onChange={(e) => {
                  setJabatan(e.target.value);
                  setError("");
                }}
              />
              <datalist id="jabatan-options">
                {JABATAN_SUGGESTIONS.map((j) => (
                  <option key={j} value={j} />
                ))}
              </datalist>
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                {editingId ? <Save /> : <Plus />} {editingId ? "Simpan Perubahan" : "Tambah ke Daftar"}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={() => reset()}>
                  Batal
                </Button>
              )}
            </div>
          </form>
        ) : (
          <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">
            <Lock className="size-4 shrink-0" />
            Masuk sebagai Bendahara Utama lewat tombol profil di kanan atas untuk menambah atau mengubah pengurus.
          </div>
        )}
      </Panel>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <MemberList
          title={`Pengurus Periode ${current.label}`}
          description="Pengurus yang sedang menjabat."
          emptyTitle="Belum ada pengurus"
          emptyText="Tambahkan nama Bendahara, Pembina, dan pengurus lain lewat form di samping."
          items={membersOf(members, current.id)}
          canManage={canManage}
          editingId={editingId}
          onEdit={startEdit}
          onDelete={remove}
        />
        <MemberList
          title={`Penerus Periode ${successor.label}`}
          description="Calon pengurus yang akan menerima serah terima."
          emptyTitle="Belum ada penerus"
          emptyText="Pilih “Penerus” di form untuk mencatat calon pengurus periode berikutnya."
          items={membersOf(members, successor.id)}
          canManage={canManage}
          editingId={editingId}
          onEdit={startEdit}
          onDelete={remove}
          successor
        />
        {others.length > 0 && (
          <MemberList
            title="Pengurus Periode Lain"
            description="Pengurus dari periode sebelumnya."
            emptyTitle=""
            emptyText=""
            items={[...others].sort((a, b) => b.periodId.localeCompare(a.periodId))}
            canManage={canManage}
            editingId={editingId}
            onDelete={remove}
            showPeriod
          />
        )}
      </div>
    </div>
  );
}

function MemberList({
  title,
  description,
  emptyTitle,
  emptyText,
  items,
  canManage,
  editingId,
  onEdit,
  onDelete,
  successor,
  showPeriod,
}: {
  title: string;
  description: string;
  emptyTitle: string;
  emptyText: string;
  items: Member[];
  canManage: boolean;
  editingId: string | null;
  onEdit?: (m: Member) => void;
  onDelete: (m: Member) => void;
  successor?: boolean;
  showPeriod?: boolean;
}) {
  return (
    <Panel
      title={title}
      description={description}
      action={<Badge variant={items.length ? "info" : "muted"}>{items.length} orang</Badge>}
    >
      {items.length === 0 ? (
        <EmptyState compact icon={successor ? UserRoundPlus : Users} title={emptyTitle} description={emptyText} />
      ) : (
        <ul className="-my-2 divide-y">
          {items.map((m) => {
            const person = { initials: initialsOf(m.name) || "?" };
            return (
              <li
                key={m.id}
                className={cn("flex items-center gap-3 py-3", editingId === m.id && "-mx-2 rounded-xl bg-primary-soft/60 px-2")}
              >
                <Avatar className="size-10">
                  <AvatarFallback className="bg-secondary text-xs font-bold">{person.initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{m.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.jabatan}
                    {showPeriod && ` · ${m.periodId.replace("-", "/")}`}
                  </p>
                </div>
                <Badge variant={m.access === "dicabut" ? "muted" : m.role === "bendahara" ? "success" : "info"} className="hidden sm:inline-flex">
                  {m.access === "aktif" ? ROLES[m.role].short : ACCESS_LABEL[m.access]}
                </Badge>
                {canManage && (
                  <div className="flex shrink-0">
                    {onEdit && (
                      <Button size="icon" variant="ghost" aria-label={`Ubah ${m.name}`} onClick={() => onEdit(m)}>
                        <Pencil />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      aria-label={`Hapus ${m.name}`}
                      onClick={() => onDelete(m)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function ThresholdPanel() {
  const { largeExpenseThreshold, setThreshold, permissions } = useFinance();
  const [value, setValue] = useState(String(largeExpenseThreshold));
  const [error, setError] = useState("");
  useEffect(() => setValue(String(largeExpenseThreshold)), [largeExpenseThreshold]);
  const numeric = Number(value.replace(/\D/g, ""));

  function save(e: FormEvent) {
    e.preventDefault();
    if (!numeric || numeric < 1000) {
      setError("Batas minimal Rp 1.000");
      return;
    }
    setError("");
    setThreshold(numeric);
    toast.success("Batas persetujuan diperbarui", {
      description: `Pengeluaran mulai ${formatRupiah(numeric)} perlu persetujuan Pembina.`,
    });
  }

  return (
    <Panel
      title="Batas Pengeluaran Besar"
      description="Pengeluaran sebesar atau di atas batas ini disimpan berstatus Menunggu sampai disetujui Pembina OSIS."
      className="mb-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex items-center gap-3 sm:mr-auto">
          <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary">
            <Scale className="size-5" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Batas saat ini</p>
            <p className="num text-lg font-bold">{formatRupiah(largeExpenseThreshold)}</p>
          </div>
        </div>
        {permissions.canConfigure ? (
          <form onSubmit={save} className="flex flex-col gap-1.5 sm:w-80" noValidate>
            <Label htmlFor="threshold">Ubah batas</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                  Rp
                </span>
                <Input
                  id="threshold"
                  inputMode="numeric"
                  className="num pl-10"
                  value={numeric ? numeric.toLocaleString("id-ID") : ""}
                  onChange={(e) => setValue(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={numeric === largeExpenseThreshold}>
                Simpan
              </Button>
            </div>
            {error ? (
              <p className="text-xs text-destructive">{error}</p>
            ) : (
              <p className="text-xs text-muted-foreground">Berlaku untuk transaksi baru dan yang diubah.</p>
            )}
          </form>
        ) : (
          <p className="text-xs text-muted-foreground sm:max-w-xs sm:text-right">Hanya Pembina OSIS yang dapat mengubah batas ini.</p>
        )}
      </div>
    </Panel>
  );
}
