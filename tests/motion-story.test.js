import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL(path,import.meta.url),'utf8');
const html = read('../public/index.html');
const css = read('../public/assets/css/motion-story.css');
const code = read('../public/assets/js/ui/hero-motion.js');
const app = read('../public/assets/js/app.js');

test('Provided animated SVG ornament is used without embedding iframe',()=>{
 assert.doesNotMatch(html,/klikchart-elastic-store\.svg/);
 assert.match(html,/class="klc-motion-art"/);
 assert.match(html,/motion-story\.css/);
 assert.doesNotMatch(html,/<iframe/);
 assert.doesNotMatch(html,/class="hero-bag"/);
 assert.match(css,/klc-view-enter/);
});
test('Hero entrance is one-shot; looping content only decorates; reduced motion honored',()=>{
 assert.match(code,/reduced\.matches/);
 assert.match(code,/classList\.add\('klc-motion-on'\)/);
 assert.match(css,/\.klc-motion-on \.hero-line:first-child/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/klc-motion-paused/);
 assert.doesNotMatch(code,/setInterval|ResizeObserver|innerHTML|fetch\(/);
});
test('Existing authentication routes and API calls remain unchanged',()=>{
 assert.match(app,/import \{setupHeroMotion\} from '\.\/ui\/hero-motion\.js';/);
 assert.match(app,/setupHeroMotion\(\);/);
 assert.match(app,/register\/otp\/verify/);
 assert.match(app,/login\/otp\/verify/);
 assert.match(app,/forgot\/verify/);
 assert.match(css,/\.klc-view-enter \.primary-button/);
});
