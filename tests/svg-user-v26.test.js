import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=x=>readFileSync(new URL(x,import.meta.url),'utf8');
const html=read('../public/index.html');
const css=read('../public/assets/css/v26-user-svg.css');
const original=read('../design/reference/klikchart-line-transparent.svg');
const svg=read('../public/assets/images/klikchart-figma-storefront-v30.svg');
test('Figma illustration is user-supplied SVG without CSS bag',()=>{
 assert.match(html,/src="\/assets\/images\/klikchart-figma-storefront-v31\.svg"/);
 assert.doesNotMatch(html,/commerce-art__bag|commerce-art__ticket/);
 assert.doesNotMatch(html,/href="\/assets\/css\/v24-commerce-motion\.css"/);
});
test('Figma-derived SVG retains source geometry with cropped viewport',()=>{
 assert.match(original,/viewBox="0 0 760 900"/);
 assert.match(svg,/viewBox="305 470 485 440"/);
 for(const id of ['Storefront_illustration','shopping-bag','Card_star'])assert.ok(svg.includes(id), id);
 assert.match(svg,/@keyframes kf_/);assert.match(svg,/Storefront_illustration/);
 assert.match(read('../public/assets/css/v30-legibility.css'),/prefers-reduced-motion:reduce/);
 assert.ok(svg.length>600000, 'Figma vector geometry and motion tracks must be preserved');
});
test('SVG art cannot intercept clicks or cause page layout scroll',()=>{
 assert.match(css,/position:absolute/);
 assert.match(css,/pointer-events:none/);
 assert.match(css,/max-width:760px/);
 assert.match(css,/body\.klc-mobile-focus \.klc-motion-art/);
 assert.ok(html.lastIndexOf('v26-user-svg.css')>html.lastIndexOf('v25-frame-spacing.css'));
});
