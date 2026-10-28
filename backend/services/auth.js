import {db,authClient,rows} from '../config/supabase.js';
import {configured} from '../config/env.js';
import {AppError} from '../utils/errors.js';
import {checkRegistration,checkPassword,normalizedEmail,normalizedPhone,usernameRE,emailRE,checkOTP} from '../utils/validation.js';
import {maskEmail,maskPhone,token,mac} from '../utils/security.js';
import {savePre,readPre,updatePre,removePre,createSession,readSession} from './sessions.js';
import {makeOTP,verifyOTP} from './otp.js';
const channels=()=>['email','whatsapp'].filter(configured);
async function getUser(id) {return await rows(db().from('profiles').select('*').eq('id',id).maybeSingle());}
// For login, EITHER contact saved to this account can receive its first OTP
// after password authentication. The SQL OTP verification atomically marks
// the destination verified. Password recovery remains more restrictive.
const methods=(user,purpose)=>channels()
 .filter(ch=>ch==='email'
   ? Boolean(user.email)&&(purpose==='register'||purpose==='login'||user.email_verified)
   : Boolean(user.phone)&&(purpose==='register'||purpose==='login'||user.whatsapp_verified||(purpose==='reset'&&user.email_verified&&configured('email'))))
 .map(ch=>({channel:ch,masked:ch==='email'?maskEmail(user.email):maskPhone(user.phone),
   needsVerification:purpose==='login'&&!(ch==='whatsapp'?user.whatsapp_verified:user.email_verified)}));
