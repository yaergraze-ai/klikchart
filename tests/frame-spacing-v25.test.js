import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/assets/css/v25-frame-spacing.css',import.meta.url),'utf8');
test('final Figma artwork stylesheet follows earlier theme overrides',()=>{
  const versions=[...html.matchAll(/\/assets\/css\/([\w.-]+\.css)/g)].map(x=>x[1]);
  assert.deepEqual(versions.slice(-4),['v30-legibility.css','v31-artwork-readable.css','v39-account-contacts.css','paper-flight.css']);
});
test('header/footer preserve centered navigation and symmetric 3-column structure',()=>{
  assert.match(css,/grid-template-columns:\s*minmax\(0,1fr\) auto minmax\(0,1fr\)/);
  assert.match(css,/\.header > nav\s*\{\s*justify-self:\s*center/);
  assert.match(css,/\.footer > \.footer-motto\s*\{\s*justify-self:\s*center/);
});
test('desktop footer and compact mobile have separate, accessible spacing',()=>{
  assert.match(css,/min-width:\s*761px/);
  assert.match(css,/max-width:\s*760px/);
  assert.match(css,/min-height:\s*28px/);
  assert.match(css,/max-height:\s*730px/);
});
test('the supplied SVG replaces the bag and frame alignment remains intact',()=>{
  assert.match(html,/klc-motion-art__image/);
  assert.doesNotMatch(html,/commerce-art__bag/);
  assert.match(html,/klikchart-figma-storefront-v31\.svg/);
});
