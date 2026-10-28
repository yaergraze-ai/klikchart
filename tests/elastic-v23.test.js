import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
test('exact Figma-authored SVG is displayed rather than legacy CSS bag',()=>{
 assert.match(html,/class="klc-motion-art"/);
 assert.match(html,/src="\/assets\/images\/klikchart-figma-storefront-v31\.svg"/);
 assert.doesNotMatch(html,/commerce-art__bag/);
 assert.equal(existsSync(new URL('../public/assets/images/klikchart-figma-storefront-v30.svg',import.meta.url)),true);
});
test('layout remains accessible after switching artwork',()=>{
 const newCss=readFileSync(new URL('../public/assets/css/v26-user-svg.css',import.meta.url),'utf8');
 const svg=readFileSync(new URL('../public/assets/images/klikchart-figma-storefront-v30.svg',import.meta.url),'utf8');
 assert.match(newCss,/pointer-events:none/);
 assert.match(newCss,/max-width:760px/);
 assert.match(svg,/@keyframes/);
 assert.match(readFileSync(new URL('../public/assets/css/v30-legibility.css',import.meta.url),'utf8'),/prefers-reduced-motion:reduce/);
 assert.match(html,/data-i18n="heroFirst"/);
 assert.match(html,/data-i18n="heroSecond"/);
});
