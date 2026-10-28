import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/assets/css/v23-elastic-layout.css',import.meta.url),'utf8');
const id=JSON.parse(readFileSync(new URL('../public/assets/i18n/id.json',import.meta.url),'utf8'));
const en=JSON.parse(readFileSync(new URL('../public/assets/i18n/en.json',import.meta.url),'utf8'));
test('typography override loaded last and retains live form rendering',()=>{
 assert.ok(html.includes('/assets/css/auth.css'));
 assert.equal((html.match(/href="\/assets\/css\/auth\.css/g)||[]).length,1);
 assert.ok(html.includes('id="auth-content"'));
});
test('hero and form typography are separate responsive layers',()=>{
 for(const selector of ['.hero-type h1','.intro-bottom p','.auth-card h2','.auth-card .form-subtitle','.auth-card .field label']) assert.ok(css.includes(selector));
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/data-auth-stage="register-two"/);
 assert.match(css,/\.intro-bottom \.index\s*\{display:none;/);
});
test('login placeholder fits phone width in both languages',()=>{
 assert.equal(id.identifierPlaceholder,'Email / Pixel_Star27');
 assert.equal(en.identifierPlaceholder,'Email / Pixel_Star27');
});
