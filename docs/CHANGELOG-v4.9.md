# Klikchart Commerce v4.9.0 — Perbaikan Layout

Paket ini merupakan **source lengkap** lanjutan dari v4.8.1, bukan hanya patch CSS. Perubahan UI ditambahkan secara terpisah untuk menjaga backend dan database yang sudah ada.

## Perubahan utama

1. Layout katalog mobile dan desktop: banner, filter, kartu produk, tombol detail/keranjang, benefits bar, header, navbar bawah, dan footer.
2. Layout Owner/Penjual: KPI mengikuti grid responsif, heading dan tombol aksi tidak saling menimpa, tabel adaptif pada layar HP.
3. Tabel daftar produk/pesanan/pengguna: desktop memakai tabel biasa; mobile menampilkan kartu informasi lengkap dengan judul tiap kolom. Tidak perlu scroll horizontal untuk melihat tombol.
4. Halaman akun: identitas, status verifikasi, tab, formulir profil, serta kartu ringkasan akun disejajarkan ulang.
5. Keranjang: foto dan nama produk berada pada baris utama, kontrol jumlah dan hapus mendapat baris aksi terpisah pada mobile.
6. Form alamat: layout dua kolom pada desktop dan satu kolom pada mobile, tombol aksi menetap di dasar dialog yang bisa digulir.
7. Aset baru: `public/assets/dashboard/ui-v49.css` dan `ui-v49.js`.

## Uji yang telah dilakukan

- `npm run lint`: lulus.
- `npm test`: **142 tes lulus**, tanpa tes gagal.
- Chromium dengan mock respons API: berbagai halaman Pembeli, Penjual, Owner pada 320/390/768/1440px, tanpa error JavaScript atau horizontal overflow pada halaman yang diuji.
- Uji klik: dialog hapus alamat (batal/konfirmasi) dan tombol keranjang menggunakan mock respons API.
- Percobaan `npm ci --offline` di lingkungan build ini gagal karena cache npm tidak lengkap; tidak menyatakan instalasi dependency via jaringan sudah terverifikasi.

## Catatan integrasi

- Tidak ada perubahan skema SQL ataupun endpoint backend untuk revisi ini.
- Tetap gunakan variabel environment Vercel yang sudah berfungsi. Jangan salin `.env` asli ke GitHub.
- COD saat ini masih internal. Ongkos ekspedisi real-time, pembayaran digital, refund, dan pengiriman notifikasi otomatis harus melalui integrasi resmi sebelum diaktifkan.
- Uji ulang OTP, pembayaran COD, pengiriman, upload gambar produk, dan akses peran dengan **akun dan Supabase staging** sebelum deploy produksi.

## Cara pakai

Ekstrak `klikchart-fullstack-v4.9.0-layout-rebuild.zip`, buka folder `klikchart/` yang berisi `package.json`. Cadangkan repository terlebih dahulu. Ganti source lama dengan isi folder tersebut (jangan menimpa `.env` dan file secret lokal).

```powershell
npm.cmd ci
npm.cmd run lint
npm.cmd test
npm.cmd start
```

Setelah lolos uji di komputer lokal, commit dan push ke branch Preview Vercel terlebih dahulu; baru gabungkan ke `main` apabila aplikasi berjalan sesuai harapan.
