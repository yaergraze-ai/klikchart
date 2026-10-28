import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL('../'+path, import.meta.url),'utf8');
const dashboard=read('public/assets/dashboard/dashboard.js');
const html=read('public/dashboard.html');
const css=read('public/assets/dashboard/ui-v50.css');

test('commerce uses one active stylesheet',()=>{
  const links=[...html.matchAll(/\/assets\/dashboard\/([\w.-]+\.css)/g)].map(m=>m[1]);
  assert.equal(links.at(-1),'commerce.css');
  assert.equal(links.length,1);
});
test('commerce cards have accessible wishlist, detail, stock, and cart actions',()=>{
  for(const key of ['kc-favorite','kc-product-title','view-product:','wishlist-add:','cart-add:','kc-atc-compact'])assert.ok(dashboard.includes(key),key);
  assert.match(dashboard,/Number\(p\.stock\)>0/);
  assert.match(dashboard,/Stok habis/);
  assert.match(css,/\.store-product-card \.product-buttons/);
});
test('catalog filters apply on submit, never on each field change',()=>{
  assert.match(dashboard,/id="kc-filter-form"/);
  assert.match(dashboard,/id="kc-filters" open/);
  assert.match(dashboard,/if\(e\.target\.id==='kc-filter-form'\)/);
  assert.match(dashboard,/S\.category=form\.elements\.category\.value/);
  assert.match(dashboard,/S\.minPrice=min/);
  assert.match(dashboard,/S\.sort=form\.elements\.sort\.value/);
  assert.doesNotMatch(dashboard,/getElementById\('cat-filter'\)\?\.addEventListener\('change'/);
});
test('search is a real accessible form; owner navigation exposes state',()=>{
  assert.match(dashboard,/role="search" id="kc-search-form"/);
  assert.match(dashboard,/if\(e\.target\.id==='kc-search-form'\)/);
  assert.match(dashboard,/aria-controls="sidebar"/);
  assert.match(dashboard,/aria-expanded="false"/);
});
test('mobile layout has full-width CTA and responsive non-overlapping controls',()=>{
  assert.match(css,/@media\(max-width:740px\)/);
  assert.match(css,/@media\(max-width:390px\)/);
  assert.match(css,/\.kc-atc-compact\{display:inline\}/);
  assert.match(css,/\.kc-filter-sheet>\.kc-filter-trigger\{display:flex/);
  assert.match(css,/\.store-bottom a\[aria-current="page"\]/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});
