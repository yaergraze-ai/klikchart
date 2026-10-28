import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL('../'+path, import.meta.url),'utf8');
const original=read('design/reference/klikchart-line-transparent-original.svg');
const artwork=read('public/assets/images/klikchart-figma-storefront-v30.svg');
const html=read('public/index.html');
const css=read('public/assets/css/v30-legibility.css');
test('Figma artwork retains all original user vector paths and animation code',()=>{
 assert.match(original,/viewBox="0 0 760 900"/);
 assert.ok(artwork.includes('id="shopping-bag"'));
 assert.match(artwork, /id="Storefront_illustration"/);
 assert.match(artwork, /@keyframes kf_/);
 assert.match(artwork, /viewBox="305 470 485 440"/);
});
test('webpage uses only the original illustration, not the v2.8 invention',()=>{
 assert.match(html,/src="\/assets\/images\/klikchart-figma-storefront-v31\.svg"/);
 assert.doesNotMatch(html,/src="\/assets\/images\/klikchart-orbit-rebuilt\.svg"/);
 assert.match(html,/v31-artwork-readable\.css/);
 assert.match(css,/pointer-events:none/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});
