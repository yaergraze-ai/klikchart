# Klikchart Commerce 4.7.0 — Marketplace Full-Stack · Vercel Ready

**Satu panduan untuk menjalankan, memperbarui, dan menguji Klikchart.** Proyek ini memakai Express/Node.js, Supabase Auth, PostgreSQL dan Storage, SMTP Email, serta Fonnte untuk OTP WhatsApp. Antarmuka berbeda menurut peran **Pembeli**, **Penjual**, dan **Owner**.

> **Status:** marketplace MVP dengan checkout **Cash on Delivery (COD) internal**. **Belum** terintegrasi payment gateway, perhitungan ongkir kurir real-time, ekspedisi otomatis, escrow, refund atau pencairan dana. Fitur tersebut tidak boleh dipasarkan sebagai aktif sebelum integrasi dan pengujian end-to-end selesai.

## 1. Mulai cepat di Windows

**Persyaratan:** Node.js 20+ (direkomendasikan 22), akun Supabase, dan minimal satu provider OTP aktif (SMTP Email atau Fonnte WhatsApp). Pastikan folder yang dibuka adalah folder berisi `package.json`.

```powershell
Copy-Item .env.example .env
npm.cmd install
npm.cmd run lint
npm.cmd test
npm.cmd run dev
```

Buka `http://localhost:3000/login` untuk registrasi/login dan `http://localhost:3000/dashboard` untuk marketplace. Jalankan database SQL **sebelum** mencoba membuat akun. Jika memakai PowerShell Windows dan `npm.ps1` diblokir, pakai `npm.cmd` seperti di atas. Gunakan `npm.cmd start` untuk menjalankan tanpa mode watch.

## 2. SQL Supabase — pilih SATU jalur

Di dalam `supabase/` hanya ada tiga file SQL yang memang diperlukan:

| Kondisi database | File SQL yang dijalankan | Catatan |
|---|---|---|
| **Proyek Supabase BARU, kosong** | `supabase/FRESH_DATABASE.sql` | Skema lengkap, mencakup skema sampai v4.4; v4.6 tidak mengubah skema. Jalankan **sekali**. |
| **Sudah v4.1** (migration 008 sudah terpasang; belum 009–010) | `supabase/migrations/UPGRADE_V4_1_TO_V4_4.sql` | Upgrade **009 + 010** dalam satu transaksi. Tidak menghapus data. |
| **Sudah v4.2** (009 pernah terpasang, 010 belum) | `supabase/migrations/UPGRADE_V4_1_TO_V4_4.sql` | Mengulang bagian 009 yang idempotent dan melanjutkan 010. Cadangkan data dulu. |
| **Sudah v4.3** (009 dan 010 terpasang) | **Tidak perlu SQL** | Peningkatan v4.6 hanya memperbarui UI dan navigasi, bukan skema. |

**Jangan** menjalankan `FRESH_DATABASE.sql` pada database yang sudah berisi akun/pesanan. **Jangan** menjalankan fresh dan upgrade pada proyek yang sama. SQL dijalankan di **Supabase → SQL Editor → New Query → Run**, setelah menyimpan backup atau menguji lebih dulu pada staging. Jika database masih v4.0 atau lebih lama, migrasikan ke skema v4.1 terlebih dahulu melalui arsip rilis terdahulu; file upgrade tunggal di paket ini **bukan** untuk skema tersebut.

Untuk mengecek struktur setelah menjalankan SQL:

```sql
SELECT
  to_regclass('public.profiles') IS NOT NULL AS auth_profiles,
  to_regclass('public.market_products') IS NOT NULL AS marketplace,
  to_regclass('public.market_user_settings') IS NOT NULL AS account_settings,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'market_products' AND column_name = 'images'
  ) AS product_gallery;
```

Keempat nilai seharusnya `true`. Ini memeriksa keberadaan tabel/kolom saja, **bukan** seluruh fungsi atau keamanan database.

