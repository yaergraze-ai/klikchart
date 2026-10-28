import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const svg=read('public/assets/images/klikchart-figma-storefront-v31.svg');
const html=read('public/index.html');
const css=read('public/assets/css/v31-artwork-readable.css');
test('v3.1 displays its own original-Figma-geometry artwork source',()=>{
 assert.match(html,/src="\/assets\/images\/klikchart-figma-storefront-v31\.svg"/);
 assert.match(html,/auth\.css/);
 assert.match(svg,/id="Storefront_illustration"/);
 assert.match(svg,/id="shopping-bag"/);
 assert.match(svg,/@keyframes kf_/);
 assert.match(svg,/viewBox="300 490 470 415"/);
});
test('all five promo labels have readable vector typography and safe badge backgrounds',()=>{
 for(const label of ['Pilihan terbaik','SALE','Gratis','50% OFF','Cashback']) assert.ok(svg.includes('>'+label+'</text>'),label);
 for(const size of ['14.6','14.7','14.5','14.2']) assert.ok(svg.includes('font-size="'+size+'"'));
 for(const badge of ['Price_badge','Flash_sale_badge','Free_shipping_badge','Promo_pill_____diskon','Promo_pill_____cashback']){
  assert.ok(svg.includes('layout_readable_'+badge),badge);
 }
 assert.match(svg,/fill-opacity="0\.98"/);
});
test('art never captures clicks, does not force mobile scroll and respects reduced motion',()=>{
 assert.match(css,/pointer-events:none/);
 assert.match(css,/max-width:760px/);
 assert.match(css,/display:none!important/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});
