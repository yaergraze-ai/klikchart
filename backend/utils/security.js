import {randomBytes, randomInt, createHmac, timingSafeEqual, createHash} from 'node:crypto';
import {env} from '../config/env.js';
export const token = (size=32) => randomBytes(size).toString('base64url');
export const code = () => String(randomInt(0,1000000)).padStart(6,'0');
export function mac(purpose, data, secret=env.OTP_SECRET||'test-secret') {return createHmac('sha256',secret).update(`${purpose}:${data}`).digest('hex');}
export function sessionHash(value) {return mac('session',value,env.SESSION_SECRET);}
export const rateKey = (value) => createHash('sha256').update(value).digest('hex');
export function sameHex(a,b) {try {return timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));}catch{return false;}}
export function maskEmail(value) { const [a,b]=String(value||'').split('@'); return b ? `${a.slice(0,2)}***@${b}` : '***'; }
export function maskPhone(value) {const v=String(value||'');return v ? `${v.slice(0,5)}****${v.slice(-3)}`:'***';}