### Menetapkan akun Owner

1. Daftarkan akun melalui **Klikchart** menggunakan email/WhatsApp dan selesaikan OTP. Email pengirim SMTP **bukan** otomatis akun Klikchart.
2. Buka `supabase/OWNER_BOOTSTRAP.sql`, lalu ganti `OWNER_EMAIL_HERE` dengan alamat **akun Klikchart yang sudah terdaftar**.
3. Jalankan SQL menggunakan SQL Editor di **proyek Supabase yang sama** dengan `.env`.
4. Logout, kemudian login ulang. Akses Owner dihitung di backend dari `market_roles`, bukan dari pilihan peran di browser.

Jika muncul `OWNER_ACCOUNT_NOT_FOUND_OR_NOT_VERIFIED`, pastikan akun ada di `auth.users` **dan** `public.profiles`, `signup_verified=true`, serta minimal salah satu `email_verified` / `whatsapp_verified=true`. **Jangan** mengubah bendera verifikasi langsung di SQL untuk melewati OTP.

## 3. Konfigurasi .env

Salin `.env.example` ke `.env`. Isi kredensial **proyek Supabase yang digunakan untuk menjalankan SQL tadi**. Jangan pernah mengunggah `.env` ke GitHub, mengirim Service Role Key, OTP, App Password, atau token ke chat.

```dotenv
NODE_ENV=development
TRUST_PROXY=1
LOGIN_REQUIRE_OTP=true
PORT=3000
APP_URL=http://localhost:3000
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
SESSION_SECRET=RANDOM_32_PLUS_CHARACTER_SECRET
OTP_SECRET=ANOTHER_INDEPENDENT_RANDOM_32_PLUS_SECRET
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=sender@gmail.com
SMTP_PASS=YOUR_GMAIL_APP_PASSWORD
MAIL_FROM="Klikchart <sender@gmail.com>"
FONNTE_TOKEN=
CRON_SECRET=YOUR_RANDOM_CRON_SECRET
```

- Gmail port **587** menggunakan `SMTP_SECURE=false` dengan **STARTTLS**. Alternatif port 465 memakai `SMTP_SECURE=true`. `SMTP_PASS` adalah **Gmail App Password**, bukan sandi Gmail biasa.
- Pengiriman WhatsApp baru tersedia jika `FONNTE_TOKEN` terisi dan device Fonnte benar-benar terhubung.
- Jika hanya satu provider OTP yang dikonfigurasi, provider lain akan tampil sebagai tidak tersedia. OTP login, pendaftaran dan verifikasi kontak menggunakan status yang berbeda sesuai kepemilikan kontak masing-masing.
- Production wajib HTTPS, `APP_URL` harus sesuai origin yang digunakan, dan `SESSION_SECRET`/`OTP_SECRET` minimal 32 karakter acak yang berbeda.
- Jangan putar secret secara sembarangan ketika masih ada sesi atau OTP aktif.

**Uji SMTP tanpa membagikan kredensial:**

```powershell
npm.cmd run smtp:check
npm.cmd run smtp:test
```

Perintah kedua mengirim email uji biasa ke alamat pengirim. Jika respons SMTP berhasil tetapi pesan tidak muncul, periksa Inbox, Spam/Promosi serta reputasi pengirim; respons diterima oleh SMTP bukan jaminan terkirim ke Inbox.

## 4. Alur aplikasi

### Akun dan autentikasi

- Daftar dua langkah; data registrasi sementara disimpan dalam cookie terenkripsi dan akun di Supabase **baru dibuat setelah OTP benar**. Jika pendaftaran dibatalkan/OTP kedaluwarsa, tidak membuat user Auth atau profil aktif.
- Login memakai email/nama pengguna dan kata sandi, lalu OTP Email/WhatsApp sesuai pilihan yang tersedia.
- Status verifikasi Email dan WhatsApp **berbeda**. Jika satu terverifikasi, yang lain dapat diaktifkan dari **Akun & Pengaturan → Keamanan** tanpa halaman terpisah.
- Pemulihan kata sandi dengan OTP; ubah kata sandi dari tab Keamanan dalam Akun & Pengaturan dengan sandi lama, kemudian wajib login ulang.

