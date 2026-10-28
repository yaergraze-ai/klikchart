import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=f=>readFileSync(new URL(f,import.meta.url),'utf8');
const api=read('../backend/app.js');
const auth=read('../backend/services/auth.js');
const otp=read('../backend/services/otp.js');
const sql=read('../supabase/FRESH_DATABASE.sql');
const js=read('../public/assets/js/app.js');
const forms=read('../public/assets/js/ui/forms.js');
const svg=read('../public/assets/images/klikchart-figma-storefront-v30.svg');
const original=read('../design/reference/klikchart-line-transparent.svg');
const html=read('../public/index.html');
test('account channel verification endpoints require session and rate limit',()=>{
 assert.match(api,/account\/whatsapp\/send/);assert.match(api,/account\/whatsapp\/verify/);
 assert.match(auth,/const session=await readSession\(req\)/);
 assert.match(auth,/const user=await requireAccount\(req\)/);
 assert.match(api,/limited\('account_wa_send',5,900\)/);
 assert.match(api,/limited\('account_wa_verify',12,900\)/);
});
test('only persisted account phone may receive OTP and reset still requires verified contact',()=>{
 assert.match(auth,/if\(!configured\('whatsapp'\)\|\|!user.phone\)/);
 assert.match(auth,/purpose:'verify_whatsapp',channel:'whatsapp'/);
 assert.match(auth,/eq\('purpose','verify_whatsapp'\)/);
 assert.match(otp,/purpose==='reset'&&channel==='whatsapp'&&!user.whatsapp_verified/);
 assert.doesNotMatch(auth,/auth\.admin\.updateUserById\(id,\{phone/);
});
test('account OTP is checked atomically in SQL without relaxing other purposes',()=>{
 assert.match(sql,/BEGIN;/);assert.match(sql,/verify_whatsapp/);assert.match(sql,/for update/);
 assert.match(sql,/c\.attempts >= 5/);assert.match(sql,/c\.expires_at <= now\(\)/);
 assert.match(sql,/set whatsapp_verified=true/);assert.match(sql,/exception when unique_violation/);
 assert.match(sql,/update public\.otp_challenges set consumed_at=now\(\)/);
 assert.match(sql,/GRANT EXECUTE .* TO service_role/);
});
test('UI renders verification inside account, with OTP submit and status update',()=>{
 assert.match(forms,/data-action="wa-start"/);assert.match(forms,/accountWANotVerified/);
 assert.match(js,/api\('account\/whatsapp\/send'/);assert.match(js,/api\('account\/whatsapp\/verify'/);
 assert.match(js,/state\.waChallengeId=result\.challengeId/);
 assert.match(js,/const me=await api\('me'\)/);
});
test('Figma-authored asset uses a cropped viewport while retaining original source',()=>{
 assert.match(original,/viewBox="0 0 760 900"/);
 assert.match(svg,/viewBox="305 470 485 440"/);
 assert.match(svg,/@keyframes kf_/);
 assert.match(html,/v30-legibility\.css/);
 assert.match(read('../public/assets/css/v30-legibility.css'),/pointer-events:none/);
});
