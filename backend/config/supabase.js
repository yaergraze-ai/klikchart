import {createClient} from '@supabase/supabase-js';
import {ensureConfigured,env} from './env.js';
let service, loginClient;
export function db() {
 ensureConfigured();
 return service ||= createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
export function authClient() {
 ensureConfigured();
 // A distinct fresh client per login avoids sharing Supabase auth state between concurrent requests.
 return createClient(env.SUPABASE_URL,env.SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
export async function rows(query) {
 const result = await query;
 if (result.error) { console.error('Database request failed:',result.error.code || 'unknown'); throw Object.assign(new Error('DATABASE_ERROR'),{status:503}); }
 return result.data;
}
