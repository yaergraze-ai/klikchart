import {initLanguage,setLanguage,getLanguage,t} from './i18n.js';
import {api} from './api.js';
import {renderForm,esc} from './ui/forms.js';
import {setupCardSpotlight} from './ui/motion.js';
import {readLiveFormValues,registrationErrorPhase} from './ui/form-values.js';
import {setupHeroMotion} from './ui/hero-motion.js';
const $=(s,root=document)=>root.querySelector(s);
const $$=(s,root=document)=>[...root.querySelectorAll(s)];
const card=$('.auth-card'),content=$('#auth-content'),dialog=$('#info-dialog');
const reduceMotion=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let config={channels:[]};
let countdownTimer=null,lastTrigger=null,submissionInProgress=false;
const initialRoute=()=>location.pathname==='/register'?'register':location.pathname==='/forgot-password'?'forgot':location.pathname==='/app'?'app':'login';
const state={route:initialRoute(),phase:'start',values:{},remember:false,methods:[],channel:null,sentAt:0,username:'',waStatus:null,waChallengeId:null,emailChallengeId:null,resetEmailStep:false,flash:null};
const startPhase=r=>r==='register'?'one':'start';
state.phase=startPhase(state.route);
try{state.values.identifier=localStorage.getItem('klikchart-remembered-email')||'';state.remember=!!state.values.identifier;}catch{}
const ensureMethod=()=>{if(!state.methods.some(m=>m.channel===state.channel))state.channel=state.methods[0]?.channel||null;};
// v1.4: let CSS size the card. Do not observe the content and repeatedly
// write its height: that created a measurement/ResizeObserver feedback loop,
// causing the card to oscillate even while the user was not interacting.
let contentAnimation=null;

