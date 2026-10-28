import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
test('an unverified saved email remains a login OTP choice after password auth',()=>{
 const a=src('backend/services/auth.js');
 assert.match(a,/purpose==='register'\|\|purpose==='login'\|\|user\.email_verified/);
 assert.match(a,/auth\.signInWithPassword/);
 const sql=src('supabase/FRESH_DATABASE.sql');
 assert.match(sql,/p_purpose='login' and c.channel='email'/);
 assert.match(sql,/set email_verified=true/);
});
test('SMTP transport handles TLS and distinguishes provider errors without secrets',()=>{
 const s=src('backend/services/smtp.js');
 assert.match(s,/requireTLS:!secure/);
 for(const label of ['SMTP_AUTH_FAILED','SMTP_CONNECTION_FAILED','SMTP_TLS_FAILED','SMTP_REJECTED','SMTP_CONFIG_INVALID'])assert.match(s,new RegExp(label));
 assert.match(s,/info\.accepted/);
 assert.doesNotMatch(s,/console\.error\([^\n]*error\.message/);
});
test('SMTP CLI exposes check and explicit non-OTP send test',()=>{
 const s=src('scripts/check-smtp.mjs');
 const pkg=JSON.parse(src('package.json'));
 assert.match(s,/transporter\.verify\(\)/);
 assert.match(s,/send=process\.argv\.includes\('--send'\)/);
 assert.match(pkg.scripts['smtp:check'],/check-smtp/);
 assert.match(pkg.scripts['smtp:test'],/--send/);
});
test('OTP screen displays masked email destination and inbox checks',()=>{
 const forms=src('public/assets/js/ui/forms.js');
 assert.match(forms,/emailInboxHint/);
 assert.match(forms,/destination\?\.masked/);
 const app=src('public/assets/js/app.js');
 assert.match(app,/emailSendAccepted/);
 for(const locale of ['id','en']){
  const data=JSON.parse(src(`public/assets/i18n/${locale}.json`));
  assert.ok(data.emailInboxHint && data.emailSendAccepted && data.SMTP_AUTH_FAILED);
 }
});
