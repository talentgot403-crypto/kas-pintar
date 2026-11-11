# Kas Pintar

Buatkan aplikasi web "Sistem Informasi Kebendaharaan" (Treasury Management System) yang modern, bersih, dan responsif menggunakan React, Tailwind CSS, dan Lucide Icons.

Fitur utama aplikasi ini meliputi:

1. **Dashboard Utama:** 

   - Menampilkan ringkasan keuangan (Total Saldo, Pemasukan Bulan Ini, Pengeluaran Bulan Ini, dan Sisa Anggaran).

   - Grafik ringkasan keuangan bulanan (menggunakan komponen chart/recharts sederhana).

2. **Pencatatan Transaksi (Pemasukan & Pengeluaran):**

   - Tabel daftar transaksi dengan kolom: Tanggal, Keterangan, Kategori (misal: Iuran, Donasi, Operasional, Konsumsi), Jenis (Masuk/Keluar), Jumlah (Rupiah), dan Status.

   - Tombol "Tambah Transaksi" dengan modal form yang interaktif.

   - Filter transaksi berdasarkan rentang tanggal, jenis, dan kategori.

3. **Manajemen Anggaran (Budgeting):**

   - Daftar alokasi anggaran per pos/kategori beserta progress bar penggunaan dana (persentase terpakai).

4. **Laporan & Ekspor:**

   - Halaman laporan keuangan ringkas dengan opsi cetak/unduh (mockup tombol PDF/Excel).

5. **Manajemen Pengguna / Peran (Opsional/Simulasi):**

   - Indikator profil pengguna (Bendahara Utama, Ketua, Anggota/Viewer).

Desain harus menggunakan gaya dashboard profesional (warna dominan biru/hijau korporat, bersih, rapi, dan mobile-friendly). Sediakan juga status kosong (empty state) yang bagus jika data masih kosong.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/52b6ca4a-8adc-4493-bac4-c388f406aa77).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
