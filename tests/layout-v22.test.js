import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/assets/css/v23-elastic-layout.css',import.meta.url),'utf8');
const js=readFileSync(new URL('../public/assets/js/app.js',import.meta.url),'utf8');
test('v2.3 uses a single last-loaded layout authority with a shared 3-column alignment',()=>{
 assert.match(html,/v23-elastic-layout\.css/);
 assert.ok(html.indexOf('v23-elastic-layout.css')>html.indexOf('v20-polish.css'));
 assert.doesNotMatch(html,/href="\/assets\/css\/v22-layout\.css"/);
 for(const k of ['.header,.main,.footer','grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)','--klc-side-gutter']) assert.ok(css.includes(k),k);
});
test('hero text uses a stable left axis and SVG illustration a separate box',()=>{
 assert.match(html,/class="klc-motion-art"/);
 assert.doesNotMatch(html,/class="hero-bag"/);
 assert.match(html,/v26-user-svg\.css/);
 assert.match(css,/\.hero-type h1 \.hero-line:last-child\{[^}]*margin:4px 0 0!important/);
 assert.match(css,/pointer-events:none/);
});
test('mobile fallback scroll remains reachable when keyboard makes screen small',()=>{
 assert.match(css,/body\.klc-mobile-tight \.auth-card \.auth-content\{overflow-y:auto/);
 assert.match(css,/overflow:hidden/);
 assert.match(js,/aria-current/);
});