const kindFromPath=path=>path==='/register'?'register':path==='/forgot-password'?'forgot':path==='/app'?'app':'login';
function wipeSensitive(){delete state.values.password;delete state.values.confirmPassword;}
function translatedPage(){setLanguage(getLanguage());}
// Swap instantly; animate only the one transition that the user requested.
// No resize observer, no persistent inline height, and no periodic fitting.
function paint(animate=true){
 // CSS uses the active auth stage to reclaim hero space for longer mobile forms.
 document.body.dataset.authLayout = (state.route==='register' && state.phase==='two') || (state.route==='forgot' && state.phase==='new') ? 'dense' : 'standard';
 document.body.dataset.authStage = `${state.route}-${state.phase}`;
 contentAnimation?.cancel();
 contentAnimation=null;
 content.innerHTML=`<div class="auth-view">${renderForm(state)}</div>`;
 // Keep the header navigation synchronized with the active form route.
 document.querySelectorAll('.header nav [data-nav]').forEach(link=>{
  const active=(state.route==='register' && link.dataset.nav==='/register') ||
               (state.route!=='register' && link.dataset.nav==='/login');
  if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
 });
 content.scrollTop=0;
 // Adapt layout for mobile: preserve viewport-first layout, keep all form controls reachable.
 fitMobileStage();
 scheduleMobileFit();
 // Short stagger on freshly changed form; never delay interaction or change card height.
 if (animate && !reduceMotion()) {
   content.querySelector('.auth-view')?.classList.add('klc-view-enter');
 }
 // Stable intrinsic height: do not animate the card's geometry. Text and
 // inputs stay fully reachable, even during rapid form changes.
 if(animate&&!reduceMotion()){
  contentAnimation=content.animate([
   {opacity:.84},
   {opacity:1}
  ],{duration:145,easing:'cubic-bezier(.22,1,.36,1)'});
 }
 if(state.phase==='otp'||(state.route==='app'&&['wa-otp','email-otp'].includes(state.phase)))startCountdown();else stopCountdown();
 if(state.flash){showFeedback(state.flash,'success');state.flash=null;}
}
// Mobile content fit: never move hero with pointer, and do not repeatedly resize card.
// A document-fixed viewport is maintained; only genuinely constrained/keyboard views
// may scroll INSIDE the card for accessibility.
function fitMobileStage(){
 const compact=window.matchMedia('(max-width: 760px)').matches;
 const body=document.body;
 body.classList.remove('klc-mobile-focus','klc-mobile-tight');
 if(!compact)return;
 const auth=content;
 const cannotFit=()=>auth.scrollHeight > auth.clientHeight + 2;
 // Let CSS first reclaim extra whitespace (header/footer/hero) before considering scrolling.
 if(cannotFit())body.classList.add('klc-mobile-focus');
 if(cannotFit())body.classList.add('klc-mobile-tight');
 // If still larger, keep the internal scroll fallback; don't hide form inputs.
}
let fitRaf=0;
function scheduleMobileFit(){
 if(fitRaf)cancelAnimationFrame(fitRaf);
 fitRaf=requestAnimationFrame(()=>{fitRaf=0;fitMobileStage();});
}
window.addEventListener('resize',scheduleMobileFit,{passive:true});
window.visualViewport?.addEventListener('resize',scheduleMobileFit,{passive:true});
function stopCountdown(){if(countdownTimer)clearInterval(countdownTimer);countdownTimer=null;}
function updateCountdown(){
 const el=$('#resend-countdown'),btn=$('#resend-button');if(!el||!btn)return;
 if(state.route==='forgot'&&state.resetEmailStep){btn.hidden=true;el.textContent='';return;}
 const remaining=Math.max(0,Math.ceil((state.sentAt+60000-Date.now())/1000));
 el.textContent=remaining?t('resendIn',{time:`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`}):'';
 btn.disabled=remaining>0;
}
function startCountdown(){stopCountdown();updateCountdown();countdownTimer=setInterval(updateCountdown,1000);}
function showFeedback(code,tone='error'){
 const el=$('#form-feedback');if(!el)return;
 el.hidden=false;el.dataset.tone=tone;el.setAttribute('role',tone==='error'?'alert':'status');el.textContent=t(code);
}
function clearFeedback(){const el=$('#form-feedback');if(el){el.hidden=true;el.textContent='';}}
function addError(name,code){
 const field=$(`[data-field="${name}"]`);if(!field)return;
 const el=$(`#${name}-error`),input=$(`[name="${name}"]`);
 if(el){el.hidden=false;el.textContent=t(code);}if(input){input.setAttribute('aria-invalid','true');field.classList.add('shake');setTimeout(()=>field.classList.remove('shake'),290);}
 field.classList.remove('is-valid');
}
function clearError(name){const field=$(`[data-field="${name}"]`);if(!field)return;field.classList.remove('shake');const err=$(`#${name}-error`);if(err){err.hidden=true;err.textContent='';}const input=$(`[name="${name}"]`);if(input)input.removeAttribute('aria-invalid');}
function validate(name,all=false){
 const field=$(`[data-field="${name}"]`);if(!field)return true;
 const input=$(`[name="${name}"]`),v=String(input?.value||'').trim(),pwd=String($('[name="password"]')?.value||state.values.password||'');
 let err=null;
 if(name==='username'&&!/^[A-Za-z0-9._]{3,20}$/.test(v))err='USERNAME_INVALID';
 if(name==='email'&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)||v.length>254))err='EMAIL_INVALID';
 if(name==='phone'){
  const num=v.replace(/[\s().-]/g,'').replace(/^\+/,'').replace(/^0/,'62').replace(/^8/,'628');
  if(!/^628[1-9][0-9]{7,11}$/.test(num))err='PHONE_INVALID';
 }
 if(name==='identifier'&&!v)err='IDENTIFIER_REQUIRED';
 if(name==='password'){
  if(state.route==='login'){if(!v)err='PASSWORD_REQUIRED';}
  else if(v.length<8||v.length>72||!/[A-Za-z]/.test(v)||!/[0-9]/.test(v))err='PASSWORD_INVALID';
 }
 if(name==='confirmPassword'&&v!==pwd)err='PASSWORD_MISMATCH';
 clearError(name);
 if(err){addError(name,err);return false;}
 if(v)field.classList.add('is-valid');return true;
}
function validateAll(){const names=$$('input[name]').map(x=>x.name);let first=null;for(const name of names){if(!validate(name,true)&&!first)first=$(`[name="${name}"]`);}if(first){first.focus();return false;}return true;}
function showAPIError(error){
 clearFeedback();const fields=error.fields||{};
 // An autofilled first step can be incomplete in the backend even when the
 // user is viewing step 2. Show the actual field error rather than a generic
 // banner on the wrong step.
 const correctPhase=registrationErrorPhase(state.route,state.phase,fields);
 if(correctPhase){
  state.phase=correctPhase;
  paint(false);
  showFeedback('registrationStepReview');
 }
 let first=null;
 Object.entries(fields).forEach(([name,code])=>{addError(name,code);if(!first)first=$(`[name="${name}"]`);});
 if(first){first.focus();return;}
 showFeedback(Object.keys(fields).length ? 'registrationStepReview' : (error.code||'INTERNAL_ERROR'));
 if(state.phase==='otp'){
  const boxes=$('#otp-boxes');boxes?.classList.add('has-error','shake');
  $$('[data-otp-index]').forEach(x=>{x.value='';});
  boxes?.addEventListener('animationend',()=>boxes.classList.remove('shake'),{once:true});
  $('[data-otp-index]')?.focus();
 }
}
function loading(on){const button=$('#submit-button');if(!button)return;
 if(on){button.dataset.label=$('span',button)?.textContent||'';button.disabled=true;button.setAttribute('aria-busy','true');$('span',button).textContent=t('processing');$('use',button)?.setAttribute('href','#spinner');}
 else{button.disabled=false;button.removeAttribute('aria-busy');if(button.dataset.label)$('span',button).textContent=button.dataset.label;$('use',button)?.setAttribute('href','#arrow');}
}
async function move(phase){state.phase=phase;await paint();}
async function navigate(path,replace=false){
 const canonical=['/login','/register','/forgot-password','/app'].includes(path)?path:'/login';
 // Leaving the registration flow discards the encrypted pending signup cookie.
 // Closing the browser needs no cleanup in Supabase (no pending rows exist).
 if(state.route==='register'&&canonical!=='/register'){
  api('register/cancel',{}).catch(()=>{});
 }
 if(replace)history.replaceState({},'',canonical);else if(location.pathname!==canonical)history.pushState({},'',canonical);
 stopCountdown();wipeSensitive();state.route=kindFromPath(canonical);state.phase=startPhase(state.route);state.methods=[];state.channel=null;state.sentAt=0;state.waChallengeId=null;state.emailChallengeId=null;state.waStatus=null;state.resetEmailStep=false;state.values=state.route==='login'?{identifier:state.remember?localStorage.getItem('klikchart-remembered-email')||'':''}:{};
 if(state.route==='app')return loadApp();return paint();
}
async function loadApp(){
 try{const me=await api('me');state.username=me.username;state.waStatus=me;state.phase='start';await paint();}
 catch{await navigate('/login',true);}
}
async function submit(event){
 event.preventDefault();
 // Browser password managers and autofill can change DOM values without
 // dispatching input events. Read the actual current form before validation
 // and before sending anything to the backend.
 readLiveFormValues(event.currentTarget?.tagName==='FORM' ? event.currentTarget : event.target, state.values);
 const {route,phase}=state;
 if(route==='app'&&phase==='wa-otp')return submitAccountWA(event);
 if(route==='app'&&phase==='email-otp')return submitAccountEmail(event);
 if(route==='register'&&phase==='one'){if(!validateAll())return;return move('two');}
 if(['login','register','forgot'].includes(route)&&phase==='start'||route==='register'&&phase==='two'||route==='forgot'&&phase==='new'){
  if(!validateAll())return;
 }
 if(submissionInProgress)return;
 submissionInProgress=true;
 clearFeedback();loading(true);
 try{
  if(route==='login'&&phase==='start'){
   const result=await api('login',{identifier:state.values.identifier,password:state.values.password});
   if(state.remember&&state.values.identifier.includes('@'))localStorage.setItem('klikchart-remembered-email',state.values.identifier);else localStorage.removeItem('klikchart-remembered-email');
   wipeSensitive();state.methods=result.methods;ensureMethod();await move('methods');
  }else if(route==='register'&&phase==='two'){
   const result=await api('register',{...state.values,confirmPassword:state.values.confirmPassword});
   wipeSensitive();state.methods=result.methods;ensureMethod();await move('methods');
   // Fresh project: registration remains pending until OTP succeeds.
  }else if(route==='forgot'&&phase==='start'){
   state.methods=config.channels.map(channel=>({channel,masked:''}));ensureMethod();await move('methods');
  }else if(phase==='methods'){
   if(!state.channel)throw Object.assign(new Error('CHANNEL_UNAVAILABLE'),{code:'CHANNEL_UNAVAILABLE'});
   let endpoint,payload={channel:state.channel,locale:getLanguage()};
   if(route==='register')endpoint='register/otp/send';
   if(route==='login')endpoint='login/otp/send';
   if(route==='forgot'){endpoint='forgot/send';payload.email=state.values.email;state.resetEmailStep=false;}
   await api(endpoint,payload);state.sentAt=Date.now();await move('otp');
   if(state.channel==='email')showFeedback('emailSendAccepted','info');
   else if(route==='forgot')showFeedback('codeSent','info');
  }else if(phase==='otp'){
   const code=$$('[data-otp-index]').map(x=>x.value).join('');
   if(!/^\d{6}$/.test(code))throw Object.assign(new Error('OTP_INVALID'),{code:'OTP_INVALID'});
   const endpoint=route==='register'?'register/otp/verify':route==='login'?'login/otp/verify':'forgot/verify';
   const result=await api(endpoint,{code,locale:getLanguage()});
   if(route==='register'){if(result.verified!==true)throw Object.assign(new Error('VERIFICATION_NOT_SAVED'),{code:'VERIFICATION_NOT_SAVED'});showSuccess();}
   else if(route==='login'){location.assign('/dashboard');}
   else if(result.additionalVerification){state.resetEmailStep=true;state.channel='email';state.sentAt=Date.now();await move('otp');showFeedback('codeSent','info');}
   else{await move('new');}
  }else if(route==='forgot'&&phase==='new'){
   const result=await api('forgot/reset',{password:state.values.password,confirmPassword:state.values.confirmPassword});
   if(result.changed){await navigate('/login');showFeedback('resetSuccess','success');}
  }else if(route==='app'){
   await api('logout',{});await navigate('/login',true);
  }
 }catch(error){showAPIError(error);}finally{loading(false);submissionInProgress=false;}
}
function showSuccess(){
 const particles=Array.from({length:12},(_,i)=>{const angle=i*Math.PI/6;return `<i style="--i:${i};--x:${Math.round(Math.cos(angle)*115)}px;--y:${Math.round(Math.sin(angle)*80)}px">✦</i>`;}).join('');
 $('#dialog-content').innerHTML=`<div class="modal-success"><div class="success-particles">${particles}</div><div class="success-ring"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#check"></use></svg></div><h2 id="dialog-title">${esc(t('successTitle'))}</h2><p>${esc(t('successMessage'))}</p></div>`;
 $('.dialog-done span').textContent=t('successAction');dialog.dataset.kind='success';lastTrigger=$('#submit-button');dialog.showModal();$('.dialog-done').focus();
}
function openDialog(kind,trigger){
 const key=kind==='privacy'?'privacy':kind==='help'?'help':'about';
 const title=key==='privacy'?'privacyTitle':key==='help'?'helpTitle':'infoAboutTitle',body=key==='privacy'?'privacyBody':key==='help'?'helpBody':'infoAbout';
 $('#dialog-content').innerHTML=`<h2 id="dialog-title">${esc(t(title))}</h2><p>${esc(t(body))}</p>`;
 $('.dialog-done span').textContent=t('dialogDone');dialog.dataset.kind='info';lastTrigger=trigger;dialog.showModal();$('.close-dialog').focus();
}
function closeDialog(){
 if(!dialog.open||dialog.classList.contains('closing'))return;
 if(reduceMotion()){dialog.close();lastTrigger?.focus();return;}
 dialog.classList.add('closing');const done=()=>{dialog.classList.remove('closing');dialog.close();lastTrigger?.focus();};
 dialog.addEventListener('animationend',function listener(e){if(e.target!==dialog)return;dialog.removeEventListener('animationend',listener);done();},{once:false});
}
function goBack(){
 if(state.route==='register'){if(state.phase==='two')return move('one');if(state.phase==='methods')return move('two');if(state.phase==='otp')return move('methods');}
 if(state.route==='login'){if(state.phase==='otp')return move('methods');return navigate('/login');}
 if(state.route==='forgot'){if(state.phase==='methods')return move('start');if(state.phase==='otp')return move('methods');return navigate('/login');}
 if(state.route==='app'&&['wa-otp','email-otp'].includes(state.phase)){state.waChallengeId=null;state.emailChallengeId=null;return move('start');}
}
async function resend(){if(Date.now()-state.sentAt<60000)return;
 const btn=$('#resend-button');if(btn)btn.disabled=true;
 try{const payload={channel:state.channel,locale:getLanguage()};let endpoint=state.route==='app'?(state.phase==='email-otp'?'account/email/send':'account/whatsapp/send'):state.route==='register'?'register/otp/resend':state.route==='login'?'login/otp/send':'forgot/send';if(state.route==='forgot')payload.email=state.values.email;
 const result=await api(endpoint,payload);if(state.route==='app'){if(state.phase==='email-otp')state.emailChallengeId=result.challengeId;else state.waChallengeId=result.challengeId;}state.sentAt=Date.now();$$('[data-otp-index]').forEach(x=>x.value='');startCountdown();clearFeedback();if(state.channel==='email')showFeedback('emailSendAccepted','info');}
 catch(e){showAPIError(e);if(btn)btn.disabled=false;}
}
async function startAccountEmail(button){
 button.disabled=true;clearFeedback();
 try{
  const result=await api('account/email/send',{locale:getLanguage()});
  state.emailChallengeId=result.challengeId;state.sentAt=Date.now();state.phase='email-otp';
  paint();showFeedback('emailSendAccepted','info');
 }catch(error){showAPIError(error);button.disabled=false;}
}
async function submitAccountEmail(event){
 event.preventDefault();
 const otpCode=$$('[data-otp-index]').map(x=>x.value).join('');
 if(!/^\d{6}$/.test(otpCode)){showFeedback('OTP_INVALID');return;}
 loading(true);clearFeedback();
 try{
  await api('account/email/verify',{challengeId:state.emailChallengeId,code:otpCode});
  state.waStatus=await api('me');state.emailChallengeId=null;
  state.phase='start';state.flash='accountEmailSuccess';paint();
 }catch(error){showAPIError(error);}finally{loading(false);}
}
async function startAccountWA(button){
 button.disabled=true;clearFeedback();
 try{
  const result=await api('account/whatsapp/send',{locale:getLanguage()});
  state.waChallengeId=result.challengeId;state.sentAt=Date.now();state.phase='wa-otp';
  paint();
 }catch(error){showAPIError(error);button.disabled=false;}
}
async function submitAccountWA(event){
 event.preventDefault();
 const otpCode=$$('[data-otp-index]').map(x=>x.value).join('');
 if(!/^\d{6}$/.test(otpCode)){showFeedback('OTP_INVALID');return;}
 loading(true);clearFeedback();
 try{
  await api('account/whatsapp/verify',{challengeId:state.waChallengeId,code:otpCode});
  const me=await api('me');state.waStatus=me;state.waChallengeId=null;
  state.phase='start';state.flash='accountWASuccess';paint();
 }catch(error){showAPIError(error);}finally{loading(false);}
}
function strength(value){let points=0;if(value.length>=8)points++;if(value.length>=12)points++;if(/[a-z]/.test(value)&&/[A-Z]/.test(value))points++;if(/[^A-Za-z0-9]/.test(value))points++;if(value&&/[a-zA-Z]/.test(value)&&/[0-9]/.test(value))points=Math.max(points,2);return points;}
function updateStrength(){const bar=$('.strength'),hint=$('[data-strength-label]'),val=$('[name="password"]')?.value||'';if(!bar||!hint)return;const n=strength(val);bar.dataset.level=String(n);hint.textContent=val?t(n<=1?'passwordWeak':n===2?'passwordMedium':'passwordStrong'):t('PASSWORD_INVALID');}
function otpInput(input){const index=Number(input.dataset.otpIndex);const digit=input.value.replace(/\D/g,'').slice(-1);input.value=digit;if(digit&&index<5)$(`[data-otp-index="${index+1}"]`)?.focus();}
function otpPaste(event){
 const input=event.target.closest('[data-otp-index]');if(!input)return;
 const text=event.clipboardData?.getData('text')||'';const numbers=text.replace(/\D/g,'').slice(0,6);if(!numbers)return;event.preventDefault();
 const start=numbers.length===6?0:Number(input.dataset.otpIndex);
 for(let i=0;i<numbers.length&&start+i<6;i++)$(`[data-otp-index="${start+i}"]`).value=numbers[i];
 $(`[data-otp-index="${Math.min(5,start+numbers.length)}"]`)?.focus();
}
function handleOtpKeys(event){const input=event.target.closest('[data-otp-index]');if(!input)return;const index=Number(input.dataset.otpIndex);
 if(event.key==='Backspace'&&!input.value&&index>0){$(`[data-otp-index="${index-1}"]`)?.focus();}
 if(event.key==='ArrowLeft'&&index>0){event.preventDefault();$(`[data-otp-index="${index-1}"]`)?.focus();}
 if(event.key==='ArrowRight'&&index<5){event.preventDefault();$(`[data-otp-index="${index+1}"]`)?.focus();}
}
content.addEventListener('submit',submit);
content.addEventListener('input',event=>{const input=event.target;if(input.matches('[data-otp-index]')){otpInput(input);return;}if(input.name){state.values[input.name]=input.value;clearError(input.name);if(input.name==='password')updateStrength();}});
content.addEventListener('change',e=>{if(e.target.id==='remember')state.remember=e.target.checked;else if(e.target.matches('input[name]'))state.values[e.target.name]=e.target.value;});
content.addEventListener('focusout',e=>{if(e.target.matches('input[name]')&&e.target.value)validate(e.target.name);});
content.addEventListener('paste',otpPaste);
content.addEventListener('keydown',handleOtpKeys);
content.addEventListener('click',async e=>{
 const eye=e.target.closest('[data-toggle-password]');if(eye){const el=$(`#${eye.dataset.togglePassword}`);const visible=el.type==='password';el.type=visible?'text':'password';eye.setAttribute('aria-pressed',String(visible));eye.setAttribute('aria-label',t(visible?'hidePassword':'showPassword'));$('use',eye)?.setAttribute('href',visible?'#eye-off':'#eye');return;}
 const method=e.target.closest('[data-method]');if(method){state.channel=method.dataset.method;$$('[data-method]').forEach(x=>x.setAttribute('aria-checked',String(x===method)));return;}
 const action=e.target.closest('[data-action]');if(!action)return;
 if(action.dataset.action==='back'||action.dataset.action==='change-method')return goBack();
 if(action.dataset.action==='resend')return resend();
 if(action.dataset.action==='dashboard')return location.assign('/dashboard');
 if(action.dataset.action==='wa-start')return startAccountWA(action);
 if(action.dataset.action==='email-start')return startAccountEmail(action);
});
content.addEventListener('keydown',e=>{if(!e.target.matches('[data-method]'))return;const options=$$('[data-method]');let i=options.indexOf(e.target);if(['ArrowRight','ArrowDown','ArrowLeft','ArrowUp'].includes(e.key)){e.preventDefault();i=(i+(['ArrowRight','ArrowDown'].includes(e.key)?1:-1)+options.length)%options.length;options[i].focus();options[i].click();}});
document.addEventListener('click',e=>{
 const nav=e.target.closest('[data-nav]');if(nav){e.preventDefault();navigate(nav.dataset.nav);return;}
 const trigger=e.target.closest('[data-dialog]');if(trigger)openDialog(trigger.dataset.dialog,trigger);
 const close=e.target.closest('[data-close]');if(close)closeDialog();
});
dialog.addEventListener('cancel',e=>{e.preventDefault();closeDialog();});
dialog.addEventListener('click',e=>{if(e.target===dialog)closeDialog();});
dialog.addEventListener('close',()=>{if(dialog.dataset.kind==='success')navigate('/login');});
$('#language-select').addEventListener('change',async e=>{setLanguage(e.target.value);await paint(false);});
window.addEventListener('popstate',()=>navigate(location.pathname,true));
window.addEventListener('visibilitychange',()=>{document.documentElement.classList.toggle('page-hidden',document.hidden);if(document.hidden)stopCountdown();else if(state.phase==='otp')startCountdown();});
setupCardSpotlight();
setupHeroMotion();

(async()=>{try{await initLanguage();translatedPage();config=await api('config');if(state.route==='app')await loadApp();else await paint(false);}catch(e){content.innerHTML=`<h2>${esc(t('INTERNAL_ERROR'))}</h2><p class="notice">${esc(t(e.code||'NETWORK_ERROR'))}</p>`;}})();
