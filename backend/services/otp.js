import {randomUUID} from 'node:crypto';
import {db,rows} from '../config/supabase.js';
import {code,mac} from '../utils/security.js';
import {sendOTP} from './providers.js';
import {AppError} from '../utils/errors.js';
import {configured} from '../config/env.js';
export function otpHash(id,userId,purpose,value,version){return mac('otp',`${id}:${userId}:${purpose}:${version}:${value}`);}
export async function makeOTP({user,purpose,channel,locale,allowUnverifiedWhatsApp=false}) {
 if(!['email','whatsapp'].includes(channel)||!configured(channel))throw new AppError('CHANNEL_UNAVAILABLE',400);
 const destination=channel==='email'?user.email:user.phone;
 if(!destination)throw new AppError('CHANNEL_UNAVAILABLE',400);
 // Login already validated the user's password; a valid OTP proves ownership
 // of the stored email/WhatsApp destination for its first verification.
 // After password authentication a stored WhatsApp contact may prove ownership
 // with its first OTP; database only flags it verified once this OTP succeeds.
 if((purpose==='reset'||purpose==='reset_email_check')&&channel==='email'&&!user.email_verified)throw new AppError('CHANNEL_UNAVAILABLE',400);
 if(purpose==='reset'&&channel==='whatsapp'&&!user.whatsapp_verified&&!allowUnverifiedWhatsApp)throw new AppError('CHANNEL_UNAVAILABLE',400);
 const value=code();const id=randomUUID();
 await rows(db().from('otp_challenges').insert({id,user_id:user.id,purpose,channel,code_hash:otpHash(id,user.id,purpose,value,user.auth_version),auth_version:user.auth_version,expires_at:new Date(Date.now()+300000).toISOString()}));
 try {await sendOTP(channel,destination,value,locale);}catch(e){await rows(db().from('otp_challenges').delete().eq('id',id));throw e;}
 return {id,channel};
}
export async function verifyOTP(pre,value) {
 if(!pre?.challengeId||!pre?.userId)throw new AppError('OTP_INVALID',400);
 const hashed=otpHash(pre.challengeId,pre.userId,pre.purpose,value,pre.version);
 const status=await rows(db().rpc('klikchart_verify_otp',{p_id:pre.challengeId,p_user:pre.userId,p_purpose:pre.purpose,p_code_hash:hashed,p_version:pre.version}));
 if(status!=='OTP_OK')throw new AppError(status||'OTP_INVALID',400);
 return true;
}
