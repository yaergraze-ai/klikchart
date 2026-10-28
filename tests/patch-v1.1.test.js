import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const auth=read('../backend/services/auth.js');
const otp=read('../backend/services/otp.js');
const migration=read('../supabase/FRESH_DATABASE.sql');
const css=read('../public/assets/css/style.css');
const app=read('../public/assets/js/app.js');
test('Login WhatsApp first-enrollment follows password validation, not reset enrollment',()=>{
 assert.match(auth,/signInWithPassword/);
 assert.match(auth,/purpose==='login'\|\|user.whatsapp_verified/);
 assert.match(otp,/purpose==='reset'&&channel==='whatsapp'&&!user.whatsapp_verified/);
 assert.doesNotMatch(otp,/purpose==='login'&&channel==='whatsapp'&&!user.whatsapp_verified/);
});
test('Post-OTP ownership uses atomic migration, unique phone safeguards, and unchanged recovery',()=>{
 assert.match(migration,/for update/);
 assert.match(migration,/p_purpose='login' and c.channel='whatsapp'/);
 assert.match(migration,/set whatsapp_verified=true/);
 assert.match(migration,/exception when unique_violation/);
 assert.match(migration,/set consumed_at=now\(\)/);
 assert.match(migration,/return 'PHONE_TAKEN'/);
});
test('Intrinsic card height prevents feedback jitter; small viewports still scroll contents',()=>{
 assert.match(css,/Klikchart v1\.4 - stable intrinsic sizing/);
 assert.match(css,/overflow-y: auto/);
 assert.doesNotMatch(app,/card\.animate\(\[/);
 assert.doesNotMatch(app,/ResizeObserver\(/);
 assert.doesNotMatch(app,/scheduleFit\(/);
 assert.doesNotMatch(app,/card\.style\.height\s*=/);
});
