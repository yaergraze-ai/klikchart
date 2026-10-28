import {db,rows} from '../config/supabase.js';
import {env} from '../config/env.js';
import {token,sessionHash} from '../utils/security.js';
const preName=()=>env.NODE_ENV==='production'?'__Host-klc_pre':'klc_pre';
const appName=()=>env.NODE_ENV==='production'?'__Host-klc_sid':'klc_sid';
function options(maxAge){return {httpOnly:true,secure:env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge};}
export function clearCookies(res){res.clearCookie(preName(),options(0));res.clearCookie(appName(),options(0));}
async function store(value,data,ttlSeconds) {
 await rows(db().from('app_sessions').insert({id:sessionHash(value),data,expires_at:new Date(Date.now()+ttlSeconds*1000).toISOString()}));
}
export async function savePre(res,data,ttl=1200){const value=token();await store(value,{...data,kind:'pre'},ttl);res.cookie(preName(),value,options(ttl*1000));return value;}
export async function readPre(req){const value=req.cookies?.[preName()];if(!value)return null;const row=await rows(db().from('app_sessions').select('data,expires_at').eq('id',sessionHash(value)).maybeSingle());return row&&new Date(row.expires_at)>new Date()&&row.data?.kind==='pre'?row.data:null;}
export async function updatePre(req,data,ttl=1200){const value=req.cookies?.[preName()];if(!value)return false;await rows(db().from('app_sessions').update({data:{...data,kind:'pre'},expires_at:new Date(Date.now()+ttl*1000).toISOString()}).eq('id',sessionHash(value)));return true;}
export async function removePre(req,res){const value=req.cookies?.[preName()];if(value)await rows(db().from('app_sessions').delete().eq('id',sessionHash(value)));res.clearCookie(preName(),options(0));}
export async function createSession(req,res,user){await removePre(req,res);const value=token();await store(value,{kind:'app',userId:user.id,version:user.auth_version},7*86400);res.cookie(appName(),value,options(7*86400*1000));}
export async function readSession(req){const value=req.cookies?.[appName()];if(!value)return null;const session=await rows(db().from('app_sessions').select('data,expires_at').eq('id',sessionHash(value)).maybeSingle());if(!session||session.data?.kind!=='app'||new Date(session.expires_at)<=new Date())return null;const user=await rows(db().from('profiles').select('id,username,email,signup_verified,auth_version').eq('id',session.data.userId).maybeSingle());return user&&user.signup_verified&&user.auth_version===session.data.version?user:null;}
export async function destroySession(req,res){const value=req.cookies?.[appName()];if(value)await rows(db().from('app_sessions').delete().eq('id',sessionHash(value)));res.clearCookie(appName(),options(0));}
