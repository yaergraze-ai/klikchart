/**
 * v3.7 — Deferred registration; NO Supabase Auth user or public profile exists
 * before a successful OTP. Pending form data stays only in a short-lived,
 * authenticated AES-GCM HttpOnly cookie. Never log the cookie or its contents.
 */
import {randomUUID, randomBytes, createCipheriv, createDecipheriv, createHash} from 'node:crypto';
import {db,rows} from '../config/supabase.js';
import {env,configured} from '../config/env.js';
import {AppError} from '../utils/errors.js';
import {checkRegistration,checkOTP,normalizedEmail,normalizedPhone} from '../utils/validation.js';
import {maskEmail,maskPhone,code,mac,sameHex,rateKey} from '../utils/security.js';
import {sendOTP} from './providers.js';

const TTL=15*60*1000;
const OTP_TTL=5*60*1000;
const RESEND=60*1000;
const cookieName=()=>env.NODE_ENV==='production'?'__Host-klc_signup':'klc_signup';
const opts=(maxAge)=>({httpOnly:true,secure:env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge});
const encryptionKey=()=>createHash('sha256').update(`klikchart:pending-signup:v1:${env.SESSION_SECRET||''}`).digest();
function seal(payload){
 const iv=randomBytes(12);
 const cipher=createCipheriv('aes-256-gcm',encryptionKey(),iv);
 const encrypted=Buffer.concat([cipher.update(JSON.stringify(payload),'utf8'),cipher.final()]);
 return `v1.${Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64url')}`;
}
function open(value){
 try{
  if(typeof value!=='string'||!value.startsWith('v1.')||value.length>4000)return null;
  const buf=Buffer.from(value.slice(3),'base64url');if(buf.length<29)return null;
  const dec=createDecipheriv('aes-256-gcm',encryptionKey(),buf.subarray(0,12));
  dec.setAuthTag(buf.subarray(12,28));
  const payload=JSON.parse(Buffer.concat([dec.update(buf.subarray(28)),dec.final()]).toString('utf8'));
  return payload?.purpose==='signup'&&typeof payload.createdAt==='number'&&Date.now()-payload.createdAt<TTL&&Date.now()>=payload.createdAt-10000?payload:null;
 }catch{return null;}
}
function write(res,payload){res.cookie(cookieName(),seal(payload),opts(TTL));}
export function clearSignup(res){res.clearCookie(cookieName(),opts(0));}
function requirePending(req){
 const value=open(req.cookies?.[cookieName()]);
 if(!value)throw new AppError('FLOW_EXPIRED',401);
 return value;
}
const channels=()=>['email','whatsapp'].filter(configured);
const methods=(p)=>channels().map(channel=>({channel,masked:channel==='email'?maskEmail(p.email):maskPhone(p.phone)}));
async function duplicates(p){
 const [username,email,phone]=await Promise.all([
  rows(db().from('profiles').select('id').eq('username_key',p.username.toLowerCase()).limit(1)),
  rows(db().from('profiles').select('id').ilike('email',p.email).limit(1)),
  rows(db().from('profiles').select('id').eq('phone',p.phone).eq('whatsapp_verified',true).limit(1))
 ]);
 return {...(username.length?{username:'USERNAME_TAKEN'}:{}),...(email.length?{email:'EMAIL_TAKEN'}:{}),...(phone.length?{phone:'PHONE_TAKEN'}:{})};
}
export async function register(req,res){
 const body=req.body||{};const fields=checkRegistration(body);
 if(Object.keys(fields).length)throw new AppError('VALIDATION_ERROR',400,fields);
 if(!channels().length)throw new AppError('CHANNEL_UNAVAILABLE',503);
 const p={purpose:'signup',nonce:randomUUID(),createdAt:Date.now(),username:body.username,email:normalizedEmail(body.email),phone:normalizedPhone(body.phone),password:body.password};
 const dup=await duplicates(p);
 if(Object.keys(dup).length)throw new AppError('VALIDATION_ERROR',409,dup);
 write(res,p);
 // Not a persisted account. OTP registration state stays in the HttpOnly cookie.
 return {methods:methods(p),pending:true,expiresIn:Math.floor(TTL/1000)};
}
export async function sendRegisterOTP(req,res){
 const p=requirePending(req),channel=req.body?.channel;
 if(!channels().includes(channel))throw new AppError('CHANNEL_UNAVAILABLE',400);
 if(p.sentAt&&Date.now()-p.sentAt<RESEND)throw new AppError('RESEND_WAIT',429);
 const otp=code(),challengeId=randomUUID();
 const destination=channel==='email'?p.email:p.phone;
 // Send first; do not put a new challenge into a cookie if delivery fails.
 await sendOTP(channel,destination,otp,req.body?.locale);
 const next={...p,channel,challengeId,hash:mac('pending-signup',`${p.nonce}:${challengeId}:${channel}:${otp}`),sentAt:Date.now(),otpExpires:Date.now()+OTP_TTL,attempts:0};
 write(res,next);
 return {channel,expiresIn:300,resendAfter:60};
}
export async function cancelRegister(req,res){clearSignup(res);return {cancelled:true};}
export async function verifyRegister(req,res){
 const p=requirePending(req),value=req.body?.code;
 if(!p.channel||!p.hash||!p.challengeId||!p.otpExpires)throw new AppError('FLOW_EXPIRED',401);
 if(Date.now()>=p.otpExpires){clearSignup(res);throw new AppError('OTP_EXPIRED',400);}
 if(p.attempts>=5){clearSignup(res);throw new AppError('OTP_LOCKED',429);}
 if(!checkOTP(value))throw new AppError('OTP_INVALID',400);
 // Enforce the attempt limit in Supabase even if someone replays older cookies.
 const allowed=await rows(db().rpc('klikchart_rate_check',{
  p_key:rateKey(`signup:guess:${p.challengeId}`),p_limit:5,p_seconds:900
 }));
 if(!allowed){clearSignup(res);throw new AppError('OTP_LOCKED',429);}
 const expected=mac('pending-signup',`${p.nonce}:${p.challengeId}:${p.channel}:${value}`);
 if(!sameHex(expected,p.hash)){
  write(res,{...p,attempts:p.attempts+1});
  throw new AppError(p.attempts+1>=5?'OTP_LOCKED':'OTP_INVALID',400);
 }
 const dup=await duplicates(p);
 if(Object.keys(dup).length){clearSignup(res);throw new AppError('VALIDATION_ERROR',409,dup);}
 // Atomic one-time claim AFTER OTP verification; prevents parallel/replayed
 // requests creating several accounts. A failed create requires a new OTP.
 const claim=await rows(db().rpc('klikchart_claim_signup',{p_nonce_hash:mac('signup-claim',p.nonce)}));
 if(!claim){clearSignup(res);throw new AppError('OTP_USED',409);}
 let createdId=null;
 try{
  const {data,error}=await db().auth.admin.createUser({email:p.email,password:p.password,email_confirm:true});
  if(error||!data?.user){
   if(/already|registered|exists/i.test(error?.message||''))throw new AppError('VALIDATION_ERROR',409,{email:'EMAIL_TAKEN'});
   throw new AppError('AUTH_PROVIDER_ERROR',503);
  }
  createdId=data.user.id;
  const {error:profileError}=await db().from('profiles').insert({
   id:createdId,username:p.username,username_key:p.username.toLowerCase(),email:p.email,phone:p.phone,
   signup_verified:true,email_verified:p.channel==='email',whatsapp_verified:p.channel==='whatsapp',auth_version:1
  });
  if(profileError){
   if(profileError.code==='23505')throw new AppError('VALIDATION_ERROR',409,{email:'EMAIL_TAKEN'});
   throw new AppError('DATABASE_ERROR',503);
  }
 }catch(e){
  if(createdId){const {error:rollbackError}=await db().auth.admin.deleteUser(createdId);if(rollbackError)console.error('Signup rollback required (Auth user cleanup failed):',createdId);}
  throw e;
 }finally{clearSignup(res);}
 return {verified:true};
}
