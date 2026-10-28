// Small rAF-only pointer parallax. No continuous loop on touch or hidden tabs.
// Hero typography is intentionally anchored. No mouse/touch parallax.
// Pointer-reactive light only on mouse devices; no background animation loop.
export function setupCardSpotlight(){
 const card=document.querySelector('.auth-card');
 if(!card||!window.matchMedia('(min-width: 761px) and (pointer:fine) and (hover:hover)').matches||window.matchMedia('(prefers-reduced-motion:reduce)').matches)return;
 let frame=0,clientX=0,clientY=0;
 card.addEventListener('pointermove',event=>{
  if(event.pointerType!=='mouse'||document.hidden)return;
  clientX=event.clientX;clientY=event.clientY;
  if(frame)return;
  frame=requestAnimationFrame(()=>{
   frame=0;const rect=card.getBoundingClientRect();
   card.style.setProperty('--glow-x',`${Math.round(clientX-rect.left)}px`);
   card.style.setProperty('--glow-y',`${Math.round(clientY-rect.top)}px`);
  });
 },{passive:true});
 card.addEventListener('pointerleave',()=>{if(frame)cancelAnimationFrame(frame);frame=0;card.style.removeProperty('--glow-x');card.style.removeProperty('--glow-y');});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&frame){cancelAnimationFrame(frame);frame=0;}});
}