### Pembeli (etalase `/dashboard`)

- Katalog produk Supabase dengan pencarian, kategori, filter rentang harga, urutkan produk; detail produk, galeri maksimal enam foto, rating dan informasi toko.
- Favorit, keranjang, pengelolaan alamat, checkout COD, riwayat/status pesanan, serta ulasan setelah pesanan diselesaikan.
- Proses checkout menggunakan transaksi SQL dan kunci baris untuk stok; satu keranjang dapat menghasilkan beberapa pesanan per toko dengan ongkir tetap per toko.

### Penjual (setelah persetujuan Owner)

- Pengguna harus memverifikasi Email **dan** WhatsApp lalu mengajukan toko. Owner yang menyetujui; login selanjutnya menampilkan panel Penjual.
- Kelola profil toko, produk, harga, stok, publikasi, unggah foto JPEG/PNG/WebP maksimal **2 MB per foto dan enam foto per produk**.
- Kelola pesanan dan nomor resi/manual, catat penerimaan COD sebagai **laporan penjual**, bukan sebagai konfirmasi pihak pembayaran.

### Owner

- Statistik teragregasi di PostgreSQL dengan cache singkat, daftar akun/toko, persetujuan penjual, moderasi produk, kategori, pesanan.
- Pengaturan nama marketplace, pengumuman, email bantuan, dan ongkir COD untuk **pesanan baru**.
- Role Owner harus ditetapkan lewat SQL Editor tepercaya; **tidak ada endpoint publik promosi Owner**.

### Optimasi v4.4

- Halaman produk tidak lagi memuat katalog lengkap bersamaan dengan detail produk.
- Katalog produk Penjual dan moderasi produk Owner menggunakan **pagination server-side 20 produk/halaman** untuk mengurangi beban ketika jumlah produk berkembang.
- Endpoint API mengirim `Cache-Control: no-store` untuk menghindari cache data akun/pesanan di browser atau perantara.
- URL foto produk yang disimpan divalidasi sebagai HTTPS tanpa kredensial di dalam URL; unggahan lokal diperiksa ukuran dan magic bytes pada backend.

## Deploy cepat Vercel — v4.7.0

Paket ini **belum dideploy** ke akun Vercel mana pun. Vercel harus dihubungkan oleh pemilik akun melalui Dashboard/CLI atau plugin Vercel. Deploy dari folder `klikchart/`, karena `package.json` dan `vercel.json` ada di folder itu. Tidak diperlukan SQL baru dibanding v4.6.

1. **GitHub:** buat repository privat baru untuk Klikchart (jangan gunakan repo tugas kuliah). Push file di folder `klikchart` sebagai root repositori. Pastikan `.env`, `.vercel`, `node_modules` tidak ikut Git (`.gitignore` sudah menyediakannya).
2. **Vercel:** pilih **Add New → Project → Import Git Repository**. Pilih repository Klikchart; bila file berada dalam subfolder, pilih Root Directory = `klikchart`. Framework = **Other** atau gunakan deteksi otomatis; tidak perlu Build Command khusus atau Output Directory.
3. **Environment Variables (Production dan Preview):** set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `OTP_SECRET`, `APP_URL`, `TRUST_PROXY=1`, `LOGIN_REQUIRE_OTP=true`, `CRON_SECRET`, serta SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`) dan/atau `FONNTE_TOKEN`. Semua secret hanya pada environment backend, jangan prefiks `VITE_` atau `NEXT_PUBLIC_`. `NODE_ENV=production` pada runtime Vercel.
4. **APP_URL:** isi `https://nama-proyekmu.vercel.app` (tanpa slash di belakang). Jika memakai domain sendiri, ubah ke domain utama tersebut dan redeploy. Domain acak Preview mendapat izin dari `VERCEL_URL` yang diberikan Vercel sendiri. Pastikan origin halaman benar-benar sama.
5. **Deploy** lalu cek `https://domain-mu/api/runtime`, `/login`, `/register`, `/dashboard`, dan `POST` OTP. Gunakan akun uji yang berizin menerima OTP. Setelah live, lakukan alur signup → OTP → login → OTP → dashboard → logout; kemudian uji Owner dan Penjual.

