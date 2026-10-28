import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const sql=read('supabase/FRESH_DATABASE.sql');
const server=read('backend/app.js');
const backend=read('backend/services/marketplace.js');
const page=read('public/dashboard.html');
const ui=read('public/assets/dashboard/dashboard.js');
const css=read('public/assets/dashboard/dashboard.css');
const upgrade=read('README.md');

test('marketplace has three roles and seller role cannot be self-assigned',()=>{
 assert.match(sql,/role in \('buyer','seller','owner'\)/);
 assert.match(backend,/requireRole\(req,\['owner'\]\)/);
 assert.match(backend,/SELLER_CONTACTS_REQUIRED/);
 assert.match(sql,/market_review_seller/);
 assert.match(sql,/if not exists \(select 1 from public\.market_roles where user_id=p_actor and role='owner'\)/);
 assert.doesNotMatch(ui,/service_role|SUPABASE_SERVICE_ROLE_KEY/);
});
test('marketplace schema is additive, RLS-protected, and with locked checkout transaction',()=>{
 for(const table of ['market_roles','market_seller_applications','market_shops','market_categories','market_products','market_cart_items','market_addresses','market_orders','market_order_items','market_wishlists','market_reviews']){
  assert.match(sql,new RegExp(`create table if not exists public\\.${table}`));
 }
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all on public\.%I from anon, authenticated/);
 assert.match(sql,/where user_id=p_buyer order by product_id for update/);
 assert.match(sql,/for update of p/);
 assert.match(sql,/delete from public\.market_cart_items where user_id=p_buyer/);
 assert.match(sql,/raise exception 'OUT_OF_STOCK'/);
 assert.match(sql,/if p_next='canceled' then[\s\S]*stock=stock\+l\.quantity/);
});
test('server routes include real buyer, seller, and owner operations',()=>{
 for(const endpoint of ["'/api/market/me'","'/api/market/products'","'/api/market/cart'","'/api/market/addresses'","'/api/market/checkout'","'/api/market/orders'","'/api/market/reviews'","'/api/market/seller/apply'","'/api/market/seller/products'","'/api/market/seller/stats'","'/api/market/owner/stats'","'/api/market/owner/applications'","'/api/market/owner/shops/:id/status'","'/api/market/owner/categories'"]){assert.ok(server.includes(endpoint),endpoint)}
 assert.match(server,/limited\('market_checkout',8,3600\)/);
 assert.match(server,/app\.use\('\/api',requireOrigin\)/);
});
test('dashboard uses live marketplace API and never fabricates fake purchases',()=>{
 assert.match(page,/name="viewport"/);
 assert.match(ui,/fetch\('\/api\/market\/'/);
 assert.match(ui,/S\.me=await api\('me'\)/);
 for(const page of ['sellerHome','ownerHome','home','orders','addresses','wishlist','sellerProducts'])assert.ok(ui.includes(page));
 assert.match(ui,/money\(d\.grossOrders\|\|0\)/);
 assert.doesNotMatch(ui,/DATA DEMONSTRASI|const demoOrders|Math\.random\(\).*revenue/i);
 assert.match(css,/@media\(max-width:740px\)/);
 assert.match(css,/@media\(max-width:370px\)/);
});
test('COD cannot be confused with payment gateway and owner privilege requires manual SQL',()=>{
 assert.match(sql,/payment_method text not null default 'cod' check\(payment_method='cod'\)/);
 assert.match(sql,/seller_reported_collected/);
 assert.match(ui,/Pembayaran dilakukan saat barang diterima/);
 assert.match(ui,/Pembayaran online, kurir otomatis dan refund tetap membutuhkan integrasi pihak ketiga/);
 assert.match(upgrade,/OWNER_BOOTSTRAP\.sql/);
 assert.match(read('supabase/OWNER_BOOTSTRAP.sql'),/OWNER_EMAIL_HERE/);
 assert.doesNotMatch(server,/owner\/register|promote\/owner/);
});
test('login OTP redirects to role-aware dashboard with one account destination',()=>{
 const auth=read('public/assets/js/app.js');
 assert.match(auth,/location\.assign\('\/dashboard'\)/);
 assert.match(server,/app\.get\('\/dashboard'/);
 assert.match(ui,/href="#account"/);
 assert.doesNotMatch(ui,/href="\/app"/);
});
