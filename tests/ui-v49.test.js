import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=file('public/dashboard.html');
const css=file('public/assets/dashboard/ui-v49.css');
const js=file('public/assets/dashboard/ui-v49.js');
test('responsive v4.9 styles and table labelling scripts are included',()=>{
 assert.match(html,/\/assets\/dashboard\/commerce\.css/);
 assert.match(html,/\/assets\/dashboard\/ui-v49\.js/);
 assert.match(js,/MutationObserver/);
 assert.match(js,/data-column-label/);
});
test('mobile management tables display all fields without horizontal scrolling',()=>{
 assert.match(css,/\.data-table thead\s*\{display:none\}/);
 assert.match(css,/\.data-table tbody tr\s*\{display:block/);
 assert.match(css,/data-column-label/);
 assert.match(css,/grid-template-columns:1fr/);
});
test('storefront, address, account and cart have responsive layout contracts',()=>{
 assert.match(css,/\.store-main \.product-grid/);
 assert.match(css,/\.kc-address-form \.form-grid/);
 assert.match(css,/\.account-hero-v46 \.account-identity/);
 assert.match(css,/\.store-shell \.panel \.flow:has\(\.mini-art\)/);
 assert.match(css,/@media\(max-width:740px\)/);
 assert.match(css,/@media\(max-width:350px\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});
