/* Klikchart 4.8 auth: direct tactile feedback without delaying navigation or form submits. */
const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
document.addEventListener('pointerdown',event=>{
 if(reduce.matches||event.button!==0)return;
 const el=event.target.closest('.primary-button,.secondary-button,.text-link,.header nav a,.close-dialog,.footer button');
 if(!el||el.matches(':disabled'))return;
 const r=el.getBoundingClientRect();if(!r.width||!r.height)return;
 const dot=document.createElement('span');dot.className='kc-auth-ripple';dot.setAttribute('aria-hidden','true');
 dot.style.setProperty('--x',(event.clientX-r.left)+'px');dot.style.setProperty('--y',(event.clientY-r.top)+'px');
 dot.style.setProperty('--scale',String(Math.ceil(Math.max(r.width,r.height)/6)+7));
 el.classList.add('kc-auth-ripple-host');el.appendChild(dot);
 setTimeout(()=>dot.remove(),600);
  dot.addEventListener('animationend',()=>dot.remove(),{once:true});
},{passive:true});
