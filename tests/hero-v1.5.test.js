import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path,root),'utf8');
const html=read('public/index.html');
const css=read('public/assets/css/style.css');

test('User supplied SVG illustration is isolated; hero text stays semantic',()=>{
 assert.match(html,/class="klc-motion-art"/);
 assert.match(html,/id="auth-content"/);
 assert.match(html,/data-i18n="heroFirst"/);
 assert.match(html,/data-i18n="heroSecond"/);
 assert.doesNotMatch(html,/hero-orbit-traveler--secondary/);
});
test('Compositor-friendly autonomous motion and reduced-motion fallback',()=>{
 assert.match(css,/offset-path:ellipse\(/);
 assert.match(css,/@keyframes klc-orbit-star/);
 assert.match(css,/@keyframes klc-bag-float/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/\.page-hidden \.hero-orbit-traveler/);
 assert.match(css,/\.page-hidden \.brand svg/);
});
test('Responsive mobile and tablet preserve text controls and accessibility',()=>{
 assert.match(css,/max-width:380px\) and \(max-height:600px/);
 assert.match(css,/min-width:761px\) and \(max-width:900px\) and \(orientation:portrait/);
 assert.match(css,/\.hero-bag\{display:none;\}/);
 assert.match(css,/\.brand svg\{transform-origin/);
 assert.match(html,/aria-hidden="true"/);
});