const basicMethods=()=>channels().map(channel=>({channel,masked:''}));
function validChannel(ch) {if(!channels().includes(ch))throw new AppError('CHANNEL_UNAVAILABLE',400);}
async function requiredPre(req,purpose) {const pre=await readPre(req);if(!pre||pre.purpose!==purpose)throw new AppError('FLOW_EXPIRED',401);return pre;}
export async function sendLoginOTP(req){const pre=await requiredPre(req,'login');const user=await getUser(pre.userId);if(!user||!user.signup_verified||user.auth_version!==pre.version)throw new AppError('FLOW_EXPIRED',401);return await makeOTP({user,purpose:'login',channel:req.body?.channel,locale:req.body?.locale});}
export async function attachChallenge(req,challenge){const pre=await readPre(req);if(!pre)throw new AppError('FLOW_EXPIRED',401);await updatePre(req,{...pre,challengeId:challenge.id,channel:challenge.channel,sentAt:Date.now()},1200);return {expiresIn:300,resendAfter:60,channel:challenge.channel};}
export async function login(req,res){
 const identifier=String(req.body?.identifier||'').trim(),password=req.body?.password;
 if(!identifier||identifier.length>254||typeof password!=='string'||!password)throw new AppError('VALIDATION_ERROR',400,{identifier:'IDENTIFIER_REQUIRED',password:'PASSWORD_REQUIRED'});
 const key=identifier.toLowerCase();
 const user=await rows((emailRE.test(key)?db().from('profiles').select('*').ilike('email',key):db().from('profiles').select('*').eq('username_key',key)).maybeSingle());
 if(!user)throw new AppError('LOGIN_INVALID',401);
 const {error}=await authClient().auth.signInWithPassword({email:user.email,password});
 if(error)throw new AppError('LOGIN_INVALID',401);
 if(!user.signup_verified)throw new AppError('ACCOUNT_UNVERIFIED',403);
 const eligible=methods(user,'login');if(!eligible.length)throw new AppError('CHANNEL_UNAVAILABLE',503);
 await savePre(res,{purpose:'login',userId:user.id,version:user.auth_version},1200);
 return {methods:eligible};
}
export async function verifyLogin(req,res){const pre=await requiredPre(req,'login');if(!checkOTP(req.body?.code))throw new AppError('OTP_INVALID',400);await verifyOTP(pre,req.body.code);const user=await getUser(pre.userId);if(!user?.signup_verified||user.auth_version!==pre.version)throw new AppError('FLOW_EXPIRED',401);await createSession(req,res,user);return {username:user.username};}
export async function sendReset(req,res){
 const email=normalizedEmail(req.body?.email),channel=req.body?.channel;validChannel(channel);
 if(!emailRE.test(email)||email.length>254)throw new AppError('VALIDATION_ERROR',400,{email:'EMAIL_INVALID'});
 const user=await rows(db().from('profiles').select('*').ilike('email',email).maybeSingle());
 // Identical response for unknown or not-eligible addresses: avoid account enumeration.
 if(!user||!user.signup_verified||!methods(user,'reset').some(x=>x.channel===channel)){
  await savePre(res,{purpose:'reset-decoy',userId:null},1200);return {accepted:true,resendAfter:60};
 }
 const pendingWaRecovery=channel==='whatsapp'&&!user.whatsapp_verified;
 const resetPreToken=await savePre(res,{purpose:'reset',userId:user.id,version:user.auth_version,pendingWaRecovery},1200);
 // Update current request cookie for the immediately following database update.
 req.cookies ||= {};req.cookies[process.env.NODE_ENV==='production'?'__Host-klc_pre':'klc_pre']=resetPreToken;
 const challenge=await makeOTP({user,purpose:'reset',channel,locale:req.body?.locale,allowUnverifiedWhatsApp:pendingWaRecovery});
 await attachChallenge(req,challenge);
 return {accepted:true,resendAfter:60};
}
export async function verifyReset(req){
 const pre=await readPre(req);
 if(!pre||!['reset','reset_email_check'].includes(pre.purpose))throw new AppError('FLOW_EXPIRED',401);
 if(!checkOTP(req.body?.code))throw new AppError('OTP_INVALID',400);
 await verifyOTP(pre,req.body.code);
 if(pre.purpose==='reset'&&pre.pendingWaRecovery){
  const user=await getUser(pre.userId);
  if(!user||!user.email_verified||user.auth_version!==pre.version||!configured('email'))throw new AppError('FLOW_EXPIRED',401);
  const challenge=await makeOTP({user,purpose:'reset_email_check',channel:'email',locale:req.body?.locale});
  await updatePre(req,{...pre,purpose:'reset_email_check',challengeId:challenge.id,pendingWaRecovery:false},1200);
  return {additionalVerification:true,channel:'email'};
 }
 const value=token();await rows(db().from('reset_grants').insert({token_hash:mac('reset',value),user_id:pre.userId,auth_version:pre.version,expires_at:new Date(Date.now()+600000).toISOString()}));await updatePre(req,{purpose:'grant',grant:value,userId:pre.userId},600);return {ready:true};}
export async function performReset(req,res){
 const pre=await requiredPre(req,'grant');const fields=checkPassword(req.body?.password,req.body?.confirmPassword);
 if(Object.keys(fields).length)throw new AppError('VALIDATION_ERROR',400,fields);
 const id=await rows(db().rpc('klikchart_claim_reset',{p_hash:mac('reset',pre.grant)}));if(!id)throw new AppError('FLOW_EXPIRED',401);
 const {error}=await db().auth.admin.updateUserById(id,{password:req.body.password});
 // Grant is already consumed and earlier sessions invalidated even if Auth provider fails.
 if(error)throw new AppError('AUTH_PROVIDER_ERROR',503);
 await removePre(req,res);return {changed:true};
}
export {channels,basicMethods};

