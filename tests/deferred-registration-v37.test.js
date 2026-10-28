import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(name)=>readFileSync(new URL(`../${name}`,import.meta.url),'utf8');
const source=read('backend/services/registration.js');
const api=read('backend/app.js');
const sql=read('supabase/FRESH_DATABASE.sql');

test('register only seals pending data and checks duplicates; no pre-OTP user/profile writes',()=>{
 const before=source.split('export async function register(req,res){')[1].split('export async function sendRegisterOTP')[0];
 assert.match(before,/write\(res,p\)/);
 assert.doesNotMatch(before,/\.auth\.admin\.createUser|\.from\('profiles'\)\.insert|\.from\('app_sessions'\)\.insert|\.from\('otp_challenges'\)\.insert/);
});
test('register OTP is sent without a database challenge and remains in encrypted HttpOnly cookie',()=>{
 const before=source.split('export async function sendRegisterOTP(req,res){')[1].split('export async function cancelRegister')[0];
 assert.match(before,/await sendOTP/);
 assert.match(before,/write\(res,next\)/);
 assert.doesNotMatch(before,/db\(\)\.from\('otp_challenges'\)/);
 assert.match(source,/createCipheriv\('aes-256-gcm'/);
 assert.match(source,/createDecipheriv\('aes-256-gcm'/);
 assert.match(source,/httpOnly:true/);
 assert.match(source,/sameSite:'lax'/);
});
test('only verified OTP can invoke Supabase createUser and create a verified profile',()=>{
 const block=source.split('export async function verifyRegister(req,res){')[1];
 assert.ok(block.indexOf('sameHex(expected,p.hash)')<block.indexOf('klikchart_claim_signup'));
 assert.ok(block.indexOf('klikchart_claim_signup')<block.indexOf('.auth.admin.createUser'));
 assert.match(block,/signup_verified:true/);
 assert.match(block,/whatsapp_verified:p\.channel==='whatsapp'/);
 assert.match(block,/email_verified:p\.channel==='email'/);
 assert.match(block,/auth\.admin\.deleteUser/);
});
test('verify OTP blocks replay, wrong codes and brute-force with persistent nonce rate counter',()=>{
 assert.match(source,/OTP_EXPIRED/);
 assert.match(source,/p\.attempts>=5/);
 assert.match(source,/klikchart_rate_check/);
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.registration_claims/);
 assert.match(sql,/ON CONFLICT DO NOTHING/);
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.klikchart_claim_signup/);
});
test('registration endpoints use stateless signup and allow cancellation',()=>{
 assert.match(api,/auth\.sendRegisterOTP\(req,res\)/);
 assert.match(api,/auth\.cancelRegister\(req,res\)/);
 assert.doesNotMatch(api,/auth\.attachChallenge\(req,await auth\.sendRegisterOTP/);
});
test('new project SQL includes complete RLS Auth schema and v3.7 claim cleanup',()=>{
 for(const name of ['profiles','otp_challenges','app_sessions','auth_rate_limits','reset_grants','registration_claims'])assert.match(sql,new RegExp(`public\\.${name}`));
 assert.match(sql,/DELETE FROM public\.registration_claims WHERE created_at/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.klikchart_claim_signup/);
});
