import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const css=readFileSync(new URL('../public/assets/css/style.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
test('v1.8 restores lavender/purple accents instead of the cyan palette',()=>{
  assert.match(css,/KLIKCHART v1\.8 — Lilac First/);
  assert.match(css,/--klc-teal:#cbb3ed/);
  assert.match(css,/\.primary-button\{background:linear-gradient\(105deg,#dbbdf3,#cbb3ed/);
  assert.doesNotMatch(css,/#93eadf|#7cece3|#8eece8|#7ae5ea|#4dcbd2/i);
  assert.doesNotMatch(html,/#7ae5ea|#80eddf|#7cece3/i);
});
test('v1.8 uses viewport-adaptive desktop spacing without cropping content',()=>{
  assert.match(css,/@media \(min-width:761px\) and \(max-height:820px\)/);
  assert.match(css,/\.main\{min-height:0;padding:clamp\(5px,1\.1dvh,10px\)/);
  assert.match(css,/\.auth-card \.input-wrap input\{height:44px/);
  assert.match(css,/\.auth-card \.field\{margin-bottom:9px/);
  assert.match(css,/\.auth-card \.auth-content\{scrollbar-width:none/);
});