**Catatan keamanan:** unggah `.env` ke Vercel hanya lewat Environment Variables, tidak ke GitHub. `SESSION_SECRET` dan `OTP_SECRET` harus dua nilai acak berbeda sepanjang minimal 32 karakter, bukan placeholder. Jangan pernah menempelkan token SMTP/Fonnte atau Service Role Key ke chat maupun browser.

**Keterbatasan:** Integrasi COD saat ini masih internal dan belum punya payment gateway atau verifikasi pembayaran pihak ketiga. Vercel Function memiliki batas request body 4.5 MB; aplikasi membatasi satu foto produk hingga 2 MB. Konfigurasi `vercel.json` tetap memakai satu serverless entry `api/index.js` dan cron cleanup harian; ketersediaan cron tergantung paket Vercel.

**Jika error:** `403 FORBIDDEN` untuk POST umumnya APP_URL salah, domain berbeda, atau request header tidak sesuai. `503 SERVER_NOT_CONFIGURED` berarti secret/Supabase belum lengkap. `500` cek Vercel Runtime Logs dan koneksi Supabase. Jika email belum terkirim, jalankan `npm.cmd run smtp:check` di mesin lokal yang memakai `.env` sama.

## 5. Catatan deployment terdahulu

1. Deploy kode ke GitHub tanpa `.env`; impor repositori Vercel dengan root project folder yang berisi `package.json`, `vercel.json` dan `api/index.js`.
2. Tambahkan variabel environment server dari `.env` di Vercel Project Settings; `APP_URL` isi dengan **URL HTTPS produksi yang persis**. `NODE_ENV=production`, `TRUST_PROXY=1` dan `CRON_SECRET` harus diset.
3. Pastikan SQL Supabase sudah terpasang serta kebijakan RLS dan izin service role sesuai.
4. Gunakan domain HTTPS dan penyedia email yang mendukung pengiriman produksi. Uji Fonnte dengan nomor yang berizin menerima pesan.
5. Validasi routing `/login`, `/register`, `/dashboard`, `/api/runtime`, gambar Storage, dan OTP pada Vercel **Preview** sebelum produksi.
6. `vercel.json` menyertakan endpoint cron harian `/api/cron/cleanup`; ketersediaannya bergantung paket/konfigurasi Vercel.

Jangan menganggap deploy sukses hanya karena build berhasil. Verifikasi database dan OTP nyata terlebih dahulu.

## 6. Pengujian dan pemecahan masalah

```powershell
npm.cmd run lint
npm.cmd test
npm.cmd run dev
```

- `GET /api/runtime`: versi aplikasi `4.4.0`.
- `GET /api/config`: saluran OTP yang **terkonfigurasi**, bukan jaminan provider berhasil mengirim.
- Error `409 Conflict` pada registrasi: periksa `error.code` / `error.fields` di respons Network browser; jangan menghapus baris `profiles` atau `auth.users` secara acak.
- Error saat login: pastikan Origin browser sama dengan `APP_URL`, server telah dimulai ulang setelah `.env` berubah, dan migration sesuai versi.
- Owner tidak muncul: periksa email akun yang terverifikasi di SQL bootstrap serta jalankan login ulang.
- Foto produk gagal: cek status Seller, bucket `klikchart-products`, ukuran/mime, dan service role backend.
- Dashboard lambat: periksa waktu respons `/api/market/owner/stats` dan query di Supabase; jangan menarik ribuan baris sekaligus.

