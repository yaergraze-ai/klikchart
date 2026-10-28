import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=x=>readFileSync(new URL(x,import.meta.url),'utf8');
const html=read('../public/index.html');
const css=read('../public/assets/css/v20-polish.css');
const app=read('../public/assets/js/app.js');
const motion=read('../public/assets/js/ui/motion.js');

test('Redundant image + welcome thumbnail are absent from real HTML',()=>{
 assert.doesNotMatch(html,/class="project-chip"/);
 assert.doesNotMatch(html,/class="chip-art"/);
 assert.match(html,/v20-polish\.css/);
});
test('Hero typography no longer reacts to pointer position',()=>{
 assert.doesNotMatch(app,/setupParallax\(\)/);
 assert.doesNotMatch(motion,/pointermove[^\n]+--mouse-x|style\.setProperty\('--mouse-x'/);
 assert.match(css,/\.intro\{translate:none!important;/);
});
test('Mobile layouts preserve scroll-free flows and short-screen fallback',()=>{
 for(const stage of ['register-two','forgot-new'])assert.ok(css.includes(stage));
 assert.match(css,/data-auth-stage\$="-otp"/);
 assert.match(css,/overscroll-behavior:none/);
 assert.match(css,/klc-mobile-tight \.auth-card \.auth-content\{overflow-y:auto/);
 assert.match(app,/fitMobileStage\(\)/);
});
test('Form animation only fades, without card geometry animation',()=>{
 assert.match(app,/duration:145/);
 assert.doesNotMatch(app,/card\.animate\(/);
 assert.match(css,/klc-view-enter :is\(h2,/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});
