import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const css=readFileSync(new URL('public/assets/css/style.css',root),'utf8');
const app=readFileSync(new URL('public/assets/js/app.js',root),'utf8');
test('mobile page is viewport locked but keeps inner-card keyboard fallback',()=>{
 assert.match(css,/html,body\{height:100%;height:100dvh;overflow:hidden;overscroll-behavior:none;\}/);
 assert.match(css,/\.main \.auth-card \.auth-content\{min-height:0;overscroll-behavior:contain;\}/);
 assert.match(css,/\.auth-card \.auth-content\s*\{\s*flex: 0 1 auto;[\s\S]*?overflow-y: auto;/);
});
test('long auth stages use layout classes without altering authorization flows',()=>{
 assert.match(app,/document\.body\.dataset\.authLayout/);
 assert.match(app,/document\.body\.dataset\.authStage/);
 assert.match(css,/body\[data-auth-layout="dense"\] \.intro\{display:none;\}/);
 assert.match(css,/\(min-height:760px\)/);
});