// v2.7: logged-in users who activated through email can independently verify
// their previously stored WhatsApp number. No unverified channel is allowed
// to reset a password. Challenge IDs are public nonces, never OTP codes.
async function requireAccount(req) {
 const session=await readSession(req);
 if(!session)throw new AppError('UNAUTHORIZED',401);
 const user=await getUser(session.id);
 if(!user?.signup_verified)throw new AppError('UNAUTHORIZED',401);
 return user;
}
export async function accountStatus(req) {
 const user=await requireAccount(req);
 return {username:user.username,email:user.email,emailVerified:user.email_verified,
   whatsappVerified:user.whatsapp_verified,phoneMasked:user.phone?maskPhone(user.phone):null,
   whatsappAvailable:configured('whatsapp')&&Boolean(user.phone),
   emailMasked:user.email?maskEmail(user.email):null,
   emailAvailable:configured('email')&&Boolean(user.email)};
}
export async function sendAccountWhatsAppOTP(req) {
 const user=await requireAccount(req);
 if(!configured('whatsapp')||!user.phone)throw new AppError('CHANNEL_UNAVAILABLE',503);
 if(user.whatsapp_verified)throw new AppError('ALREADY_VERIFIED',409);
 // Resend cooldown persists in PostgreSQL, not in serverless memory.
 const recent=await rows(db().from('otp_challenges').select('created_at')
   .eq('user_id',user.id).eq('purpose','verify_whatsapp')
   .order('created_at',{ascending:false}).limit(1));
 if(recent?.length&&Date.now()-new Date(recent[0].created_at).getTime()<60000)
   throw new AppError('RESEND_WAIT',429);
 const challenge=await makeOTP({user,purpose:'verify_whatsapp',channel:'whatsapp',locale:req.body?.locale});
 return {challengeId:challenge.id,expiresIn:300,resendAfter:60,phoneMasked:maskPhone(user.phone)};
}
export async function verifyAccountWhatsAppOTP(req) {
 const user=await requireAccount(req);
 if(user.whatsapp_verified)return {verified:true};
 const {code,challengeId}=req.body||{};
 if(!checkOTP(code)||typeof challengeId!=='string'||!(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(challengeId)))
   throw new AppError('OTP_INVALID',400);
 await verifyOTP({challengeId,userId:user.id,purpose:'verify_whatsapp',version:user.auth_version},code);
 const saved=await getUser(user.id);
 if(!saved?.whatsapp_verified)throw new AppError('VERIFICATION_NOT_SAVED',503);
 return {verified:true};
}

// Email is verified independently from WhatsApp. A logged-in session can request
// an OTP only to the already saved email address (no arbitrary destination).
export async function sendAccountEmailOTP(req) {
 const user=await requireAccount(req);
 if(!configured('email')||!user.email)throw new AppError('CHANNEL_UNAVAILABLE',503);
 if(user.email_verified)throw new AppError('ALREADY_VERIFIED',409);
 const recent=await rows(db().from('otp_challenges').select('created_at')
   .eq('user_id',user.id).eq('purpose','verify_email')
   .order('created_at',{ascending:false}).limit(1));
 if(recent?.length&&Date.now()-new Date(recent[0].created_at).getTime()<60000)
   throw new AppError('RESEND_WAIT',429);
 const challenge=await makeOTP({user,purpose:'verify_email',channel:'email',locale:req.body?.locale});
 return {challengeId:challenge.id,expiresIn:300,resendAfter:60,emailMasked:maskEmail(user.email)};
}
export async function verifyAccountEmailOTP(req) {
 const user=await requireAccount(req);
 if(user.email_verified)return {verified:true};
 const {code,challengeId}=req.body||{};
 if(!checkOTP(code)||typeof challengeId!=='string'||!(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(challengeId)))
   throw new AppError('OTP_INVALID',400);
 await verifyOTP({challengeId,userId:user.id,purpose:'verify_email',version:user.auth_version},code);
 const saved=await getUser(user.id);
 if(!saved?.email_verified)throw new AppError('VERIFICATION_NOT_SAVED',503);
 return {verified:true};
}

// Deferred registration: no Auth user/profile exists until the OTP verifies.
export {register,sendRegisterOTP,verifyRegister,cancelRegister} from './registration.js';
