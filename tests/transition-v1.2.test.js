import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app = readFileSync(new URL('../public/assets/js/app.js',import.meta.url),'utf8');
const css = readFileSync(new URL('../public/assets/css/style.css',import.meta.url),'utf8');

test('Auth transitions render immediately without awaited exit animation',()=>{
  const start = app.indexOf('function paint(');
  const end = app.indexOf('function stopCountdown()',start);
  assert.ok(start>0 && end>start);
  const paint=app.slice(start,end);
  assert.match(paint,/content\.innerHTML=`<div class=\"auth-view\">/);
  assert.doesNotMatch(paint,/\bawait\b/);
  assert.doesNotMatch(paint,/await .*finished/);
  assert.match(paint,/duration:145/);
  assert.match(paint,/reduceMotion\(\)/);
  assert.match(app,/contentAnimation\?\.cancel\(\)/);
});

test('Card size follows form intrinsically, without repeated forced height writes',()=>{
 assert.match(app,/Stable intrinsic height/);
 assert.doesNotMatch(app,/heightAnimation=card\.animate/);
 assert.match(css,/\.main \.auth-card \{[\s\S]*?height: auto;/);
 assert.match(css,/\.auth-card \.auth-content \{[\s\S]*?flex: 0 1 auto;/);
 assert.match(css,/\.auth-view\{display:flow-root/);
 assert.doesNotMatch(app,/new ResizeObserver\(/);
});
