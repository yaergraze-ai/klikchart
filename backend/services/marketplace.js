import {db,rows} from '../config/supabase.js';
import {readSession} from './sessions.js';
import {AppError} from '../utils/errors.js';
import crypto from 'node:crypto';

const ensure=(condition,code='VALIDATION_ERROR',status=400)=>{if(!condition)throw new AppError(code,status)};
const idRE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const uuid=x=>typeof x==='string'&&idRE.test(x);
const clean=(v,max=250)=>String(v??'').trim().slice(0,max);
const required=(v,min=2,max=250)=>{const x=clean(v,max+1);ensure(x.length>=min&&x.length<=max);return x};
const int=(v,min,max)=>{const n=Number(v);ensure(Number.isSafeInteger(n)&&n>=min&&n<=max);return n};
const flag=(v,allowed)=>{ensure(allowed.includes(v));return v};
async function single(q){return rows(q.maybeSingle())};
async function account(req){const a=await readSession(req);if(!a)throw new AppError('UNAUTHORIZED',401);return a}
async function roleOf(userId){const x=await single(db().from('market_roles').select('role').eq('user_id',userId));return x?.role||'buyer'}
async function requireRole(req,roles){const user=await account(req);const role=await roleOf(user.id);if(!roles.includes(role))throw new AppError('ROLE_FORBIDDEN',403);return {user,role}}
async function shopOf(id){return single(db().from('market_shops').select('*').eq('owner_id',id))}
async function seller(req){const {user}=await requireRole(req,['seller']);const shop=await shopOf(user.id);if(!shop||shop.status!=='active')throw new AppError('SHOP_SUSPENDED',403);return {user,shop}}
function sqlError(error){const message=String(error?.message||'');const codes=['ADDRESS_INVALID','ACCOUNT_INVALID','CART_EMPTY','SHOP_UNAVAILABLE','OUT_OF_STOCK','ORDER_NOT_FOUND','TRANSITION_FORBIDDEN','APPLICATION_NOT_PENDING','SELLER_CONTACTS_REQUIRED','ROLE_FORBIDDEN','FORBIDDEN'];const code=codes.find(x=>message.includes(x));if(code)throw new AppError(code,code==='FORBIDDEN'||code==='TRANSITION_FORBIDDEN'?403:409);console.error('Marketplace SQL error:',error?.code||'unknown');throw new AppError('DATABASE_ERROR',503)}
async function rpc(name,params){const r=await db().rpc(name,params);if(r.error)sqlError(r.error);return r.data}
const imageUrl=x=>{
 if(!x)return null;
 ensure(typeof x==='string'&&x.length<=1000,'IMAGE_URL_INVALID');
 let parsed;try{parsed=new URL(x)}catch{throw new AppError('IMAGE_URL_INVALID',400)}
 ensure(parsed.protocol==='https:'&&!parsed.username&&!parsed.password&&!!parsed.hostname&&
   !/^(localhost|127\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1)/i.test(parsed.hostname),
   'IMAGE_URL_INVALID');
 return x;
};
const imageList=x=>{ensure(Array.isArray(x)&&x.length<=6,'PRODUCT_IMAGES_INVALID');return [...new Set(x.map(imageUrl).filter(Boolean))]};
const mimeByMagic=bytes=>{
 if(bytes.length>=4&&bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47)return {mime:'image/png',ext:'png'};
 if(bytes.length>=3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return {mime:'image/jpeg',ext:'jpg'};
 if(bytes.length>=12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return {mime:'image/webp',ext:'webp'};
 return null;
};
// Authenticated seller-only media upload. Never trust extension, client MIME, or user-provided storage path.
export async function uploadProductPhoto(req){
 const {shop}=await seller(req);
 const bytes=req.body;
 ensure(Buffer.isBuffer(bytes)&&bytes.length>=100&&bytes.length<=2*1024*1024,'IMAGE_SIZE_INVALID',413);
 const info=mimeByMagic(bytes);ensure(info&&req.get('content-type')?.split(';')[0]===info.mime,'IMAGE_TYPE_INVALID',415);
 const file=`${shop.id}/${crypto.randomUUID()}.${info.ext}`;
 const response=await db().storage.from('klikchart-products').upload(file,bytes,{contentType:info.mime,cacheControl:'31536000',upsert:false});
 if(response.error){console.error('Product upload failed:',response.error.statusCode||'storage');throw new AppError('IMAGE_UPLOAD_FAILED',503)}
 const {data}=db().storage.from('klikchart-products').getPublicUrl(file);
 return {url:data.publicUrl};
}


export async function me(req){const a=await account(req);const role=await roleOf(a.id);const [profile,shop,application]=await Promise.all([
 single(db().from('profiles').select('email_verified,whatsapp_verified,phone').eq('id',a.id)),
 shopOf(a.id),single(db().from('market_seller_applications').select('status,store_name,owner_note').eq('user_id',a.id))]);
 return {user:{id:a.id,username:a.username,email:a.email,emailVerified:!!profile?.email_verified,whatsappVerified:!!profile?.whatsapp_verified},role,shop,application};
}
export async function categories(){return {items:await rows(db().from('market_categories').select('id,name,slug').order('name'))}}
export async function products(req){const q=req.query||{};let query=db().from('market_products').select('id,name,description,image_url,images,price,stock,status,created_at,category_id,shop_id,market_shops!inner(id,name,status),market_categories(name,slug)',{count:'exact'})
 .eq('status','published').eq('market_shops.status','active');
 if(q.q){const text=clean(q.q,70).replace(/[,%()]/g,'');if(text)query=query.ilike('name',`%${text}%`)}
 if(q.category){const n=Number(q.category);if(Number.isSafeInteger(n))query=query.eq('category_id',n)}
 if(q.shop&&uuid(q.shop))query=query.eq('shop_id',q.shop);
 if(q.minPrice!==undefined){const n=Number(q.minPrice);ensure(Number.isSafeInteger(n)&&n>=0&&n<=1000000000,'PRICE_FILTER_INVALID');query=query.gte('price',n)}
 if(q.maxPrice!==undefined){const n=Number(q.maxPrice);ensure(Number.isSafeInteger(n)&&n>=0&&n<=1000000000,'PRICE_FILTER_INVALID');query=query.lte('price',n)}
 if(q.sort==='name')query=query.order('name',{ascending:true});else if(q.sort==='price_asc')query=query.order('price',{ascending:true});else if(q.sort==='price_desc')query=query.order('price',{ascending:false});else query=query.order('created_at',{ascending:false});
 const page=Math.min(50,Math.max(1,Number.parseInt(q.page,10)||1));const result=await query.range((page-1)*16,page*16-1);
 if(result.error)sqlError(result.error);return {items:result.data||[],total:result.count||0,page};}
export async function publicShop(req){
 ensure(uuid(req.params.id),'SHOP_INVALID');
 const shop=await single(db().from('market_shops').select('id,name,description,status,created_at').eq('id',req.params.id));
 if(!shop||shop.status!=='active')throw new AppError('NOT_FOUND',404);
 return {shop};
}
export async function product(req){ensure(uuid(req.params.id),'PRODUCT_INVALID');const row=await single(db().from('market_products').select('*,market_shops(id,name,status),market_categories(name)').eq('id',req.params.id).eq('status','published'));
 if(!row||row.market_shops?.status!=='active')throw new AppError('NOT_FOUND',404);
 const [reviews,rating]=await Promise.all([rows(db().from('market_reviews').select('id,rating,comment,created_at').eq('product_id',row.id).order('created_at',{ascending:false}).limit(30)),rpc('market_product_rating',{p_product:row.id})]);return {product:row,reviews,rating};}
export async function applySeller(req){const a=await account(req);ensure((await roleOf(a.id))==='buyer','ROLE_FORBIDDEN',403);
 const profile=await single(db().from('profiles').select('email_verified,whatsapp_verified').eq('id',a.id));
 ensure(profile?.email_verified&&profile?.whatsapp_verified,'SELLER_CONTACTS_REQUIRED',403);
 const store_name=required(req.body?.storeName,3,70),description=clean(req.body?.description,700);
 const existing=await single(db().from('market_seller_applications').select('status').eq('user_id',a.id));ensure(existing?.status!=='pending','APPLICATION_PENDING',409);ensure(existing?.status!=='approved','ALREADY_SELLER',409);
 await rows(db().from('market_seller_applications').upsert({user_id:a.id,store_name,description,status:'pending',owner_note:'',reviewed_at:null,created_at:new Date().toISOString()},{onConflict:'user_id'}));
 return {status:'pending'};}
export async function sellerApplications(req){await requireRole(req,['owner']);return {items:await rows(db().from('market_seller_applications').select('user_id,store_name,description,status,created_at,owner_note').order('created_at',{ascending:false}).limit(100))}}
export async function decision(req){const actor=await requireRole(req,['owner']);ensure(uuid(req.params.id),'USER_INVALID');const status=flag(req.body?.status,['approved','rejected']);const note=clean(req.body?.note,300);return rpc('market_review_seller',{p_actor:actor.user.id,p_user:req.params.id,p_status:status,p_note:note});}
export async function sellerProducts(req){
 const {shop}=await seller(req);
 const page=Math.min(1000,Math.max(1,Number.parseInt(req.query?.page,10)||1)),size=20;
 const result=await db().from('market_products').select('*,market_categories(name)',{count:'exact'})
  .eq('shop_id',shop.id).order('created_at',{ascending:false}).range((page-1)*size,page*size-1);
 if(result.error)sqlError(result.error);
 return {items:result.data||[],total:result.count||0,page};
}
export async function saveProduct(req){const {shop}=await seller(req);const id=req.params.id;
 const body=req.body||{};const images=imageList(body.images??(body.imageUrl?[body.imageUrl]:[]));
 const values={name:required(body.name,3,120),description:clean(body.description,3000),price:int(body.price,100,1000000000),stock:int(body.stock,0,1000000),status:flag(body.status,['draft','published','archived']),images,image_url:images[0]||null,updated_at:new Date().toISOString()};
 if(body.categoryId){values.category_id=int(body.categoryId,1,1000000);const category=await single(db().from('market_categories').select('id').eq('id',values.category_id));ensure(!!category,'CATEGORY_INVALID');}
 if(id){ensure(uuid(id),'PRODUCT_INVALID');const old=await single(db().from('market_products').select('id').eq('id',id).eq('shop_id',shop.id));if(!old)throw new AppError('NOT_FOUND',404);const result=await rows(db().from('market_products').update(values).eq('id',id).eq('shop_id',shop.id).select('id').single());return {id:result.id};}
 const added=await rows(db().from('market_products').insert({...values,shop_id:shop.id}).select('id').single());return {id:added.id};}
export async function saveShop(req){const {shop}=await seller(req);const name=required(req.body?.name,3,70),description=clean(req.body?.description,700);await rows(db().from('market_shops').update({name,description}).eq('id',shop.id));return {saved:true};}
export async function cart(req){const user=await account(req);return {items:await rows(db().from('market_cart_items').select('product_id,quantity,market_products(id,name,price,stock,status,image_url,shop_id,market_shops(name,status))').eq('user_id',user.id).order('updated_at',{ascending:false}))};}
export async function cartChange(req){const user=await account(req);const productId=req.body?.productId;ensure(uuid(productId),'PRODUCT_INVALID');const quantity=int(req.body?.quantity,0,99);
 if(quantity===0){await rows(db().from('market_cart_items').delete().eq('user_id',user.id).eq('product_id',productId));return {saved:true};}
 const p=await single(db().from('market_products').select('id,stock,status,shop_id,market_shops(status,owner_id)').eq('id',productId));
 if(!p||p.status!=='published'||p.market_shops?.status!=='active')throw new AppError('PRODUCT_UNAVAILABLE',409);
 ensure(p.market_shops.owner_id!==user.id,'OWN_PRODUCT',409);ensure(quantity<=p.stock,'OUT_OF_STOCK',409);
 await rows(db().from('market_cart_items').upsert({user_id:user.id,product_id:productId,quantity,updated_at:new Date().toISOString()},{onConflict:'user_id,product_id'}));return {saved:true};}
export async function wishlist(req){const user=await account(req);return {items:await rows(db().from('market_wishlists').select('product_id,market_products(id,name,price,image_url,stock,status,market_shops(name,status))').eq('user_id',user.id))};}
export async function wishlistChange(req){const user=await account(req);ensure(uuid(req.body?.productId),'PRODUCT_INVALID');if(req.body?.saved===false){await rows(db().from('market_wishlists').delete().eq('user_id',user.id).eq('product_id',req.body.productId));return {saved:false};}
 const p=await single(db().from('market_products').select('id').eq('id',req.body.productId).eq('status','published'));ensure(!!p,'NOT_FOUND',404);
 await rows(db().from('market_wishlists').upsert({user_id:user.id,product_id:req.body.productId},{onConflict:'user_id,product_id'}));return {saved:true};}
export async function addresses(req){const user=await account(req);return {items:await rows(db().from('market_addresses').select('*').eq('user_id',user.id).order('created_at',{ascending:false}))};}
export async function saveAddress(req){const user=await account(req);const b=req.body||{};const item={user_id:user.id,recipient:required(b.recipient,2,100),phone:required(b.phone,9,25),address:required(b.address,10,400),city:required(b.city,2,80),province:required(b.province,2,80),postal_code:required(b.postalCode,4,10)};
 const row=await rows(db().from('market_addresses').insert(item).select('id').single());return {id:row.id};}
export async function updateAddress(req){const user=await account(req);ensure(uuid(req.params.id),'ADDRESS_INVALID');const b=req.body||{};const values={recipient:required(b.recipient,2,100),phone:required(b.phone,9,25),address:required(b.address,10,400),city:required(b.city,2,80),province:required(b.province,2,80),postal_code:required(b.postalCode,4,10)};
 const row=await rows(db().from('market_addresses').update(values).eq('id',req.params.id).eq('user_id',user.id).select('id').maybeSingle());if(!row)throw new AppError('ADDRESS_INVALID',404);return {saved:true};}
export async function deleteAddress(req){const user=await account(req);ensure(uuid(req.params.id),'ADDRESS_INVALID');await rows(db().from('market_addresses').delete().eq('id',req.params.id).eq('user_id',user.id));return {removed:true};}
export async function checkout(req){const user=await account(req);ensure(uuid(req.body?.addressId),'ADDRESS_INVALID');return rpc('market_checkout',{p_buyer:user.id,p_address:req.body.addressId});}
export async function orders(req){const user=await account(req),role=await roleOf(user.id);
 const page=Math.min(1000,Math.max(1,Number.parseInt(req.query?.page,10)||1)),size=25;
 let q=db().from('market_orders').select('*,market_order_items(id,product_id,product_name,unit_price,quantity,line_total),market_shops(name)',{count:'exact'}).order('created_at',{ascending:false});
 if(role==='seller'&&req.query?.scope==='selling')q=q.eq('seller_id',user.id);
 else if(role==='owner'&&req.query?.scope==='all'){}else q=q.eq('buyer_id',user.id);
 const result=await q.range((page-1)*size,page*size-1);
 if(result.error)sqlError(result.error);
 return {items:result.data||[],total:result.count||0,page};
}
export async function orderStatus(req){const u=await account(req);ensure(uuid(req.params.id),'ORDER_INVALID');const next=flag(req.body?.status,['accepted','packed','shipped','delivered','canceled']);return rpc('market_transition_order',{p_actor:u.id,p_order:req.params.id,p_next:next,p_tracking:clean(req.body?.tracking,150)});}
export async function reportCod(req){const actor=await account(req);ensure(uuid(req.params.id),'ORDER_INVALID');return rpc('market_report_cod',{p_actor:actor.id,p_order:req.params.id});}
export async function reviews(req){const user=await account(req);ensure(uuid(req.body?.productId),'PRODUCT_INVALID');const productId=req.body.productId,rating=int(req.body?.rating,1,5),comment=clean(req.body?.comment,700);
 const delivered=await rows(db().from('market_orders').select('id,market_order_items!inner(product_id)').eq('buyer_id',user.id).eq('status','delivered').eq('market_order_items.product_id',productId).limit(1));ensure(delivered.length>0,'PURCHASE_REQUIRED',403);
 await rows(db().from('market_reviews').upsert({user_id:user.id,product_id:productId,rating,comment},{onConflict:'user_id,product_id'}));return {saved:true};}
function orderTrend(orders){const months=[];const now=new Date();for(let k=5;k>=0;k--){const date=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-k,1));const key=date.toISOString().slice(0,7);months.push({key,label:date.toLocaleDateString('id-ID',{month:'short',timeZone:'UTC'}),value:0});}
 for(const o of orders){if(o.status==='canceled')continue;const key=String(o.created_at||'').slice(0,7);const month=months.find(m=>m.key===key);if(month)month.value+=Number(o.total)||0;}return months;}
