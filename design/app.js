const $ = (s) => document.querySelector(s);
let mode = 'login';
const form = $('#auth-form');
const email = $('#email');
const password = $('#password');
const feedback = $('#form-feedback');
try { email.value = localStorage.getItem('lucy-remembered-email') || ''; $('#remember').checked = Boolean(email.value); } catch {}
const modes = {
  login: ['Welcome back.', 'Masuk dan biarkan ide-idemu berkembang.', 'Masuk', 'Belum punya akun?', 'Daftar sekarang'],
  signup: ['Make room for ideas.', 'Langkah kecil pertama untuk sesuatu yang besar.', 'Buat akun demo', 'Sudah punya akun?', 'Masuk sekarang'],
  reset: ['A fresh start.', 'Masukkan email untuk mencoba alur pemulihan akun.', 'Pratinjau pemulihan', 'Sudah ingat kata sandinya?', 'Kembali masuk']
};
function setMode(next) {
  mode = next; const copy = modes[mode];
  $('#form-title').textContent = copy[0]; $('#form-subtitle').textContent = copy[1];
  $('#submit-button span').textContent = copy[2]; $('#switch-caption').textContent = copy[3];
  $('#switch-mode').textContent = copy[4] + ' ↗';
  $('#name-field').hidden = mode !== 'signup'; $('#name').required = mode === 'signup';
  $('#password-field').hidden = mode === 'reset'; password.required = mode !== 'reset';
  password.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
  $('#form-options').hidden = mode !== 'login'; feedback.hidden = true; password.value = '';
  (mode === 'signup' ? $('#name') : email).focus();
}
$('#toggle-password').addEventListener('click', () => {
  const show = password.type === 'password'; password.type = show ? 'text' : 'password';
  $('#toggle-password').setAttribute('aria-label', show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi');
  $('#toggle-password').setAttribute('aria-pressed', String(show));
});
$('#switch-mode').addEventListener('click', () => setMode(mode === 'login' ? 'signup' : 'login'));
$('#forgot').addEventListener('click', () => setMode('reset'));
form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (mode === 'reset') {
    feedback.textContent = 'Pratinjau pemulihan selesai. Pada versi terhubung, tautan reset akan dikirim ke email ini. Demo ini tidak mengirim email.';
    feedback.hidden = false; return;
  }
  try { if ($('#remember').checked && mode === 'login') localStorage.setItem('lucy-remembered-email', email.value); else localStorage.removeItem('lucy-remembered-email'); } catch {}
  const name = mode === 'signup' ? $('#name').value.trim() : email.value.split('@')[0];
  password.value = '';
  openDialog('welcome', name);
});
const content = {
  about: '<h2>Curiosity is the beginning.</h2><p>Lucy adalah konsep ruang kreatif untuk ide yang belum menemukan bentuknya. Tempat untuk bereksperimen, mengembangkan inspirasi, dan memulai hal baru.</p><p>Halaman ini memadukan gelombang sutra ungu, tipografi editorial, dan form transparan dari referensi visualmu.</p>',
  explore: '<h2>One idea. Many possibilities.</h2><p>Kenali konsep aplikasi di semesta Lucy.</p><ul><li><strong>LUCYideas™</strong> — ruang untuk mengumpulkan dan mengembangkan ide.</li><li><strong>Lucy Studio</strong> — konsep ruang eksplorasi visual.</li><li><strong>Lucy Connect</strong> — konsep ruang kolaborasi kreatif.</li></ul><p>Aplikasi ini masih berupa konsep dalam pratinjau.</p>',
  expect: '<h2>A little spark goes a long way.</h2><p>Mulai dari sebuah ide, beri ruang untuk tumbuh, lalu lihat ke mana rasa ingin tahu membawamu.</p><ul><li>Coba alur masuk dan pendaftaran demo.</li><li>Eksplorasi tampilan dari desktop atau ponsel.</li><li>Simpan email di perangkat ini dengan “Ingat email saya”.</li></ul>',
  privacy: '<h2>Your ideas. Your space.</h2><p>Form ini adalah demo antarmuka. Email dan kata sandi tidak dikirim ke server autentikasi. Kata sandi tidak disimpan dan dikosongkan setelah formulir dikirim.</p><p>Jika “Ingat email saya” dipilih, hanya alamat email yang disimpan di browser perangkat ini. Hilangkan centang dan masuk kembali untuk menghapusnya.</p><p>Font dimuat dari Google Fonts. Hosting memiliki kontrol aksesnya sendiri.</p>',
  help: '<h2>A little guidance.</h2><p>Untuk mencoba form, gunakan email contoh dan kata sandi contoh minimal 8 karakter. Ikon mata menampilkan atau menyembunyikan kata sandi.</p><p>“Daftar sekarang” membuka form pendaftaran. “Lupa kata sandi?” membuka pratinjau pemulihan. Karena masih demo, akun tidak dibuat dan email tidak dikirim.</p>'
};
function openDialog(kind, name) {
  if (kind === 'welcome') {
    $('#dialog-content').innerHTML = '<div class="welcome-symbol">✦</div><span class="demo-label">PREVIEW COMPLETE</span><h2></h2><p>Ide berikutnya dimulai darimu. Alur ' + (mode === 'signup' ? 'pendaftaran' : 'masuk') + ' demo berhasil dicoba.</p><p>Ini adalah pratinjau antarmuka. Belum ada akun atau sesi autentikasi yang dibuat.</p>';
    $('#dialog-content h2').textContent = 'Hello, ' + (name || 'dreamer') + '.';
  } else $('#dialog-content').innerHTML = content[kind];
  $('#info-dialog').showModal();
}
document.querySelectorAll('[data-dialog]').forEach(button => button.addEventListener('click', () => openDialog(button.dataset.dialog)));
$('.close-dialog').addEventListener('click', () => $('#info-dialog').close());
$('.dialog-done').addEventListener('click', () => $('#info-dialog').close());
$('#info-dialog').addEventListener('click', event => { if (event.target === $('#info-dialog')) { const r = event.target.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.target.close(); } });
