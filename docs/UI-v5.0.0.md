# Klikchart UI v5.0.0 — Desain ulang responsif

Paket ini memuat source lengkap untuk dashboard Pembeli, Penjual, dan Owner serta sistem autentikasi dan backend yang sudah ada. Fokus perubahan adalah perbaikan layout dan alur interaksi, tanpa migrasi SQL baru atau API eksternal baru.

## Perbaikan utama

- Kartu produk memiliki area gambar dan judul yang dapat diklik, tombol favorit terpisah, satu tombol tambah keranjang utama, dan status stok habis yang tidak dapat dibeli.
- Filter katalog menggunakan satu tindakan Terapkan untuk kategori, rentang harga, dan urutan; validasi harga dijalankan sebelum permintaan API. Pada layar HP filter menjadi panel yang dibuka-tutup, dan tertutup setelah diterapkan.
- Pencarian memakai form dengan tombol Search yang bisa diklik maupun dikirim menggunakan Enter.
- Tombol navigasi HP memberi indikator halaman aktif. Tombol menu panel Owner/Penjual menyetel aria-expanded saat dibuka/tutup.
- Grid 4/3/2/1 kolom menyesuaikan layar desktop, laptop, tablet, dan ponsel sempit. Semua kartu menggunakan sistem warna, tipografi, radius dan ukuran tombol yang konsisten.
- Halaman pesanan kosong memiliki aksi untuk kembali mencari produk; sidebar, formulir, tab, dan tabel dioptimalkan pada layar sempit.
- Aset UI yang ditambah: `public/assets/dashboard/ui-v50.css`. Tidak ada dependensi npm atau ikon CDN baru; ikon berasal dari SVG inline.

## Referensi desain (inspirasi, bukan penyalinan)

- Baymard, Mobile Ecommerce Usability: https://baymard.com/research/mcommerce-usability
- Baymard, Product List UX: https://baymard.com/research/ecommerce-product-lists
- Baymard, Mobile Filter UI: https://baymard.com/blog/ecommerce-filter-ui
- shadcn/ui Dashboard Blocks: https://ui.shadcn.com/blocks?category=dashboard
- Bootstrap Icons (referensi ikon; tidak menjadi ketergantungan): https://icons.getbootstrap.com/

## Verifikasi dan batasan

Dijalankan dengan `npm run lint`, `npm test`, serta skrip pengujian Chromium di lingkungan pengembangan menggunakan respons API simulasi. Tes browser mencakup mobile 320 dan 390 px, tablet 768 px, desktop 1440 dan 1918 px, pembelian katalog dan kontrol filter, serta dashboard Owner/Penjual. Data Supabase live, OTP nyata, upload produk, dan transaksi COD harus diuji di staging sebelum produksi.

Jangan unggah `.env` berisi kunci rahasia ke GitHub. Gunakan environment variable di Vercel. Tidak perlu menjalankan `FRESH_DATABASE.sql` ulang hanya untuk pembaruan UI.
