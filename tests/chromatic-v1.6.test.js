import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root),'utf8');
const html = read('public/index.html');
const css = read('public/assets/css/style.css');
const js = read('public/assets/js/ui/motion.js');

test('Animated illustration is separate from functional auth UI',()=>{
  assert.match(html,/class="klc-motion-art"/);
  assert.doesNotMatch(html,/klikchart-elastic-store\.svg/);
  assert.match(html,/id="auth-content"/);
  assert.doesNotMatch(html,/class="hero-constellation"/);
  assert.doesNotMatch(html,/class="hero-bag"/);
  assert.match(html,/aria-hidden="true"/);
});
test('Chromatic motion leaves inputs usable and respects accessibility preferences',()=>{
  for(const cls of ['klc-bubble-float','klc-spark-twinkle','klc-type-spectrum','klc-sigil-spin'])assert.ok(css.includes(cls),cls);
  assert.match(css,/\.hero-constellation\{[^}]*pointer-events:none/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/\.page-hidden \.color-mist/);
  assert.match(css,/max-width:380px/);
  assert.match(css,/max-height:650px/);
});
test('Mouse spotlight is event-driven and does not constantly animate layout',()=>{
  assert.match(js,/export function setupCardSpotlight/);
  assert.match(js,/requestAnimationFrame/);
  assert.match(js,/pointer:fine/);
  assert.doesNotMatch(js,/setInterval/);
});