**Checklist tes manual minimum (staging):** daftar + OTP Email, daftar + OTP WhatsApp, batal daftar (tidak tersimpan sebagai akun), login ulang, reset/ganti kata sandi, verifikasi kedua kontak, ajukan penjual, terima/tolak sebagai Owner, unggah foto, tambah/edit produk, keranjang, checkout dua toko, pembatalan & pengembalian stok, proses pesanan, review, pagination, batas akses silang peran, pengiriman email/WA nyata, serta uji bersamaan untuk checkout stok terakhir.

`npm test` adalah tes kode/kontrak, **bukan** bukti integrasi Supabase/SMTP/Fonnte atau kesiapan transaksi live. Pengujian integrasi perlu dilakukan di proyek staging dan dicatat sebelum produksi.

## 7. Struktur proyek

```text
klikchart/
├─ README.md                       # satu panduan utama
├─ .env.example                    # template; tidak memuat kredensial
├─ package.json
├─ server.js                       # server lokal
├─ api/index.js                    # entry Vercel
├─ backend/                        # Express, auth, OTP, role, marketplace
├─ public/                         # login dan marketplace responsif
├─ supabase/
│  ├─ FRESH_DATABASE.sql            # SQL lengkap untuk proyek baru
│  ├─ OWNER_BOOTSTRAP.sql           # mengangkat akun terverifikasi jadi owner
│  └─ migrations/
│     └─ UPGRADE_V4_1_TO_V4_4.sql  # upgrade aman: 009 + 010
├─ scripts/check-smtp.mjs
├─ tests/
├─ design/                         # referensi desain, bukan runtime
└─ vercel.json
```

**Batas proyek saat ini:** fitur marketplace MVP nyata, **belum** sistem sekelas Shopee dengan pembayaran otomatis, logistik, sengketa/retur, pencairan dana, audit keamanan, monitoring produksi, kebijakan pajak, dan dukungan operasional 24 jam. Tetap perlakukan COD yang dilaporkan Penjual sebagai informasi internal sampai proses bisnisnya diverifikasi secara independen.

## 9. Tampilan terpadu v4.6 dan alur menu

**Pembeli:** `/dashboard#home` → detail produk → keranjang → alamat pengiriman → checkout COD → pesanan. Header etalase menyediakan pencarian, pesanan, keranjang, dan **Akun**. Pembeli yang ingin berjualan membuka **Buka toko** kemudian mengikuti persetujuan Owner.

**Penjual:** setelah disetujui, login ulang membuka `#sellerHome` → Produk toko → Pesanan masuk → Informasi toko. Tautan **Lihat etalase** membawa penjual ke tampilan pembeli tanpa pindah akun.

**Owner:** login membuka `#ownerHome` → Pesanan → Produk → Toko → Pengajuan penjual → Pengguna → Kategori → Pengaturan web. Sidebar dipersingkat dan kini konsisten dengan panel Penjual.

**Akun & Pengaturan:** satu tautan `#account` menggabungkan Data akun (nama pengguna, bio), Keamanan (ganti sandi, aktivasi kontak dengan OTP jika belum aktif), serta Preferensi (tema dan notifikasi). Halaman Profil / Verifikasi terdahulu **tidak ditampilkan di menu** dan alamat lama `/app` dialihkan ke `#account`. Backend OTP tetap tersedia karena diperlukan untuk login, pemulihan, dan pengajuan toko, bukan dihapus untuk menghemat tampilan.

**Performa:** hash navigation tidak lagi memanggil ulang bootstrap `me`/`site-settings`/`categories` setiap kali menu diganti. Data tiap halaman tetap diminta sesuai kebutuhan dan dilindungi di backend. Tidak ada perubahan SQL dari v4.4 → v4.6. Bila database kamu masih v4.1, gunakan SQL upgrade gabungan yang sama; untuk database baru gunakan `FRESH_DATABASE.sql` yang sama.


