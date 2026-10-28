import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = file=>readFileSync(file,'utf8');
const sql=read('supabase/migrations/UPGRADE_V4_1_TO_V4_4.sql');
const service=read('backend/services/account.js');
const market=read('backend/services/marketplace.js');
const server=read('backend/app.js');
const ui=read('public/assets/dashboard/dashboard.js');
const css=read('public/assets/dashboard/dashboard.css');

test('v4.2 SQL is additive, RLS-locked, and preserves existing authentication tables',()=>{
 for(const t of ['market_user_settings','market_site_settings'])assert.match(sql,new RegExp(`create table if not exists public\\.${t}`));
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all on public\.market_user_settings,public\.market_site_settings from anon,authenticated/);
 assert.doesNotMatch(sql,/drop table|truncate|delete from auth\.users|alter table auth\.users/i);
});
test('owner and seller overview are aggregated in PostgreSQL, not bulk 1000-row reads',()=>{
 for(const f of ['market_owner_overview','market_seller_overview'])assert.match(sql,new RegExp(`function public\\.${f}`));
 assert.match(sql,/count\(\*\)/);
 assert.match(sql,/sum\(total\)/);
 assert.match(sql,/generate_series/);
 assert.match(sql,/role='owner'/);
 assert.match(market,/cached\('owner:'\+user\.id,15000/);
 assert.match(market,/cached\('seller:'\+shop\.id,15000/);
 assert.doesNotMatch(market,/select\('id'\)\.limit\(1000\)/);
});
test('marketplace owner controls checkout fee instead of client trust',()=>{
 assert.match(sql,/select shipping_fee into v_shipping from public\.market_site_settings/);
 assert.match(sql,/subtotal,v_shipping,subtotal\+v_shipping/);
 assert.match(market,/requireRole\(req,\['owner'\]\)/);
 assert.match(market,/shipping_fee:int\(b\.shippingFee,0,10000000\)/);
});
test('change password requires current password and invalidates prior sessions',()=>{
 assert.match(service,/PASSWORD_CURRENT_REQUIRED/);
 assert.match(service,/authClient\(\)\.auth\.signInWithPassword/);
 assert.match(service,/verify\.data\?\.user\?\.id!==user\.id/);
 assert.match(service,/updateUserById\(user\.id,\{password:b\.newPassword\}\)/);
 assert.match(service,/auth_version:user\.auth_version\+1/);
 assert.match(service,/destroySession\(req,res\)/);
 assert.match(server,/limited\('market_password',5,3600\)/);
});
test('profile updates preserve independent verification states and preference fields',()=>{
 assert.match(service,/username_key:username\.toLowerCase\(\)/);
 assert.match(service,/USERNAME_TAKEN/);
 assert.match(service,/upsertSettings\(user\.id,\{display_name,bio,avatar_url/);
 assert.match(service,/upsertSettings\(user\.id,\{theme:b\.theme/);
 assert.doesNotMatch(service,/email_verified\s*:\s*true|whatsapp_verified\s*:\s*true/);
});
test('owner user and shop directories are paginated with server-side role checks',()=>{
 assert.match(market,/export async function ownerUsers\(req\)/);
 assert.match(market,/export async function ownerShops\(req\)/);
 assert.match(market,/const size=20/);
 assert.match(market,/\.range\(\(page-1\)\*size,page\*size-1\)/);
 assert.match(server,/\/api\/market\/owner\/users/);
 assert.match(server,/\/api\/market\/owner\/shops/);
});
test('dashboard consolidates account settings while keeping core account actions',()=>{
 for(const section of ['function account()','function ownerSettings()','function ownerUsers()','function openAddress(a={})'])assert.ok(ui.includes(section),section);
 assert.match(ui,/password-change/);assert.match(ui,/profile-update/);assert.match(ui,/preferences-update/);
 assert.match(ui,/owner-settings/);assert.match(ui,/address-edit/);
 assert.match(css,/html\[data-theme="dark"\]/);
});
test('dashboard keeps app chrome instead of replacing whole page on every view',()=>{
 assert.match(ui,/if\(!app\.querySelector\('\.layout'\)\)/);
 assert.match(ui,/content\.innerHTML=html/);
 assert.match(ui,/const ticket=\+\+S\.epoch/);
 assert.match(ui,/if\(ticket!==S\.epoch\)return/);
 assert.match(ui,/document\.documentElement\.dataset\.theme/);
});
test('fresh and upgrade SQL files exist and version increments',()=>{
 assert.match(read('supabase/FRESH_DATABASE.sql'),/market_owner_overview/);
 assert.match(read('README.md'),/UPGRADE_V4_1_TO_V4_4\.sql/);
 assert.match(read('package.json'),/"version": "4\.6\.0"/);
});
