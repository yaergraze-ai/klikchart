import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
const js=readFileSync(new URL('../public/assets/dashboard/dashboard.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/dashboard.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/assets/dashboard/ui-v47.css',import.meta.url),'utf8');
test('v4.7 uses common responsive UI stylesheet and reduced motion',()=>{
 assert.match(html,/ui-v47\.css/);
 assert.match(css,/prefers-reduced-motion/);
 assert.match(css,/max-width:520px/);
});
test('profile password visibility never uses an invalid CSS selector',()=>{
 assert.doesNotMatch(js,/label\[for=\+el\.id\+\]/);
 assert.match(js,/el\.labels\?\.\[0\]/);
});
test('profile header and unified security keep separate OTP verification',()=>{
 assert.match(js,/const profilePopup=/);
 assert.match(js,/account-shortcut:security/);
 assert.match(js,/contact-send:/);
});
test('checkout discloses COD, item totals, shipping, confirmation and server authority',()=>{
 assert.match(js,/Konfirmasi pesanan COD/);
 assert.match(js,/checkout-total/);
 assert.match(js,/name="confirmed" required/);
 assert.match(js,/dihitung ulang oleh server/);
});
test('modal has accessible name, restores focus and traps keyboard tab',()=>{
 assert.match(js,/aria-labelledby="dialog-title"/);
 assert.match(js,/dialogReturnFocus\.focus/);
 assert.match(js,/event\.key!=='Tab'/);
});
test('image fails gracefully and route change resets stale scroll',()=>{
 assert.match(js,/product-image-fallback/);
 assert.match(js,/image\.closest\('\.product-image-frame'\)/);
 assert.match(js,/viewChanged.*window\.scrollTo/);
});
