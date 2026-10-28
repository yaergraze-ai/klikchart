/* Klikchart v4.8: decorative interaction layer. All business actions remain in dashboard.js. */
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
document.addEventListener('pointerdown', (event) => {
  if (reducedMotion.matches || event.button !== 0) return;
  const target = event.target.closest('.btn, .nav-link, .account-tab, .category-chip, .store-bottom a, .profile-menu-item, .account-shortcut, .profile-menu-toggle');
  if (!target || target.matches(':disabled') || target.getAttribute('aria-disabled') === 'true') return;
  const rect = target.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  const dot = document.createElement('span');
  dot.className = 'kc-ripple';
  dot.setAttribute('aria-hidden', 'true');
  dot.style.setProperty('--ripple-x', (event.clientX - rect.left) + 'px');
  dot.style.setProperty('--ripple-y', (event.clientY - rect.top) + 'px');
  dot.style.setProperty('--ripple-scale', String(Math.ceil(Math.max(rect.width, rect.height) / 6) + 8));
  target.classList.add('kc-ripple-target');
  target.appendChild(dot);
  setTimeout(()=>dot.remove(),600);
  dot.addEventListener('animationend', () => { dot.remove(); }, {once:true});
}, {passive:true});

document.addEventListener('invalid', (event) => {
  const field = event.target;
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) return;
  field.setAttribute('aria-invalid', 'true');
}, true);
document.addEventListener('input', (event) => {
  const el = event.target;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    if (el.checkValidity()) el.removeAttribute('aria-invalid');
  }
}, {passive:true});
