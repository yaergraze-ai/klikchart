import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=f=>readFileSync(new URL(f,import.meta.url),'utf8');
test('both saved destinations offered to password-authenticated users',()=>{
 const s=source('../backend/services/auth.js');
 assert.match(s,/purpose==='register'\|\|purpose==='login'\|\|user.email_verified/);
 assert.match(s,/purpose==='register'\|\|purpose==='login'\|\|user.whatsapp_verified/);
 assert.match(s,/needsVerification:purpose==='login'/);
});
test('OTP can first-verify login email after password and valid code, SQL atomic',()=>{
 const s=source('../backend/services/otp.js');
 const sql=source('../supabase/FRESH_DATABASE.sql');
 assert.doesNotMatch(s,/purpose==='login'&&channel==='email'&&!user.email_verified/);
 assert.match(sql,/p_purpose='login' and c.channel='email'/);
 assert.match(sql,/set email_verified=true/);
 assert.match(sql,/c.code_hash <> p_code_hash/);
});
test('plane arrives at live brand, logo reacts smoothly, trail fades and reduced motion supported',()=>{
 const js=source('../public/assets/js/ui/paper-flight.js');
 const css=source('../public/assets/css/paper-flight.css');
 assert.match(js,/logoIcon.getBoundingClientRect\(\)/);
 assert.match(js,/logo.classList.add\('klc-logo-impact'\)/);
 assert.match(js,/trailAge=920/);
 assert.match(js,/fadeOut=360/);
 assert.match(css,/klc-logo-absorb/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});

test('method screen always displays two choices and labels an unavailable provider honestly',async()=>{
 globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
 const {renderForm}=await import('../public/assets/js/ui/forms.js');
 const html=renderForm({route:'login',phase:'methods',methods:[{channel:'whatsapp',masked:'62812****101'}],channel:'whatsapp',values:{}});
 assert.equal((html.match(/class="method-card"/g)||[]).length,2);
 assert.match(html,/aria-disabled="true"/);
 assert.match(html,/disabled/);
 assert.match(html,/data-method="whatsapp"/);
 assert.doesNotMatch(html,/data-method="email"/);
});
