import {db,authClient,rows} from '../config/supabase.js';
import {readSession,destroySession} from './sessions.js';
import {AppError} from '../utils/errors.js';
import {checkPassword,usernameRE} from '../utils/validation.js';
const error=(code,status=400)=>{throw new AppError(code,status)};
const trim=(value,max)=>String(value??'').trim().slice(0,max+1);
const safeImage=x=>!x||(/^https:\/\/[^\s]+$/i.test(x)&&x.length<=500);
async function upsertSettings(userId,values){const old=await rows(db().from('market_user_settings').select('*').eq('user_id',userId).maybeSingle());return rows(db().from('market_user_settings').upsert({...old,...values,user_id:userId,updated_at:new Date().toISOString()},{onConflict:'user_id'}));}
async function authUser(req){const user=await readSession(req);if(!user)error('UNAUTHORIZED',401);return user;}
export async function profile(req){const user=await authUser(req);const [details,settings]=await Promise.all([
 rows(db().from('profiles').select('username,email,phone,email_verified,whatsapp_verified,signup_verified,created_at').eq('id',user.id).single()),
 rows(db().from('market_user_settings').select('display_name,bio,avatar_url,theme,email_notifications,order_notifications').eq('user_id',user.id).maybeSingle())]);
 return {account:details,settings:settings||{display_name:'',bio:'',avatar_url:null,theme:'light',email_notifications:true,order_notifications:true}};}
export async function saveProfile(req){const user=await authUser(req);const b=req.body||{};const display_name=trim(b.displayName,80),bio=trim(b.bio,500),avatar_url=trim(b.avatarUrl,500);
 if(display_name.length>80||bio.length>500||!safeImage(avatar_url))error('VALIDATION_ERROR');
 const username=trim(b.username,20);if(!usernameRE.test(username))error('USERNAME_INVALID');
 // Updating username does not change registered email/WhatsApp or their verification status.
 const existing=await rows(db().from('profiles').select('id').eq('username_key',username.toLowerCase()).neq('id',user.id).maybeSingle());
 if(existing)error('USERNAME_TAKEN',409);
 const change=await db().from('profiles').update({username,username_key:username.toLowerCase()}).eq('id',user.id);
 if(change.error){if(change.error.code==='23505')error('USERNAME_TAKEN',409);error('DATABASE_ERROR',503);}
 await upsertSettings(user.id,{display_name,bio,avatar_url:avatar_url||null});
 return {saved:true,username};}
export async function savePreferences(req){const user=await authUser(req),b=req.body||{};
 if(!['light','dark','system'].includes(b.theme)||typeof b.emailNotifications!=='boolean'||typeof b.orderNotifications!=='boolean')error('VALIDATION_ERROR');
 await upsertSettings(user.id,{theme:b.theme,email_notifications:b.emailNotifications,order_notifications:b.orderNotifications});
 return {saved:true};}
export async function changePassword(req,res){const user=await authUser(req),b=req.body||{};
 if(typeof b.currentPassword!=='string'||!b.currentPassword)error('PASSWORD_CURRENT_REQUIRED');
 const fields=checkPassword(b.newPassword,b.confirmPassword);if(Object.keys(fields).length)throw new AppError('VALIDATION_ERROR',400,fields);
 if(b.newPassword===b.currentPassword)error('PASSWORD_UNCHANGED');
 const verify=await authClient().auth.signInWithPassword({email:user.email,password:b.currentPassword});
 if(verify.error||verify.data?.user?.id!==user.id)error('PASSWORD_CURRENT_INVALID',401);
 const update=await db().auth.admin.updateUserById(user.id,{password:b.newPassword});if(update.error)error('PASSWORD_UPDATE_FAILED',503);
 // Rotate auth_version; makes every previous app session unusable after changing the password.
 await rows(db().from('profiles').update({auth_version:user.auth_version+1}).eq('id',user.id));
 await destroySession(req,res);return {changed:true,loginRequired:true};}
