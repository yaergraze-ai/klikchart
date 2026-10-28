import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
const api=read('backend/app.js');
const service=read('backend/services/marketplace.js');
const client=read('public/assets/dashboard/dashboard.js');
const css=read('public/assets/dashboard/storefront-v43.css');
const migration=read('supabase/migrations/UPGRADE_V4_1_TO_V4_4.sql');
test('v4.3 adds dedicated storefront without removing original console',()=>{
 assert.match(client,/function storeLayout/);
 assert.match(client,/function layout\(inner\)/);
 assert.match(client,/if\(isStore\(\)\)/);
 assert.match(client,/store-bottom/);
 assert.match(css,/@media\(max-width:740px\)/);
 assert.match(css,/\.store-main \.product-grid/);
});
test('buyer catalog supports category, search, sorting and price filtering',()=>{
 assert.match(client,/min-price/); assert.match(client,/max-price/);
 assert.match(client,/category-chip/);assert.match(client,/apply-price/);
 assert.match(service,/\.gte\('price'/);assert.match(service,/\.lte\('price'/);
 assert.match(service,/query\.ilike\('name'/);
});
test('seller photo upload requires a seller, file magic, secure storage prefix and short size',()=>{
 assert.match(api,/express\.raw\(\{type:\['image\/png','image\/jpeg','image\/webp'\],limit:'2mb'\}\)/);
 assert.match(service,/await seller\(req\)/);
 assert.match(service,/mimeByMagic\(bytes\)/);
 assert.match(service,/bytes\.length<=2\*1024\*1024/);
 assert.match(service,/crypto\.randomUUID\(\)/);
 assert.match(service,/storage\.from\('klikchart-products'\)\.upload/);
 assert.match(migration,/storage\.buckets/);
 assert.match(migration,/file_size_limit=2097152/);
});
test('product gallery is limited to six photos and accessible to shoppers',()=>{
 assert.match(service,/x\.length<=6/);
 assert.match(migration,/market_product_images_limit/);
 assert.match(client,/gallery-thumbs/);
 assert.match(client,/refreshPhotoPreviews/);
 assert.match(client,/uploadPhoto\(file\)/);
});
test('store catalog and reviews from PostgreSQL',()=>{
 assert.match(api,/\/api\/market\/shops\/:id/);
 assert.match(service,/export async function publicShop/);
 assert.match(migration,/market_product_rating/);
 assert.match(service,/rpc\('market_product_rating'/);
});
test('orders are paginated server-side for buyer seller and owner',()=>{
 assert.match(service,/export async function orders\(req\)/);
 assert.match(service,/\.range\(\(page-1\)\*size,page\*size-1\)/);
 assert.match(client,/orders-next/);
});
test('v4.3 requires additive migration 010 and retains 009 intact',()=>{
 assert.match(read('supabase/FRESH_DATABASE.sql'),/market_product_rating/);
 assert.match(read('supabase/FRESH_DATABASE.sql'),/market_owner_overview/);
 assert.match(migration,/ALTER TABLE public\.market_products/);
 assert.doesNotMatch(migration,/drop\s+table\s+(?!if\s+exists)/i);
 assert.match(read('package.json'),/"version": "4\.6\.0"/);
});
