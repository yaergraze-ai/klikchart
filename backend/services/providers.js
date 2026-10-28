import {smtpSend} from './smtp.js';
import {configured,env} from '../config/env.js';
import {AppError} from '../utils/errors.js';
const subject={id:'Kode OTP Klikchart',en:'Your Klikchart verification code'};
export async function sendOTP(channel,destination,value,locale='id') {
 if(!configured(channel))throw new AppError('CHANNEL_UNAVAILABLE',503);
 const en=locale==='en';
 const msg=en?`Your Klikchart verification code is ${value}. Expires in 5 minutes. Never share this code.`:`Kode verifikasi Klikchart kamu: ${value}. Berlaku 5 menit. Jangan bagikan kode ini kepada siapa pun.`;
 if(channel==='email') {
  await smtpSend({to:destination,subject:subject[en?'en':'id'],text:msg});
  return;
 }
 const data=new URLSearchParams({target:destination,message:msg,countryCode:'62'});
 let response,body;
 try {response=await fetch('https://api.fonnte.com/send',{method:'POST',headers:{Authorization:env.FONNTE_TOKEN,'Content-Type':'application/x-www-form-urlencoded'},body:data,signal:AbortSignal.timeout(12000)});body=await response.json();}
 catch {throw new AppError('DELIVERY_FAILED',502);}
 if(!response.ok||body?.status!==true)throw new AppError('DELIVERY_FAILED',502);
}
