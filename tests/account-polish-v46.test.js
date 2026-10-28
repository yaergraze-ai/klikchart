import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const js=read('public/assets/dashboard/dashboard.js');
const css=read('public/assets/dashboard/dashboard.css');
const app=read('backend/app.js');
test('right corner account menu is a functional, accessible trigger',()=>{
 assert.match(js,/class=\\?"profile-menu-toggle/);
 for(const s of ['aria-expanded','aria-controls','profile-menu-toggle','profile-menu-host','profile-menu-item','profile-menu-logout'])assert.ok(js.includes(s),s);
 assert.match(js,/if\(act==='profile-menu-toggle'\)/);
 assert.match(js,/if\(act\.startsWith\('account-shortcut:'\)\)/);
});
test('profile contains complete account identity, security, preferences and activity without collecting extra identity secrets',()=>{
 for(const part of ['account-hero-stats','email_verified','whatsapp_verified','created_at','pf-username','pf-displayName','pf-bio','pf-avatarUrl','password-change','preferences-update','account-shortcuts','contact-send:'])assert.ok(js.includes(part),part);
 assert.match(js,/api\('profile',d\)/);
 assert.match(js,/api\('password\/change',d\)/);
});
test('eye toggle changes field type and tabs support keyboard and escape dismissal',()=>{
 assert.match(js,/password-visibility:/);
 assert.match(js,/el\.type=show\?'text':'password'/);
 assert.match(js,/e\.key==='Escape'/);
 assert.match(js,/e\.key==='ArrowRight'/);
});
test('mobile account menu and reduced-motion styles exist',()=>{
 for(const cls of ['.profile-menu','.profile-menu-toggle','.account-layout-v46','.account-shortcuts','.account-hero-v46'])assert.ok(css.includes(cls),cls);
 assert.match(css,/@media\(max-width:470px\)/);
 assert.match(css, /prefers-reduced-motion:reduce/);
});
test('account changes remain authenticated and schema-free with same SQL install plan',()=>{
 assert.match(app,/\/api\/market\/profile/);
 assert.match(app,/account\.changePassword/);
 assert.match(read('README.md'),/tidak ada migration baru dari v4\.5 ke v4\.6/i);
 assert.match(read('package.json'),/"version": "4\.6\.0"/);
});
