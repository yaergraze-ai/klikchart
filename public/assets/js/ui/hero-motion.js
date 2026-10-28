/** Klikchart motion story. Reference: Figma prototype node 3:412.
 * Stage the entrance only once; decorative elements can loop quietly.
 * No dependencies, timers, layout reads, or scroll-affecting transforms.
 */
export function setupHeroMotion(){
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduced.matches) return;
  if (document.visibilityState === 'hidden') return;
  root.classList.add('klc-motion-on');
  // The initial reveal happens only once. Navigating forms keeps the hero static.
  document.addEventListener('visibilitychange', () => {
    root.classList.toggle('klc-motion-paused', document.hidden);
  });
}