const cache=new Map();
async function cached(key,ttl,fn){const hit=cache.get(key);if(hit&&hit.expires>Date.now())return hit.value;const value=await fn();cache.set(key,{value,expires:Date.now()+ttl});if(cache.size>100)for(const [k,v] of cache)if(v.expires<Date.now())cache.delete(k);return value;}
export function invalidateStats(){cache.clear();}
export async function sellerStats(req){const {user,shop}=await seller(req);return cached('seller:'+shop.id,15000,()=>rpc('market_seller_overview',{p_actor:user.id,p_shop:shop.id}));}
export async function ownerStats(req){const {user}=await requireRole(req,['owner']);return cached('owner:'+user.id,15000,async()=>{const [overview,shops]=await Promise.all([rpc('market_owner_overview',{p_actor:user.id}),rows(db().from('market_shops').select('id,name,status,owner_id').order('created_at',{ascending:false}).limit(40))]);return {...overview,shops};});}
export async function ownerUsers(req){await requireRole(req,['owner']);const page=Math.min(100,Math.max(1,Number.parseInt(req.query?.page,10)||1));const size=20;
 const result=await db().from('profiles').select('id,username,email,email_verified,whatsapp_verified,signup_verified,created_at',{count:'exact'}).order('created_at',{ascending:false}).range((page-1)*size,page*size-1);
 if(result.error)sqlError(result.error);const users=result.data||[],ids=users.map(x=>x.id);
 const roles=ids.length?await rows(db().from('market_roles').select('user_id,role').in('user_id',ids)):[];
 const roleById=new Map(roles.map(r=>[r.user_id,r.role]));
 return {items:users.map(x=>({...x,role:roleById.get(x.id)||'buyer'})),total:result.count||0,page};}
