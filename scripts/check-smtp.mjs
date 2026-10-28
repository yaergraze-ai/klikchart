/** Test SMTP configuration without displaying login credentials or OTP. */
import 'dotenv/config';
import {smtpTransport,smtpOptions,reportSmtpFailure,smtpSend} from '../backend/services/smtp.js';
import {env} from '../backend/config/env.js';

const send=process.argv.includes('--send');
let transporter;
try{
 const config=smtpOptions();
 console.log(`SMTP target: ${config.host}:${config.port} (${config.secure?'TLS langsung':'STARTTLS wajib'})`);
 transporter=smtpTransport();
 await transporter.verify();
 console.log('SMTP connection, TLS, and login: OK');
 if(send){
  await smtpSend({to:env.SMTP_USER.trim(),subject:'Klikchart — tes konfigurasi email',text:'Pengujian SMTP Klikchart berhasil diterima oleh server pengirim. Ini bukan kode OTP. Periksa Kotak Masuk, Spam, dan Promosi.'});
  console.log('Test email accepted by sending server. Check Inbox, Spam, Promotions of SMTP_USER.');
 }else console.log('No email was sent. For a test message to SMTP_USER: npm.cmd run smtp:test');
}catch(e){
 const category=reportSmtpFailure(e);
 console.error('SMTP check failed:',category);
 process.exitCode=1;
}finally{if(transporter)transporter.close();}
