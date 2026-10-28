import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const schema=fs.readFileSync(new URL('../supabase/FRESH_DATABASE.sql',import.meta.url),'utf8');
const api=fs.readFileSync(new URL('../backend/app.js',import.meta.url),'utf8');
test('DDL has five persisted tables, RLS and public restrictions',()=>{
 for(const name of ['profiles','otp_challenges','app_sessions','reset_grants','auth_rate_limits']){
  assert.match(schema,new RegExp(`create table if not exists public\\.${name}`));
  assert.match(schema,new RegExp(`alter table public\\.${name} enable row level security`));
 }
 assert.match(schema,/revoke all on public\.profiles/);
 assert.match(schema,/to service_role/);
});
test('OTP consumption and lock are specified in SQL: static inspection only',()=>{
 assert.match(schema,/for update/);
 assert.match(schema,/c\.attempts >= 5/);
 assert.match(schema,/c\.expires_at <= now\(\)/);
 assert.match(schema,/c\.consumed_at is not null/);
 assert.match(schema,/set consumed_at=now\(\)/);
 assert.match(schema,/set signup_verified=true/);
});
test('password reset invalidates previous auth versions and sessions',()=>{
 assert.match(schema,/set auth_version=auth_version\+1/);
 assert.match(schema,/delete from public\.app_sessions/);
 assert.match(schema,/delete from public\.reset_grants where token_hash=p_hash/);
});
test('required REST routes exist (static inspection)',()=>{
 for(const url of ['/api/register','/api/register/otp/send','/api/register/otp/resend','/api/register/otp/verify','/api/login','/api/login/otp/send','/api/login/otp/verify','/api/forgot/send','/api/forgot/verify','/api/forgot/reset','/api/me','/api/logout','/api/config','/api/runtime'])assert.ok(api.includes(`'${url}'`),url);
});