## 7. Navigasi akun dan profil v4.6

- Klik **kotak avatar di pojok kanan atas** untuk membuka menu akun yang berisi Profil, Keamanan, Preferensi, Pesanan, dan Keluar. Menu dapat ditutup dengan tombol **Esc**, klik di luar, atau berpindah halaman.
- Halaman **Akun & Pengaturan** memuat identitas pengguna, tanggal bergabung, status verifikasi terpisah untuk Email/WhatsApp, formulir username/nama tampilan/bio/URL avatar HTTPS, penggantian kata sandi, preferensi, dan akses ke alamat maupun riwayat pesanan.
- Foto profil memakai URL gambar HTTPS publik; saat ini **belum** mendukung unggah file foto akun. Setelah disimpan, nama dan avatar diperbarui di header tanpa memuat ulang situs.
- Verifikasi kontak tetap melalui OTP, email dan WhatsApp tidak dapat diganti melalui formulir profil. Perubahan kata sandi meminta sandi saat ini dan menonaktifkan sesi sebelumnya.
- Animasi ringan hanya berupa perubahan opacity/transform, tanpa library tambahan. Perangkat dengan preferensi `prefers-reduced-motion` tidak memutar animasi.
- **Database:** tidak ada migration baru dari v4.5 ke v4.6. Jika masih berada pada v4.1, gunakan hanya `supabase/migrations/UPGRADE_V4_1_TO_V4_4.sql`.

Untuk performa produksi: pastikan SSL/TLS, backup rutin, uji login/OTP pada staging, dan pantau waktu respons endpoint menggunakan Network panel browser. Tidak ada klaim pembayaran online nyata: checkout masih COD internal.


## v4.7 — UI & UX terintegrasi (28 Oktober 2026)

Paket v4.7 berfokus pada penyempurnaan aplikasi yang sudah ada, bukan perubahan database.

- **Akun & Pengaturan:** layout dan tipografi lebih rapi dan responsif; pilihan verifikasi yang belum aktif muncul dalam satu alur Keamanan.
- **Menu avatar:** menampilkan akses cepat Profil, Keamanan, Preferensi, Pesanan, dan Keluar.
- **Tombol kata sandi:** selector label diperbaiki, mendukung tampil/sembunyikan dan label untuk pembaca layar.
- **Dialog:** fokus masuk ke dialog ketika dibuka, terjaga selama interaksi keyboard dan kembali ke elemen asal ketika ditutup.
- **Checkout COD:** menampilkan ringkasan item dan estimasi ongkir sebelum pengguna memberi persetujuan; jumlah resmi tetap dihitung backend dari database.
- **Katalog:** gambar yang gagal diakses menampilkan ilustrasi cadangan.
- **Navigasi:** halaman berbeda tidak mempertahankan scroll lama; animasi ringan dan menghormati `prefers-reduced-motion`.

**Upgrade:** Tidak ada SQL tambahan. Jangan jalankan ulang `FRESH_DATABASE.sql` pada database yang sudah berisi akun. Jika database masih v4.1, jalankan satu kali `supabase/migrations/UPGRADE_V4_1_TO_V4_4.sql`.

**Deployment Vercel:** Push isi folder proyek (harus ada `package.json` dan `vercel.json` di root repository), lalu biarkan GitHub memicu deployment baru. Pastikan `APP_URL` sama dengan domain Production dan variabel rahasia tersedia di Vercel Settings. Jangan commit file `.env`.

**Status rilis:** Penyempurnaan tampilan ini bukan sertifikasi kesiapan untuk transaksi keuangan. Gateway pembayaran online, kurir otomatis, retur/refund, dan rekonsiliasi pembayaran belum disediakan. Uji alur pembeli, penjual, dan Owner di lingkungan staging sebelum membuka transaksi publik.
