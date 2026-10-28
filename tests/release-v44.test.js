import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const names=directory=>readdirSync(new URL('../'+directory,import.meta.url));

// Release contract: a new installer shouldn't need to guess which historic SQL/README to execute.
test('one main README and only three documented SQL entrypoints remain',()=>{
 assert.deepEqual(names('.').filter(x=>x.endsWith('.md')),['README.md']);
 assert.deepEqual(names('supabase').filter(x=>x.endsWith('.sql')).sort(),['FRESH_DATABASE.sql','OWNER_BOOTSTRAP.sql']);
 assert.deepEqual(names('supabase/migrations').filter(x=>x.endsWith('.sql')),['UPGRADE_V4_1_TO_V4_4.sql']);
 for(const path of ['FRESH_DATABASE.sql','OWNER_BOOTSTRAP.sql','migrations/UPGRADE_V4_1_TO_V4_4.sql'])assert.ok(read('supabase/'+path).length>300);
});

test('fresh database and upgrade include latest account, commerce, and photo schema',()=>{
 const fresh=read('supabase/FRESH_DATABASE.sql');
 const upgrade=read('supabase/migrations/UPGRADE_V4_1_TO_V4_4.sql');
 for(const name of ['market_owner_overview','market_seller_overview','market_checkout','market_product_rating','market_user_settings','market_site_settings','klikchart-products'])assert.match(fresh,new RegExp(name));
 for(const name of ['market_owner_overview','market_seller_overview','market_product_rating','market_user_settings','market_site_settings','klikchart-products'])assert.match(upgrade,new RegExp(name));
 assert.match(upgrade,/BEGIN;/);assert.match(upgrade,/COMMIT;/);
 assert.doesNotMatch(upgrade,/drop\s+table|truncate\s+|delete\s+from\s+auth\.users/i);
});

test('user and owner product lists are paged in backend and both dashboards',()=>{
 const backend=read('backend/services/marketplace.js');
 const client=read('public/assets/dashboard/dashboard.js');
 for(const list of ['sellerProducts','ownerProducts']){
  assert.match(backend,new RegExp('export async function '+list+'\\(req\\)[\\s\\S]*?\\.range\\(\\(page-1\\)\\*size,page\\*size-1\\)'));
 }
 for(const key of ['seller-products-prev','seller-products-next','owner-products-prev','owner-products-next'])assert.ok(client.includes(key));
 assert.match(client,/if\(v==='product'&&S\.productId\)p\.detail=await api\('products\/'/);
 assert.doesNotMatch(client,/if\(v==='home'\|\|v==='product'\|\|v==='shop'\)/);
});

test('private API responses are not cached and role enforcement stays server-side',()=>{
 const app=read('backend/app.js'),backend=read('backend/services/marketplace.js');
 assert.match(app,/Cache-Control','no-store, max-age=0'/);
 assert.match(backend,/requireRole\(req,\['owner'\]\)/);
 assert.match(backend,/await seller\(req\)/);
 assert.match(read('package.json'),/"version": "4\.7\.0"/);
});

test('README documents paths for existing and empty Supabase projects and actual COD limitations',()=>{
 const doc=read('README.md');
 for(const phrase of ['FRESH_DATABASE.sql','UPGRADE_V4_1_TO_V4_4.sql','OWNER_BOOTSTRAP.sql','Supabase','npm.cmd run dev','COD','Vercel'])assert.ok(doc.includes(phrase),phrase);
});
