# Klikchart Commerce 6.0

Rebuild dari yaergraze-ai/klikchart: etalase e-commerce, akun pembeli, panel penjual, dan panel owner. Tampilan responsif memakai ikon SVG, tema terang/gelap, dan satu sistem desain.

## Coba langsung

Persyaratan: Node.js 22 atau lebih baru. Internet diperlukan saat menginstal paket pertama kali.

Di Windows, ekstrak seluruh ZIP lalu klik **START-DEMO.cmd**. Atau buka terminal pada folder yang berisi package.json:

```powershell
npm.cmd ci
npm.cmd run demo
```

Buka **http://127.0.0.1:3100**. Klik Masuk untuk memilih Pembeli, Penjual, atau Owner. Pada macOS/Linux gunakan npm sebagai pengganti npm.cmd.

**Demo adalah simulasi lokal.** Data tersimpan di memori selama server berjalan dan kembali ke awal saat server dimulai ulang. Tidak mengirim OTP, menarik uang, menghubungi kurir, atau menulis ke Supabase. Server demo hanya mendengarkan 127.0.0.1 dan tidak boleh dipakai sebagai server produksi.

Contoh: Pembeli → tambah Wireless Headphone Studio → Keranjang → checkout COD → pilih Penjual → Pesanan masuk → Terima → Sudah dikemas → Kirim barang dan isi resi → kembali ke Pembeli → Pesanan saya → Perbarui → Sudah diterima → beri ulasan.

## Fitur

- Etalase publik, pencarian, kategori, filter harga, pengurutan, dan pagination.
- Detail produk, galeri, toko, stok, favorit, serta ulasan pembelian selesai.
- Keranjang dengan kuantitas dan total, alamat, checkout COD, pesanan per toko, pembatalan sesuai status, serta detail penerima dan resi.
- Profil, preferensi, tema; autentikasi OTP dan kata sandi pada mode produksi.
- Penjual: produk, unggah foto, stok, publikasi, toko, pesanan, dan pencatatan COD.
- Owner: statistik, pengguna, toko, kategori, moderasi, persetujuan penjual, pengaturan marketplace.
- Bantuan, navigasi mobile, fokus keyboard, dialog dengan Escape, dan label formulir.

## Mode produksi

Backend asli menggunakan Express, Supabase Auth/PostgreSQL/Storage, SMTP, dan Fonnte. Tidak ada kredensial nyata dalam paket. Registrasi, login, OTP, dan perubahan kata sandi memerlukan layanan tersebut.

1. Siapkan Supabase dan pilih jalur SQL di bawah.
2. Salin .env.example menjadi .env dan isi kredensial secara lokal.
3. Jalankan:

```powershell
Copy-Item .env.example .env
npm.cmd ci
npm.cmd run dev
```

Gunakan npm.cmd start untuk menjalankan tanpa watch. Buka **http://localhost:3000**. Root menampilkan etalase; /login, /register, /forgot-password memakai akun nyata. /dashboard membuka etalase atau panel sesuai peran. Server produksi tidak menyediakan pemilihan peran demo.

### SQL

| Kondisi database | File |
| --- | --- |
| Baru dan kosong | supabase/FRESH_DATABASE.sql |
| Versi 4.1/4.2 belum lengkap pembaruan 009–010 | supabase/migrations/UPGRADE_V4_1_TO_V4_4.sql |
| Versi 4.4–5.0 lengkap | Tidak perlu migrasi untuk v6.0 |
| Menetapkan owner setelah registrasi dan verifikasi | supabase/OWNER_BOOTSTRAP.sql |

Jangan menjalankan SQL fresh pada database berisi data. Cadangkan dan uji di staging sebelum upgrade. Ganti OWNER_EMAIL_HERE dengan akun Klikchart yang sudah terverifikasi; email SMTP tidak otomatis menjadi owner. Panduan database versi lebih lama dan konfigurasi lanjutan ada di docs/LEGACY-v5.md.

### Konfigurasi environment

- SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: proyek tempat menjalankan SQL.
- SESSION_SECRET dan OTP_SECRET: dua secret acak berbeda, masing-masing minimal 32 karakter.
- APP_URL: origin aplikasi; lokal http://localhost:3000, produksi harus HTTPS.
- SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM: pengiriman OTP email.
- FONNTE_TOKEN: pengiriman OTP WhatsApp.
- CRON_SECRET: secret cleanup; PORT: default 3000.

SMTP STARTTLS memakai port 587 dan SMTP_SECURE=false; TLS langsung memakai port 465 dan SMTP_SECURE=true. Gmail memerlukan App Password. Pengajuan penjual memerlukan verifikasi email dan WhatsApp.

Uji koneksi: npm.cmd run smtp:check. Pengiriman email uji secara eksplisit: npm.cmd run smtp:test. Jangan commit .env atau menaruh service-role key di frontend.

## Deployment

Vercel: gunakan folder ini sebagai root project, framework Other, dan environment produksi. vercel.json serta api/index.js disertakan. Tidak perlu build frontend. Root diarahkan ke dashboard.html; autentikasi memakai index.html.

Hosting Node biasa: npm ci --omit=dev lalu npm start, di belakang HTTPS. Gunakan NODE_ENV=production, APP_URL yang benar, database, dan provider OTP aktif. Rebuild ini belum dideploy. Uji alur akun dan transaksi pada staging sebelum menerima pesanan nyata.

## Batas fitur

- Pembayaran hanya **COD**; belum ada payment gateway, QRIS, kartu, escrow, refund otomatis, atau pencairan dana.
- Ongkir tetap per toko. Tidak ada tarif kurir atau tracking otomatis; resi diisi manual oleh penjual.
- Penerimaan COD merupakan catatan penjual, bukan verifikasi pembayaran pihak ketiga.
- Preferensi notifikasi tersimpan; notifikasi transaksi otomatis memerlukan integrasi tambahan.
- Demo tidak menjalankan OTP atau perubahan kata sandi. Gunakan mode produksi yang dikonfigurasi untuk fitur tersebut.
- Foto demo adalah ilustrasi, bukan penawaran barang nyata. Ganti dengan foto produk asli. Sumber di docs/ASSETS.md.

## Pengujian

```powershell
npm.cmd run check
npm.cmd test
npx.cmd playwright install chromium
npm.cmd run test:e2e
```

Tes browser membuat server demo terisolasi dan menghentikannya setelah selesai. Hasil dan screenshot ada di qa-previews; ZIP rilis menyertakan salinannya di preview. Lihat docs/VERIFICATION.md untuk cakupan serta batas pengujian.

## Isi paket

backend dan api: server produksi; public: frontend dan aset; demo: simulasi lokal; supabase: SQL; tests: tes regresi dan HTTP; scripts: pemeriksaan dan SMTP; docs: panduan; START-DEMO.cmd: peluncur Windows; .env.example: template kosong; package-lock.json: dependensi terkunci.

node_modules dan browser Chromium tidak dimasukkan; instal menggunakan perintah di atas. Stylesheet versi lama disimpan sebagai referensi. Dashboard hanya memuat commerce.css; autentikasi memuat auth.css yang memakai token commerce.css.
