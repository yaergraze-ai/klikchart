import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const ui=read('public/assets/dashboard/dashboard.js');
const app=read('backend/app.js');
const css=read('public/assets/dashboard/dashboard.css');
test('one account destination replaces three separate dashboard routes',()=>{
 assert.match(ui,/function account\(\)/);
 assert.match(ui,/const tabs=\[\['info','Profil saya'\],\['security','Keamanan'\],\['preferences','Preferensi'\],\['activity','Aktivitas'\]\]/);
 assert.match(ui,/href="#account"/);
 assert.doesNotMatch(ui,/href="\/app"/);
 assert.doesNotMatch(ui,/function profile\(\)|function security\(\)|function preferences\(\)/);
 assert.match(app,/res\.redirect\(302,'\/dashboard#account'\)/);
});
test('seller contacts can be verified inline without disabling OTP security',()=>{
 for(const key of ['accountAPI(channel+\'/send\'','data-form="contact-verify"','contact-send:','accountAPI(S.pendingContact.channel+\'/verify\''])assert.ok(ui.includes(key),key);
 for(const key of ['/api/account/email/send','/api/account/email/verify','/api/account/whatsapp/send','/api/account/whatsapp/verify'])assert.ok(app.includes(key),key);
 assert.match(app,/loginRequiresOTP:true/);
});
test('buyer storefront and admin share brand mark, destinations and design language',()=>{
 assert.match(ui,/const logo=`<svg/);
 assert.match(ui,/store-brand/);
 assert.match(ui,/brand-icon.*\$\{logo\}/);
 assert.match(ui,/const shoppingViews=new Set/);
 assert.match(css,/Klikchart v4\.5/);
 for(const cls of ['.account-hero','.account-tabs','.store-header','.top-context','.sidebar'])assert.ok(css.includes(cls),cls);
});
test('navigating routes does not repeat bootstrap requests',()=>{
 assert.match(ui,/function routeFromHash\(\)/);
 assert.match(ui,/window\.addEventListener\('hashchange',[\s\S]*?routeFromHash\(\)/);
 assert.match(ui,/Promise\.all\(\[api\('me'\).*api\('categories'\)/);
 assert.ok(ui.split("window.addEventListener('hashchange',")[1].split('\n')[0].includes('routeFromHash()')); 
});
test('v4.6 schema-free update and role guards remain intact',()=>{
 assert.match(read('package.json'),/"version": "4\.8\.1"/);
 assert.match(read('README.md'),/Tidak ada perubahan SQL dari v4\.4 → v4\.6/);
 assert.match(ui,/role\(\)!=='owner'&&next\.startsWith\('owner'\)/);
 assert.match(ui,/role\(\)==='buyer'&&next\.startsWith\('seller'\)/);
});
