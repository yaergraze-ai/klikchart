import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = f => readFileSync(new URL('../'+f,import.meta.url),'utf8');
const html = read('public/index.html');
const css = read('public/assets/css/v30-legibility.css');
const svg = read('public/assets/images/klikchart-figma-storefront-v30.svg');
test('Figma storefront uses an unclipped safe viewBox and actual source geometry',()=>{
 assert.match(svg,/viewBox="305 470 485 440"/);
 for(const id of ['Storefront_illustration','Storefront_base','shopping-bag','Item_chip_____fashion','Orbit_arc'])assert.ok(svg.includes('id="'+id+'"'),id);
 assert.match(svg,/@keyframes kf_/);
 assert.doesNotMatch(svg,/id="Silk_sweep"/);
});
test('decorative chip labels are readable vector text rather than microscopic outlines',()=>{
 for(const word of ['Pilihan terbaik','SALE','50% OFF','Cashback','Gratis']) assert.ok(svg.includes(word),word);
 assert.match(svg,/font-size="8/);
});
test('illustration stays out of responsive form and maintains text contrast',()=>{
 assert.match(html,/klikchart-figma-storefront-v31.svg/);
 assert.match(css,/max-width:760px\)\{ \.klc-motion-art\{display:none!important/);
 assert.match(css,/pointer-events:none/);
 assert.match(css,/intro-bottom p\{color:#f0e4f7/);
});
