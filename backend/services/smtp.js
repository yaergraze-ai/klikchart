import nodemailer from 'nodemailer';
import {env, configured} from '../config/env.js';
import {AppError} from '../utils/errors.js';

// These codes describe transport failures, not proof that a message reached the inbox.
export function smtpFailureCode(error){
 const code=String(error?.code||'').toUpperCase();
 const response=Number(error?.responseCode||0);
 if(['EAUTH','ENOAUTH','EOAUTH2'].includes(code)||[534,535].includes(response))return 'SMTP_AUTH_FAILED';
 if(['ETLS','EREQUIRETLS'].includes(code))return 'SMTP_TLS_FAILED';
 if(['EDNS','ESOCKET','ECONNECTION','ETIMEDOUT','ECONNREFUSED','ECONNRESET','ENOTFOUND','EAI_AGAIN'].includes(code))return 'SMTP_CONNECTION_FAILED';
 if(['EENVELOPE','EMAXRECIPIENTS','EMESSAGE'].includes(code)||[550,551,552,553,554].includes(response))return 'SMTP_REJECTED';
 return 'DELIVERY_FAILED';
}
export function smtpOptions(){
 if(!configured('email'))throw new AppError('CHANNEL_UNAVAILABLE',503);
 const port=Number(env.SMTP_PORT||587);
 const secure=String(env.SMTP_SECURE||'false').toLowerCase()==='true';
 if(!Number.isInteger(port)||port<1||port>65535||(port===465&&!secure)||(port===587&&secure))
  throw new AppError('SMTP_CONFIG_INVALID',503);
 return {host:env.SMTP_HOST.trim(),port,secure,requireTLS:!secure,
  connectionTimeout:15000,greetingTimeout:15000,socketTimeout:25000,
  auth:{user:env.SMTP_USER.trim(),pass:env.SMTP_PASS}};
}
export function smtpTransport(){return nodemailer.createTransport(smtpOptions());}
export function reportSmtpFailure(error){
 const issue=error instanceof AppError?error.code:smtpFailureCode(error);
 // Do not print SMTP server responses: they can contain addresses or credentials.
 console.error('Klikchart SMTP failure:',issue);
 return issue;
}
export async function smtpSend({to,subject,text}){
 const transporter=smtpTransport();
 try{
  const info=await transporter.sendMail({from:env.MAIL_FROM,to,subject,text});
  const accepted=Array.isArray(info.accepted)&&info.accepted.some(address=>String(address).toLowerCase()===String(to).toLowerCase());
  if(!accepted)throw new AppError('SMTP_REJECTED',502);
  // Accepted by SMTP is NOT a guarantee of delivery to Inbox/Spam.
  return {acceptedByServer:true};
 }catch(error){
  const code=reportSmtpFailure(error);
  throw new AppError(code,code==='SMTP_CONFIG_INVALID'?503:502);
 }finally{
  transporter.close();
 }
}
