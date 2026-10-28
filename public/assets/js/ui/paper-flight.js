// Klikchart v3.5 — paper plane flies into the ACTUAL bag logo. Decorative only.
// Single intro, fading tail, soft logo impact; no pointer tracking or layout writes.
const layer=document.getElementById('paper-flight-layer');
const logo=document.querySelector('.brand');
const logoIcon=logo?.querySelector('svg');
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if(layer&&logoIcon&&!reduced){
 const ns='http://www.w3.org/2000/svg';
 const make=(tag,attrs={})=>{const el=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));return el;};
 const svg=make('svg',{viewBox:`0 0 ${window.innerWidth} ${window.innerHeight}`,'aria-hidden':'true',preserveAspectRatio:'none'});
 const trail=make('g'),plane=make('g',{'class':'klc-paper-plane'}),glow=make('circle',{'class':'klc-impact-glow',r:0});
 const paper=make('path',{d:'M -26 -10 L 28 0 L -23 12 L -9 1 Z',fill:'#F4E3FF',stroke:'#B88AE3','stroke-width':1.7,'stroke-linejoin':'round'});
 const fold=make('path',{d:'M -9 1 L 28 0 L -15 8',stroke:'#A475CF','stroke-width':1.8,fill:'none'});
 plane.append(paper,fold);svg.append(trail,glow,plane);layer.append(svg);
 const segments=68,duration=4400,trailAge=920,fadeOut=360;
 let frame=0,started=null,ended=false,impact=false,dimensions={w:window.innerWidth,h:window.innerHeight};
 const bez=(p0,p1,p2,p3,t)=>{const s=1-t;return {x:s*s*s*p0.x+3*s*s*t*p1.x+3*s*t*t*p2.x+t*t*t*p3.x,y:s*s*s*p0.y+3*s*s*t*p1.y+3*s*t*t*p2.y+t*t*t*p3.y}};
 function route(w,h){
  const rect=logoIcon.getBoundingClientRect();
  const end={x:rect.left+rect.width*.52,y:rect.top+rect.height*.51};
  const start={x:Math.max(48,w*.08),y:Math.min(h-55,Math.max(210,h*.73))};
  const mid={x:w*.48,y:Math.min(h*.73,Math.max(188,h*.48))};
  return Array.from({length:segments+1},(_,i)=>{
   const t=i/segments;
   if(t<.57)return bez(start,{x:w*.21,y:h*.27},{x:w*.44,y:h*.84},mid,t/.57);
   return bez(mid,{x:w*.61,y:h*.14},{x:Math.max(end.x+75,w*.37),y:Math.max(end.y+90,h*.21)},end,(t-.57)/.43);
  });
 }
 let positions=route(dimensions.w,dimensions.h);
 const segmentsEls=Array.from({length:segments},()=>{const el=make('path',{'class':'klc-flight-trail'});trail.append(el);return el;});
 function writePath(){positions=route(dimensions.w,dimensions.h);svg.setAttribute('viewBox',`0 0 ${dimensions.w} ${dimensions.h}`);segmentsEls.forEach((el,i)=>{const a=positions[i],b=positions[i+1];el.setAttribute('d',`M ${a.x.toFixed(2)} ${a.y.toFixed(2)} L ${b.x.toFixed(2)} ${b.y.toFixed(2)}`);});}
 writePath();
 const resize=()=>{dimensions={w:innerWidth,h:innerHeight};writePath();};
 window.addEventListener('resize',resize,{passive:true});
 function stop(){cancelAnimationFrame(frame);window.removeEventListener('resize',resize);layer.replaceChildren();layer.remove();}
 function tick(time){
  if(started===null)started=time;
  const elapsed=Math.max(0,time-started),progress=Math.min(1,elapsed/duration),f=progress*segments;
  const idx=Math.min(segments-1,Math.floor(f)),fraction=Math.min(1,f-idx);
  const a=positions[idx],b=positions[idx+1];const x=a.x+(b.x-a.x)*fraction,y=a.y+(b.y-a.y)*fraction;
  const rotation=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;
  const shrink=progress>.89?Math.max(.005,Math.pow((1-progress)/.11,1.8)):1;
  plane.setAttribute('transform',`translate(${x} ${y}) rotate(${rotation}) scale(${shrink})`);
  const ageMax=segments*trailAge/duration;
  segmentsEls.forEach((seg,i)=>{const age=f-i;seg.style.opacity=age>=0&&age<ageMax?String(Math.min(.95,Math.pow(1-age/ageMax,1.3)*.95)):'0';});
  const final=positions[segments];const hit=Math.max(0,Math.min(1,(progress-.925)/.075));
  glow.setAttribute('cx',final.x);glow.setAttribute('cy',final.y);glow.setAttribute('r',String(10+28*Math.sin(hit*Math.PI)));glow.style.opacity=String(Math.max(0,Math.sin(hit*Math.PI)*.72));
  if(!impact&&progress>=.925){impact=true;logo.classList.remove('klc-logo-impact');void logo.offsetWidth;logo.classList.add('klc-logo-impact');const settle=(event)=>{if(event.animationName!=='klc-logo-absorb')return;logo.classList.remove('klc-logo-impact');logo.removeEventListener('animationend',settle);};logo.addEventListener('animationend',settle);}
  const fade=elapsed>duration?Math.max(0,1-(elapsed-duration)/fadeOut):1;
  layer.style.opacity=String(fade);
  if(elapsed<duration+fadeOut){frame=requestAnimationFrame(tick);}else{ended=true;stop();}
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&!ended)stop();},{once:true});
 frame=requestAnimationFrame(tick);
}
