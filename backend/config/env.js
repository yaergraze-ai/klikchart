export const env = process.env;
export function configured(channel) {
  return channel === 'email' ? Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.MAIL_FROM)
    : channel === 'whatsapp' ? Boolean(env.FONNTE_TOKEN) : false;
}
export function ensureConfigured() {
  const missing = ['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','OTP_SECRET','SESSION_SECRET'].filter(x => !env[x]);
  if (missing.length) { const e = Error('SERVER_NOT_CONFIGURED'); e.status = 503; throw e; }
  if (env.NODE_ENV === 'production' && ((env.OTP_SECRET||'').length < 32 || (env.SESSION_SECRET||'').length < 32)) {
    const e = Error('WEAK_SERVER_SECRET'); e.status = 503; throw e;
  }
}
