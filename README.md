# Generator Dokumen Lembur Pusdatin PKP — GitHub Pages MVP

Static web MVP untuk **Generator Dokumen Lembur** Pusat Data dan Informasi, Kementerian Perumahan dan Kawasan Permukiman. Seluruh parsing file presensi dan pembuatan Excel dilakukan di browser; tidak ada backend pada paket ini.

## Fitur yang sudah tersedia

- Flow: Login → Dashboard → Pilih Periode → Upload → Validasi → Processing → Review → Konfirmasi → Hasil → Riwayat.
- Multiple upload `.xlsx` / `.xls` dengan drag-and-drop.
- Parsing identitas pegawai dari sel A2, NIP sebagai key utama dan nama sebagai fallback.
- Deteksi header `Tanggal`, `Masuk`, `Keluar`, dan status/keterangan.
- Pemrosesan sesuai periode bulan/tahun yang dipilih.
- Aturan lembur hari kerja/weekend mengikuti source existing yang dimigrasikan ke `business-rules.js`.
- Review dan koreksi jam lembur final `0 / 1 / 2 / 3 / 4 jam`.
- Side drawer detail pegawai.
- Generate tiga file Excel:
  - `Rekapitulasi Lembur - [Bulan Tahun].xlsx`
  - `Daftar Hadir Kerja Lembur - [Bulan Tahun].xlsx`
  - `SPKL [Bulan Tahun].xlsx` dengan sheet hari kerja dan `WEEKEND`.
- Riwayat proses disimpan pada `localStorage` browser dan dapat digunakan untuk generate ulang hasil.

## Struktur

```text
.
├── index.html
├── 404.html
├── .nojekyll
├── assets/
│   ├── css/styles.css
│   ├── img/mark.svg
│   └── js/
│       ├── config.js
│       ├── satker-master.js
│       ├── business-rules.js
│       ├── excel-parser.js
│       ├── document-generator.js
│       ├── storage.js
│       └── app.js
├── backend/README.md
├── docs/SOURCE_MAPPING.md
└── README.md
```

## Menjalankan lokal

Karena aplikasi menggunakan file JavaScript terpisah, jalankan melalui HTTP server sederhana:

```bash
python -m http.server 8080
```

Buka `http://localhost:8080`.

## Deploy ke GitHub Pages

1. Buat repository baru dan salin seluruh isi folder ini ke root repository.
2. Push ke branch `main`.
3. Buka **Settings → Pages**.
4. Pada **Build and deployment**, pilih **Deploy from a branch**.
5. Pilih branch `main` dan folder `/ (root)`.
6. Simpan. Situs akan tersedia pada alamat `https://<username>.github.io/<repository>/`.

Paket memakai path relatif sehingga dapat ditempatkan pada project GitHub Pages maupun user/organization Pages.

## Login Google Workspace

Default paket berjalan dalam **mode demo** karena GitHub Pages tidak menyediakan backend untuk memverifikasi token/otorisasi secara aman.

Untuk menampilkan Google Identity Services, isi `GOOGLE_CLIENT_ID` pada `assets/js/config.js` dan daftarkan origin GitHub Pages pada OAuth Client ID. Implementasi produksi sebaiknya memverifikasi ID token di backend/serverless dan menerapkan allowlist/domain authorization di sisi server. Pemeriksaan `hd` di browser saja bukan kontrol akses yang cukup.

## Privasi dan GitHub Pages

GitHub Pages pada umumnya mengirim seluruh HTML/JavaScript ke browser pengguna. Karena itu **jangan menaruh master NIP/nama pegawai dalam bentuk plaintext pada repository publik**.

Pada paket ini, master kode satker existing sudah dikonversi menjadi hash SHA-256 (`satker-master.js`), sehingga NIP dan nama master tidak dikirim sebagai plaintext. NIP yang berasal dari file presensi tetap diproses di memori browser karena dibutuhkan untuk output dokumen.

Data penanggung jawab pada `config.js` tetap menjadi bagian dari source statis karena digunakan pada dokumen hasil. Jika repository/situs akan dibuka ke publik, tinjau kembali apakah data tersebut boleh dipublikasikan.

## Item yang masih perlu dikonfirmasi

Terdapat inkonsistensi pada source existing untuk **batas jam datang terakhir agar berhak lembur**:

- konfigurasi `Database.gs`: `09:00`;
- komentar implementasi pada `Main.gs`: menyebut `09:31` masih diperbolehkan dan `09:32` tidak.

MVP ini menggunakan **nilai executable config 09:00**, tetapi menampilkan banner peringatan pada halaman Validasi. Jangan mengubah nilai tersebut tanpa konfirmasi pemilik proses bisnis.

## Batasan MVP statis

- Tidak ada database/server-side persistence; riwayat hanya tersimpan pada browser/perangkat yang sama.
- File upload tidak dikirim atau disimpan ke server aplikasi.
- Library SheetJS, ExcelJS, dan FileSaver dimuat dari jsDelivr, sehingga browser memerlukan akses internet. Untuk lingkungan intranet/offline, vendor library tersebut perlu disimpan lokal.
- Format workbook sudah direplikasi dari struktur source existing, tetapi tetap perlu **UAT visual** terhadap file output resmi existing sebelum dipakai sebagai pengganti produksi, khususnya aspek print area, pagination, ukuran kolom/baris, dan kompatibilitas lintas versi Excel.

## Source of truth

Untuk migrasi lanjutan, pertahankan pemisahan berikut:

- `excel-parser.js` — pembacaan dan normalisasi file presensi;
- `business-rules.js` — aturan lembur dan agregasi;
- `document-generator.js` — layout/output Excel;
- `app.js` — flow dan UI;
- `config.js` — identitas organisasi dan parameter.

Jika `Main.gs` atau `Database.gs` berubah, sinkronkan perubahan terlebih dahulu ke layer terkait, bukan langsung ke UI.
