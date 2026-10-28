import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
// Isolate the pure URL policy for unit tests even when npm packages are unavailable.
const guardSource=readFileSync(new URL('../backend/middleware/guard.js',import.meta.url),'utf8');
const segment=guardSource.slice(guardSource.indexOf('export function allowedRequestOrigins'),guardSource.indexOf('export function requireOrigin'));
const allowedRequestOrigins=runInNewContext(segment.replace('export function ','function ')+ '\nallowedRequestOrigins', {URL,Set,String});

const conf=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
test('Vercel routes /app through Express instead of stale login page',()=>{
 assert.equal(conf.rewrites.find(r=>r.source==='/app')?.destination,'/api/index.js');
 assert.equal(conf.rewrites.find(r=>r.source==='/api/:path*')?.destination,'/api/index.js');
});
test('Vercel preview and production origins are explicitly allowed',()=>{
 const origins=allowedRequestOrigins({NODE_ENV:'production',APP_URL:'https://klikchart.com',VERCEL:'1',VERCEL_URL:'klikchart-git-test-user.vercel.app'});
 assert.deepEqual([...origins].sort(),['https://klikchart-git-test-user.vercel.app','https://klikchart.com'].sort());
});
test('untrusted domains and invalid URL are not automatically trusted',()=>{
 const origins=allowedRequestOrigins({NODE_ENV:'production',APP_URL:'oops!',VERCEL:'1',VERCEL_URL:'evil.example.net'});
 assert.equal(origins.size,0);
});
test('http allowed locally, never trusted as production origin',()=>{
 assert.equal(allowedRequestOrigins({NODE_ENV:'development',APP_URL:'http://localhost:3000'}).has('http://localhost:3000'),true);
 assert.equal(allowedRequestOrigins({NODE_ENV:'production',APP_URL:'http://localhost:3000'}).size,0);
});
test('Vercel does not require checked-in secrets',()=>{
 const ignore=readFileSync(new URL('../.gitignore',import.meta.url),'utf8');
 assert.match(ignore,/^\.env$/m);
 const manifest=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8'));
 assert.equal(manifest.version,'4.6.1');
});