export async function ownerShops(req){await requireRole(req,['owner']);const page=Math.min(100,Math.max(1,Number.parseInt(req.query?.page,10)||1));const size=20;
 const result=await db().from('market_shops').select('id,name,status,owner_id,created_at',{count:'exact'}).order('created_at',{ascending:false}).range((page-1)*size,page*size-1);
 if(result.error)sqlError(result.error);return {items:result.data||[],total:result.count||0,page};}
export async function siteSettings(){const settings=await single(db().from('market_site_settings').select('storefront_name,announcement,support_email,shipping_fee').eq('id',1));return {settings};}
export async function saveSiteSettings(req){await requireRole(req,['owner']);const b=req.body||{};const values={storefront_name:required(b.storefrontName,3,60),announcement:clean(b.announcement,220),support_email:clean(b.supportEmail,254),shipping_fee:int(b.shippingFee,0,10000000),updated_at:new Date().toISOString()};
 if(values.support_email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.support_email))throw new AppError('VALIDATION_ERROR',400);
 await rows(db().from('market_site_settings').update(values).eq('id',1));invalidateStats();return {saved:true};}
export async function ownerShop(req){await requireRole(req,['owner']);ensure(uuid(req.params.id),'SHOP_INVALID');const status=flag(req.body?.status,['active','suspended']);await rows(db().from('market_shops').update({status}).eq('id',req.params.id));return {status};}
export async function ownerProducts(req){
 await requireRole(req,['owner']);
 const page=Math.min(1000,Math.max(1,Number.parseInt(req.query?.page,10)||1)),size=20;
 const result=await db().from('market_products').select('id,name,status,price,stock,market_shops(name)',{count:'exact'})
  .order('created_at',{ascending:false}).range((page-1)*size,page*size-1);
 if(result.error)sqlError(result.error);
 return {items:result.data||[],total:result.count||0,page};
}
export async function ownerHideProduct(req){await requireRole(req,['owner']);ensure(uuid(req.params.id),'PRODUCT_INVALID');const status=flag(req.body?.status,['archived','published']);await rows(db().from('market_products').update({status}).eq('id',req.params.id));return {status};}
export async function ownerCategory(req){await requireRole(req,['owner']);const name=required(req.body?.name,2,70),slug=required(req.body?.slug,2,70).toLowerCase();ensure(/^[a-z0-9-]+$/.test(slug),'SLUG_INVALID');const row=await rows(db().from('market_categories').insert({name,slug}).select('id').single());return {id:row.id};}
