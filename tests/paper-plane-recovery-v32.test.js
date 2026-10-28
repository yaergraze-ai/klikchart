import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=file=>readFileSync(new URL(file,import.meta.url),'utf8');
test('paper plane enters brand icon with fading trailing segments and reduced motion',()=>{
 const motion=src('../public/assets/js/ui/paper-flight.js');
 const css=src('../public/assets/css/paper-flight.css');
 const page=src('../public/index.html');
 assert.match(motion,/logoIcon\.getBoundingClientRect/);
 assert.match(motion,/trailAge=920/);
 assert.match(motion,/requestAnimationFrame/);
 assert.match(motion,/layer\.remove\(\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(page,/paper-flight-layer/);
});
test('unverified WhatsApp recovery requires a verified email OTP as second factor',()=>{
 const auth=src('../backend/services/auth.js');
 const otp=src('../backend/services/otp.js');
 const migration=src('../supabase/FRESH_DATABASE.sql');
 assert.match(auth,/pendingWaRecovery/);
 assert.match(auth,/reset_email_check/);
 assert.match(auth,/additionalVerification:true/);
 assert.match(otp,/allowUnverifiedWhatsApp/);
 assert.match(migration,/reset_email_check/);
});
