# Pemeriksaan Klikchart 6.0

Tanggal: 29 Oktober 2026, Asia/Jakarta.

## Hasil lokal

- 155 tes Node lulus: kontrak backend/SQL/auth, validasi, regresi, serta 8 tes HTTP/kontrak rilis baru.
- Pemeriksaan sintaks JavaScript lulus.
- Audit dependensi npm: 0 kerentanan terdeteksi setelah pembaruan Nodemailer.
- Chromium: pencarian, filter dan reset, favorit, produk, keranjang, kuantitas, subtotal, checkout COD, pengiriman, penerimaan, ulasan, pencatatan COD, tambah produk dan foto, kategori, moderasi, alamat, preferensi tema, akses tamu, dan dialog.
- Tidak ditemukan uncaught JavaScript error pada alur browser yang diperiksa.
- Halaman pembeli/penjual/owner: lebar 320, 390, 768, 1440, dan 1918 piksel; tidak ditemukan overflow horizontal pada halaman yang diperiksa.
- Formulir login, registrasi tahap awal, dan pemulihan produksi: lebar 320, 390, 768, dan 1440 piksel.

## Batas bukti

Transaksi browser dan tes HTTP menggunakan server demo terisolasi. Kontrak SQL dibaca secara statis; SQL tidak dijalankan pada Supabase nyata dalam sesi ini.

Belum diverifikasi pada layanan nyata: registrasi/login OTP, pengiriman email/WhatsApp, upload Supabase Storage, race condition checkout database, transaksi lintas akun produksi, dan deployment. Tidak ada konfigurasi rahasia produksi yang disediakan.

Server produksi tidak mengimpor atau memasang router demo. Tidak ada .env asli atau kredensial di ZIP. Paket berisi source dan lockfile; node_modules serta Chromium dipasang melalui perintah pada README.

## Pengujian staging

Konfigurasi database dan environment, lalu uji dengan akun staging: daftar dan OTP → login → tambah produk dan foto → checkout → proses pesanan → diterima → ulasan. Uji juga stok terakhir dengan dua pembeli, pembatalan dan pengembalian stok, isolasi data akun, serta kegagalan provider OTP.

Screenshot berisi data contoh. Laporan mesin: preview/browser-report.json dalam ZIP rilis atau qa-previews/browser-report.json setelah menjalankan tes sendiri. Beberapa tes rilis lama memakai file CSS historis sebagai fixture; verifikasi antarmuka aktif dilakukan oleh tes browser v6.
