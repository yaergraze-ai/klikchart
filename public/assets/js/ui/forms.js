import {t} from '../i18n.js';
export const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=name=>`<svg aria-hidden="true"><use href="#${name}"></use></svg>`;
const back=()=>`<div class="back-control"><button class="inline-link" type="button" data-action="back">← ${esc(t('back'))}</button></div>`;
const feedback=()=>'<p class="form-feedback" id="form-feedback" role="status" hidden></p>';
const primary=(key)=>`<button class="primary-button" type="submit" id="submit-button"><span>${esc(t(key))}</span>${icon('arrow')}</button>`;
const h=(title,subtitle)=>`<h2 id="form-title">${esc(t(title))}</h2><p class="form-subtitle">${esc(t(subtitle))}</p>`;
const input=(name,labelKey,placeholderKey,value='',opts={})=>{
 const isPassword=opts.type==='password';
 return `<div class="field" data-field="${name}"><label for="${name}">${esc(t(labelKey))}</label><div class="input-wrap">
 <input id="${name}" name="${name}" type="${opts.type||'text'}" value="${isPassword?'':esc(value)}" placeholder="${esc(t(placeholderKey))}" ${opts.autocomplete?`autocomplete="${opts.autocomplete}"`:''} ${opts.inputmode?`inputmode="${opts.inputmode}"`:''} ${opts.maxlength?`maxlength="${opts.maxlength}"`:''} aria-describedby="${name}-error" required>
 ${isPassword?`<button type="button" data-toggle-password="${name}" aria-label="${esc(t('showPassword'))}" aria-pressed="false">${icon('eye')}</button>`:opts.icon?icon(opts.icon):''}</div>
 ${opts.strength?`<div class="strength" data-level="0" aria-hidden="true"><span></span><span></span><span></span><span></span></div><small class="field-hint" data-strength-label>${esc(t('PASSWORD_INVALID'))}</small>`:''}
 <small id="${name}-error" class="field-error" hidden></small></div>`;
};
const step=current=>`<div class="step-indicator" aria-label="${esc(t('step',{current}))}"><span class="${current===1?'is-current':''}"></span><span class="${current===2?'is-current':''}"></span><small>${esc(t('step',{current}))}</small></div>`;
const signupFooter=(intro,button,path)=>`<div class="separator"><span>✳</span></div><div class="signup"><span>${esc(t(intro))}</span><button type="button" data-nav="${path}">${esc(t(button))} ↗</button></div>`;
function methods(s){
 const kind=s.route==='register'?'registerMethodTitle':s.route==='login'?'loginMethodTitle':'forgotMethodTitle';
 // Keep both choices visible after register/login. A disabled placeholder makes a
 // missing SMTP/Fonnte configuration clear instead of silently hiding a method.
 const list=[...(s.methods||[])];
 if(s.route!=='forgot')for(const channel of ['email','whatsapp']){
  if(!list.some(m=>m.channel===channel))list.push({channel,unavailable:true,masked:t('methodUnavailable')});
 }
 list.sort((a,b)=>['email','whatsapp'].indexOf(a.channel)-['email','whatsapp'].indexOf(b.channel));
 const cards=list.map(m=>`<button class="method-card" type="button" role="radio" aria-checked="${s.channel===m.channel&&!m.unavailable}" aria-disabled="${!!m.unavailable}" ${m.unavailable?'disabled':`data-method="${m.channel}"`}>${icon(m.channel==='email'?'mail':'phone')}<strong>${esc(t(m.channel==='email'?'emailMethod':'whatsappMethod'))}</strong><small>${esc(m.masked||t(m.channel==='email'?'emailMethod':'whatsappMethod'))}</small>${m.needsVerification?`<small class="method-hint">${esc(t(m.channel==='email'?'firstEmailHint':'firstWAHint'))}</small>`:''}<svg class="method-check" aria-hidden="true"><use href="#check"></use></svg></button>`).join('');
 return h(kind,'methodHint')+`<div class="method-options" role="radiogroup" aria-label="${esc(t('chooseMethod'))}">${cards}</div>`+(cards?`<form id="active-form" novalidate>${feedback()}${primary('sendCode')}</form>`:`<p class="notice">${esc(t('noMethod'))}</p>`)+back();
}
function otp(s){
 const destination=s.route==='app'?null:s.methods?.find(m=>m.channel===s.channel);
 const destinationHint=s.channel==='email'?`<p class="notice otp-delivery-hint">${esc(t('emailInboxHint'))}${destination?.masked?' '+esc(destination.masked):''}</p>`:'';
 return h('otpTitle','codeHint')+destinationHint+(s.route==='forgot'&&s.resetEmailStep?'<p class="notice">'+esc(t('resetEmailConfirm'))+'</p>':'')+`<form id="active-form" novalidate><label for="otp-0" class="field-label">${esc(t('codeLabel'))}</label>
 <div class="otp-boxes" id="otp-boxes">${Array.from({length:6},(_,i)=>`<input id="otp-${i}" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" autocomplete="${i===0?'one-time-code':'off'}" aria-label="${esc(t('codeLabel'))} ${i+1}" data-otp-index="${i}">`).join('')}</div>
 <div class="resend-row"><small id="resend-countdown" role="status"></small><button class="inline-link" data-action="resend" type="button" id="resend-button" disabled>${esc(t('resend'))}</button></div>
 ${feedback()}${primary(s.route==='register'?'verify':s.route==='login'?'verifyLogin':s.route==='app'?(s.phase==='email-otp'?'accountEmailVerify':'accountWAVerify'):'verifyReset')}
 </form><div class="back-control"><button class="inline-link" type="button" data-action="change-method">← ${esc(t(s.route==='app'?'back':'changeMethod'))}</button></div>`;
}
export function renderForm(s){
 if(s.route==='app'&&s.phase==='wa-otp')return h('accountWATitle','accountWASubtitle')+`<p class="account-phone">${esc(s.waStatus?.phoneMasked||'')}</p>`+otp(s).replace(h('otpTitle','codeHint'),'');
 if(s.route==='app'&&s.phase==='email-otp')return h('accountEmailTitle','accountEmailSubtitle')+`<p class="account-phone">${esc(s.waStatus?.emailMasked||'')}</p>`+otp(s).replace(h('otpTitle','codeHint'),'');
 if(s.route==='app'){
  const waVerified=Boolean(s.waStatus?.whatsappVerified);
  const waNote=waVerified?'accountWAVerified':s.waStatus?.whatsappAvailable?'accountWANotVerified':s.waStatus?.phoneMasked?'accountWAUnavailable':'accountWANoPhone';
  const emailVerified=Boolean(s.waStatus?.emailVerified);
  const emailNote=emailVerified?'accountEmailVerified':s.waStatus?.emailAvailable?'accountEmailNotVerified':'accountEmailUnavailable';
  const email=`<section class="account-wa-panel account-contact-panel" aria-label="${esc(t('accountEmailHeading'))}"><div class="account-contact-header"><span class="account-wa-label">${icon('mail')} ${esc(t('accountEmailHeading'))}</span><span class="account-verified-tag" data-status="${emailVerified?'verified':'pending'}">${esc(t(emailVerified?'verifiedBadge':'pendingBadge'))}</span></div><span class="account-wa-status">${esc(t(emailNote))}</span>${s.waStatus?.emailMasked?`<small>${esc(s.waStatus.emailMasked)}</small>`:''}${!emailVerified&&s.waStatus?.emailAvailable?`<button type="button" class="account-wa-button" data-action="email-start">${esc(t('accountEmailSend'))} →</button>`:''}</section>`;
  const wa=`<section class="account-wa-panel account-contact-panel" aria-label="${esc(t('accountWAHeading'))}"><div class="account-contact-header"><span class="account-wa-label">${icon('phone')} ${esc(t('accountWAHeading'))}</span><span class="account-verified-tag" data-status="${waVerified?'verified':'pending'}">${esc(t(waVerified?'verifiedBadge':'pendingBadge'))}</span></div><span class="account-wa-status">${esc(t(waNote))}</span>${s.waStatus?.phoneMasked?`<small>${esc(s.waStatus.phoneMasked)}</small>`:''}${!waVerified&&s.waStatus?.whatsappAvailable?`<button type="button" class="account-wa-button" data-action="wa-start">${esc(t('accountWASend'))} →</button>`:''}</section>`;
  return `<h2 id="form-title">${esc(t('appTitle',{username:s.username||''}))}</h2><p class="form-subtitle">${esc(t('appSubtitle'))}</p>`+`<div class="account-verification-grid">${email}${wa}</div>`+`<div class="back-control"><button class="inline-link" type="button" data-action="dashboard">← ${esc(t('dashboardBack'))}</button></div>`+`<form id="active-form">${feedback()}${primary('logout')}</form>`;
 }
 if(s.phase==='methods')return methods(s);
 if(s.phase==='otp')return otp(s);
 if(s.route==='login')return h('loginTitle','loginSubtitle')+`<form id="active-form" novalidate>
 ${input('identifier','identifier','identifierPlaceholder',s.values.identifier,{autocomplete:'username',maxlength:254,icon:'mail'})}
 ${input('password','password','passwordPlaceholder','',{type:'password',autocomplete:'current-password'})}
 <div class="form-options"><label class="check-label"><input type="checkbox" id="remember" ${s.remember?'checked':''}><span>${esc(t('remember'))}</span></label><button type="button" data-nav="/forgot-password">${esc(t('forgotLink'))}</button></div>
 ${feedback()}${primary('loginButton')}</form>${signupFooter('needAccount','createNow','/register')}`;
 if(s.route==='register'&&s.phase==='one')return h('registerTitle','registerSubtitle1')+step(1)+`<form id="active-form" novalidate>
 ${input('username','username','usernamePlaceholder',s.values.username,{autocomplete:'username',maxlength:20})}
 ${input('email','email','emailPlaceholder',s.values.email,{type:'email',autocomplete:'email',maxlength:254,icon:'mail'})}
 ${feedback()}${primary('continue')}</form>${signupFooter('haveAccount','loginNow','/login')}`;
 if(s.route==='register'&&s.phase==='two')return h('registerTitle','registerSubtitle2')+step(2)+`<form id="active-form" novalidate>
 ${input('phone','phone','phonePlaceholder',s.values.phone,{type:'tel',autocomplete:'section-klikchart-register tel-national',inputmode:'tel',icon:'phone',maxlength:20})}
 ${input('password','password','passwordNewPlaceholder','',{type:'password',autocomplete:'new-password',strength:true})}
 ${input('confirmPassword','confirmPassword','confirmPlaceholder','',{type:'password',autocomplete:'new-password'})}
 ${feedback()}${primary('registerButton')}</form>${back()}`;
 if(s.route==='forgot'&&s.phase==='start')return h('forgotTitle','forgotSubtitle')+`<form id="active-form" novalidate>${input('email','email','emailPlaceholder',s.values.email,{type:'email',autocomplete:'email',maxlength:254,icon:'mail'})}${feedback()}${primary('forgotButton')}</form>${signupFooter('haveAccount','loginNow','/login')}`;
 if(s.route==='forgot'&&s.phase==='new')return h('newPasswordTitle','newPasswordSubtitle')+`<form id="active-form" novalidate>
 ${input('password','password','passwordNewPlaceholder','',{type:'password',autocomplete:'new-password',strength:true})}
 ${input('confirmPassword','confirmPassword','confirmPlaceholder','',{type:'password',autocomplete:'new-password'})}
 ${feedback()}${primary('resetButton')}</form>`;
 return h('loginTitle','loginSubtitle');
}
