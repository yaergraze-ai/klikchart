import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const app=read('../backend/app.js');
const auth=read('../backend/services/auth.js');
const form=read('../public/assets/js/ui/forms.js');
const frontend=read('../public/assets/js/app.js');
const sql=read('../supabase/FRESH_DATABASE.sql');
test('profile API reports independent email and WhatsApp verification flags',()=>{
 assert.match(auth,/emailVerified:user\.email_verified/);
 assert.match(auth,/whatsappVerified:user\.whatsapp_verified/);
 assert.match(auth,/emailAvailable:configured\('email'\)/);
 assert.match(auth,/emailMasked:user\.email\?maskEmail\(user\.email\)/);
});
test('email verification endpoints require an active session and target stored email',()=>{
 assert.match(app,/\/api\/account\/email\/send/);
 assert.match(app,/\/api\/account\/email\/verify/);
 assert.match(auth,/export async function sendAccountEmailOTP\(req\)[\s\S]*?const user=await requireAccount\(req\)/);
 assert.match(auth,/makeOTP\(\{user,purpose:'verify_email',channel:'email'/);
 assert.match(auth,/export async function verifyAccountEmailOTP[\s\S]*?verifyOTP\(\{challengeId,userId:user.id,purpose:'verify_email'/);
 assert.doesNotMatch(auth,/sendAccountEmailOTP[\s\S]*?req\.body\?\.email/);
});
test('SQL verifies email only after valid OTP and keeps WhatsApp separate',()=>{
 assert.match(sql,/CHECK \(purpose IN \([^)]*'verify_email'\)\)/);
 assert.match(sql,/if p_purpose='verify_email' and c.channel<>'email' then return 'OTP_INVALID'/);
 assert.match(sql,/if \(p_purpose='login' or p_purpose='verify_email'\) and c.channel='email'/);
 assert.match(sql,/update public\.profiles set email_verified=true/);
 assert.match(sql,/if \(p_purpose='login' or p_purpose='verify_whatsapp'\) and c.channel='whatsapp'/);
});
test('profile offers Verify Email button and OTP phase',()=>{
 assert.match(form,/data-action="email-start"/);
 assert.match(form,/s\.phase==='email-otp'/);
 assert.match(frontend,/account\/email\/send/);
 assert.match(frontend,/account\/email\/verify/);
 assert.match(frontend,/state\.flash='accountEmailSuccess'/);
});
