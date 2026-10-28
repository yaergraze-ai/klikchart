import {db,rows} from '../config/supabase.js';
import {rateKey} from '../utils/security.js';
import {AppError} from '../utils/errors.js';
export function allowedRequestOrigins(settings = process.env) {
 const allowed = new Set();
 if (settings.APP_URL) {
  try {
   const parsed = new URL(settings.APP_URL);
   if (parsed.protocol === 'https:' || (settings.NODE_ENV !== 'production' && parsed.protocol === 'http:')) {
    allowed.add(parsed.origin);
   }
  } catch { /* Invalid APP_URL must not authorize any origin. */ }
 }
 // Vercel assigns this to the actual deployment. Do not trust a client Host header.
 // This permits same-origin POSTs on Preview while keeping production APP_URL strict.
 if (settings.VERCEL === '1' && settings.VERCEL_URL) {
  const host = String(settings.VERCEL_URL).toLowerCase();
  if (/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.vercel\.app$/.test(host)) {
   allowed.add(`https://${host}`);
  }
 }
 return allowed;
}
export function requireOrigin(req,res,next){
 if(['GET','HEAD','OPTIONS'].includes(req.method))return next();
 const origin=req.get('origin');
 if(req.get('x-klikchart-request')!=='1'||!origin||!allowedRequestOrigins().has(origin)) {
  return next(new AppError('FORBIDDEN',403));
 }
 next();
}
export function limited(scope,limit=10,seconds=900) {return async(req,res,next)=>{try{
 const ip=String(req.ip||req.socket.remoteAddress||'unknown');
 const identity=String(req.body?.email||req.body?.identifier||'').toLowerCase().trim();
 for(const key of [rateKey(`${scope}:ip:${ip}`),...(identity?[rateKey(`${scope}:id:${identity}`)]:[])]){
  const allowed=await rows(db().rpc('klikchart_rate_check',{p_key:key,p_limit:limit,p_seconds:seconds}));
  if(!allowed)throw new AppError('RATE_LIMITED',429);
 }
 next();}catch(e){next(e);}};}
