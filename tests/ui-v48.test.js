import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const file = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const dashboard=file('public/assets/dashboard/dashboard.js');
const html=file('public/dashboard.html');
const auth=file('public/index.html');
const css=file('public/assets/dashboard/ui-v48.css');
const addressFields=['recipient','phone','province','city','postalCode','address'];

test('dashboard uses packaged SVG icons rather than emoji product placeholders',()=>{
  assert.match(dashboard,/const ico=key=>/);
  assert.doesNotMatch(dashboard,/🛍|🛒|📦|🏪|🏬/u);
  assert.match(dashboard,/ico\('package'\)/);
});

test('shipping address uses backend-compatible required fields',()=>{
  for(const key of addressFields) assert.match(dashboard,new RegExp("\\['"+key+"'"));
  assert.match(dashboard,/kc-address-form/);
  assert.match(dashboard,/inputmode','numeric'/);
  assert.match(dashboard,/pattern','\[0-9\]\{5\}'/);
});

test('destructive actions use custom confirmation dialogs',()=>{
  assert.match(dashboard,/async function confirmAction/);
  assert.match(dashboard,/confirmAction\('Hapus alamat'/);
  assert.doesNotMatch(dashboard,/\bwindow\.confirm\(/);
  assert.doesNotMatch(dashboard,/if\(!confirm\(/);
});

test('desktop and mobile styles and reduced motion assets are loaded',()=>{
  assert.match(css,/@media\(max-width:760px\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(html,/assets\/dashboard\/commerce\.css/);
  assert.match(html,/assets\/dashboard\/ui-v48\.js/);
  assert.match(auth,/assets\/css\/auth\.css/);
  assert.match(auth,/assets\/js\/ui\/auth-v48\.js/);
});
