import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createDemoApp} from '../demo/app.js';
import {id} from '../demo/data.js';

async function fixture(t){
 const server=createDemoApp().listen(0,'127.0.0.1');await new Promise(r=>server.on('listening',r));
 t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections()}));
 const base=`http://127.0.0.1:${server.address().port}`;
 const login=async role=>{const r=await fetch(base+'/demo?role='+role,{redirect:'manual'});return r.headers.get('set-cookie')?.split(';')[0]||''};
 const request=async(path,body,cookie='')=>{const r=await fetch(base+'/api/market/'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',cookie,Origin:base},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,...await r.json()}};
 return {base,login,request};
}
test('demo requires sessions and enforces owner/seller roles',async t=>{
 const {login,request}=await fixture(t);assert.equal((await request('cart')).status,401);
 const buyer=await login('buyer');assert.equal((await request('owner/stats',undefined,buyer)).status,403);assert.equal((await request('seller/products',undefined,buyer)).status,403);
 const owner=await login('owner');assert.equal((await request('owner/stats',undefined,owner)).status,200);
});
test('multi-store checkout calculates totals, captures address, clears cart, and cannot duplicate',async t=>{
 const {login,request}=await fixture(t),buyer=await login('buyer');
 await request('cart',{productId:id(1001),quantity:2},buyer);await request('cart',{productId:id(1002),quantity:1},buyer);
 const result=await request('checkout',{addressId:id(201)},buyer);assert.equal(result.data.count,2);
 const orders=(await request('orders',undefined,buyer)).data.items;assert.equal(orders.reduce((n,o)=>n+o.total,0),857000);assert.equal(orders[0].address_snapshot.recipient,'Nadia Putri');assert.equal((await request('cart',undefined,buyer)).data.items.length,0);assert.equal((await request('checkout',{addressId:id(201)},buyer)).error.code,'CART_EMPTY');
});
test('failed checkout leaves all stock and cart intact',async t=>{
 const {login,request}=await fixture(t),buyer=await login('buyer'),seller=await login('seller');
 await request('cart',{productId:id(1001),quantity:2},buyer);await request('cart',{productId:id(1002),quantity:1},buyer);
 const product=(await request('products/'+id(1001))).data.product;
 await request('seller/products/'+product.id,{...product,categoryId:1,stock:1},seller);
 const before=(await request('products/'+id(1002))).data.product.stock;
 assert.equal((await request('checkout',{addressId:id(201)},buyer)).error.code,'OUT_OF_STOCK');assert.equal((await request('cart',undefined,buyer)).data.items.length,2);assert.equal((await request('products/'+id(1002))).data.product.stock,before);assert.equal((await request('orders',undefined,buyer)).data.total,0);
});
test('cancel restores inventory once and rejects invalid transitions',async t=>{
 const {login,request}=await fixture(t),buyer=await login('buyer');
 await request('cart',{productId:id(1001),quantity:3},buyer);await request('checkout',{addressId:id(201)},buyer);
 const o=(await request('orders',undefined,buyer)).data.items[0];assert.equal((await request('orders/'+o.id+'/status',{status:'shipped'},buyer)).status,403);
 assert.equal((await request('orders/'+o.id+'/status',{status:'canceled'},buyer)).status,200);assert.equal((await request('orders/'+o.id+'/status',{status:'canceled'},buyer)).status,403);assert.equal((await request('products/'+id(1001))).data.product.stock,24);
});
test('cart validates stock, quantity and seller ownership; reviews require completed purchase',async t=>{
 const {login,request}=await fixture(t),buyer=await login('buyer'),seller=await login('seller');
 assert.equal((await request('cart',{productId:id(1012),quantity:1},buyer)).error.code,'OUT_OF_STOCK');assert.equal((await request('cart',{productId:id(1001),quantity:-1},buyer)).status,400);assert.equal((await request('cart',{productId:id(1001),quantity:1},seller)).error.code,'OWN_PRODUCT');assert.equal((await request('reviews',{productId:id(1001),rating:5,comment:'test'},buyer)).status,403);
});
test('address ownership and demo origin boundary reject cross-user changes',async t=>{
 const {base,login,request}=await fixture(t),seller=await login('seller');
 assert.equal((await request('addresses/'+id(201)+'/delete',{},seller)).status,404);
 const r=await fetch(base+'/api/market/cart',{method:'POST',headers:{Origin:'https://example.org','Content-Type':'application/json',cookie:seller},body:'{}'});assert.equal(r.status,403);
});
test('production entry point never imports or mounts demo bypass',()=>{
 const app=readFileSync(new URL('../backend/app.js',import.meta.url),'utf8');assert.doesNotMatch(app,/demo\/|createDemoApp|kc_demo/);assert.match(app,/app\.get\('\/',.*dashboard\.html/);const vercel=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url)));assert.equal(vercel.rewrites.find(r=>r.source==='/').destination,'/dashboard.html');
});
test('release has one commerce stylesheet, accessible navigation and order address details',()=>{
 const html=readFileSync(new URL('../public/dashboard.html',import.meta.url),'utf8');assert.equal((html.match(/href="\/assets\/dashboard\/.*?\.css/g)||[]).length,1);const ui=readFileSync(new URL('../public/assets/dashboard/dashboard.js',import.meta.url),'utf8');assert.match(ui,/address_snapshot/);assert.match(ui,/order-detail:/);assert.match(ui,/syncShopping/);assert.match(ui,/S\.sort='new'/);assert.match(ui,/aria-current=\"step\"/);
});
