-- Klikchart Commerce v4.4 — FULL SCHEMA 001-010.
-- KHUSUS PROYEK SUPABASE BARU YANG KOSONG. Jangan jalankan pada database aktif.
-- Do not re-run individual migrations after this file.

-- =============== MIGRATION 001 ===============
-- Klikchart 1.0: idempotent, additive migration (Supabase SQL Editor).
create extension if not exists pgcrypto;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 username text, username_key text, email text, phone text,
 email_verified boolean not null default false,
 whatsapp_verified boolean not null default false,
 signup_verified boolean not null default false,
 auth_version integer not null default 1,
 created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists username_key text;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists email_verified boolean not null default false;
alter table public.profiles add column if not exists whatsapp_verified boolean not null default false;
alter table public.profiles add column if not exists signup_verified boolean not null default false;
alter table public.profiles add column if not exists auth_version integer not null default 1;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
-- Preserve existing records, but enforce uniqueness for populated usernames/emails.
update public.profiles set username_key=lower(username) where username is not null and username_key is null;
create unique index if not exists profiles_username_key_unique on public.profiles(username_key);
create unique index if not exists profiles_email_unique on public.profiles(lower(email));
create unique index if not exists profiles_verified_phone_unique on public.profiles(phone) where whatsapp_verified=true;
create index if not exists profiles_signup_verified_index on public.profiles(signup_verified);

create table if not exists public.otp_challenges (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 purpose text not null check (purpose in ('register','login','reset')),
 channel text not null check (channel in ('email','whatsapp')),
 code_hash text not null,
 auth_version integer not null,
 attempts integer not null default 0 check (attempts between 0 and 5),
 consumed_at timestamptz,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null
);
create index if not exists otp_user_purpose_idx on public.otp_challenges(user_id,purpose,created_at desc);
create index if not exists otp_expiration_idx on public.otp_challenges(expires_at);

create table if not exists public.app_sessions (
 id text primary key,
 data jsonb not null,
 expires_at timestamptz not null
);
create index if not exists app_sessions_expires_idx on public.app_sessions(expires_at);

create table if not exists public.reset_grants (
 token_hash text primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 auth_version integer not null,
 expires_at timestamptz not null
);
create index if not exists reset_grants_expires_idx on public.reset_grants(expires_at);

create table if not exists public.auth_rate_limits (
 key text primary key,
 hits integer not null default 0,
 window_start timestamptz not null default now()
);
create index if not exists auth_rate_limits_window_idx on public.auth_rate_limits(window_start);

alter table public.profiles enable row level security;
alter table public.otp_challenges enable row level security;
alter table public.app_sessions enable row level security;
alter table public.reset_grants enable row level security;
alter table public.auth_rate_limits enable row level security;
-- No public policies. Backend uses service role only.
revoke all on public.profiles,public.otp_challenges,public.app_sessions,public.reset_grants,public.auth_rate_limits from anon,authenticated;
grant all on public.profiles,public.otp_challenges,public.app_sessions,public.reset_grants,public.auth_rate_limits to service_role;

create or replace function public.klikchart_rate_check(p_key text,p_limit integer,p_seconds integer)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_hits integer;
begin
 if p_key is null or p_limit < 1 or p_seconds < 1 then return false; end if;
 insert into public.auth_rate_limits as r (key,hits,window_start)
 values (p_key,1,now())
 on conflict (key) do update set
 hits=case when r.window_start < now()-make_interval(secs=>p_seconds) then 1 else r.hits+1 end,
 window_start=case when r.window_start < now()-make_interval(secs=>p_seconds) then now() else r.window_start end
 returning hits into v_hits;
 return v_hits <= p_limit;
end $$;

create or replace function public.klikchart_verify_otp(
 p_id uuid,p_user uuid,p_purpose text,p_code_hash text,p_version integer
) returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.otp_challenges%rowtype; v_version integer;
begin
 select * into c from public.otp_challenges where id=p_id and user_id=p_user and purpose=p_purpose for update;
 if not found then return 'OTP_INVALID'; end if;
 if c.consumed_at is not null then return 'OTP_USED'; end if;
 if c.expires_at <= now() then return 'OTP_EXPIRED'; end if;
 if c.attempts >= 5 then return 'OTP_LOCKED'; end if;
 select auth_version into v_version from public.profiles where id=p_user;
 if v_version is null or c.auth_version<>p_version or v_version<>p_version then return 'OTP_INVALID'; end if;
 if c.code_hash <> p_code_hash then
  update public.otp_challenges set attempts=attempts+1 where id=p_id;
  if c.attempts+1 >= 5 then return 'OTP_LOCKED'; end if;
  return 'OTP_INVALID';
 end if;
 update public.otp_challenges set consumed_at=now() where id=p_id;
 if p_purpose='register' then
   update public.profiles set signup_verified=true,
     email_verified=case when c.channel='email' then true else email_verified end,
     whatsapp_verified=case when c.channel='whatsapp' then true else whatsapp_verified end
     where id=p_user;
 end if;
 return 'OTP_OK';
end $$;

create or replace function public.klikchart_claim_reset(p_hash text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare g public.reset_grants%rowtype; v_version integer;
begin
 select * into g from public.reset_grants where token_hash=p_hash for update;
 if not found or g.expires_at<=now() then return null; end if;
 select auth_version into v_version from public.profiles where id=g.user_id for update;
 if v_version is null or v_version<>g.auth_version then return null; end if;
 delete from public.reset_grants where token_hash=p_hash;
 update public.profiles set auth_version=auth_version+1 where id=g.user_id;
 delete from public.app_sessions where (data->>'userId')=g.user_id::text;
 return g.user_id;
end $$;

create or replace function public.klikchart_cleanup()
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 delete from public.otp_challenges where expires_at<now()-interval '1 day';
 delete from public.app_sessions where expires_at<now();
 delete from public.reset_grants where expires_at<now();
 delete from public.auth_rate_limits where window_start<now()-interval '2 days';
end $$;

revoke all on function public.klikchart_rate_check(text,integer,integer) from public,anon,authenticated;
revoke all on function public.klikchart_verify_otp(uuid,uuid,text,text,integer) from public,anon,authenticated;
revoke all on function public.klikchart_claim_reset(text) from public,anon,authenticated;
revoke all on function public.klikchart_cleanup() from public,anon,authenticated;
grant execute on function public.klikchart_rate_check(text,integer,integer) to service_role;
grant execute on function public.klikchart_verify_otp(uuid,uuid,text,text,integer) to service_role;
grant execute on function public.klikchart_claim_reset(text) to service_role;
grant execute on function public.klikchart_cleanup() to service_role;


-- =============== MIGRATION 002 ===============
-- Klikchart 1.1: additive update for existing projects (run after 001).
-- When the correct password has already been authenticated and the OTP
-- arrives at the account's stored WhatsApp number, establish number ownership.
-- Password recovery is unchanged: unverified contacts cannot reset a password.
create or replace function public.klikchart_verify_otp(
 p_id uuid,p_user uuid,p_purpose text,p_code_hash text,p_version integer
) returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.otp_challenges%rowtype; v_version integer;
begin
 select * into c from public.otp_challenges where id=p_id and user_id=p_user and purpose=p_purpose for update;
 if not found then return 'OTP_INVALID'; end if;
 if c.consumed_at is not null then return 'OTP_USED'; end if;
 if c.expires_at <= now() then return 'OTP_EXPIRED'; end if;
 if c.attempts >= 5 then return 'OTP_LOCKED'; end if;
 select auth_version into v_version from public.profiles where id=p_user;
 if v_version is null or c.auth_version<>p_version or v_version<>p_version then return 'OTP_INVALID'; end if;
 if c.code_hash <> p_code_hash then
  update public.otp_challenges set attempts=attempts+1 where id=p_id;
  if c.attempts+1 >= 5 then return 'OTP_LOCKED'; end if;
  return 'OTP_INVALID';
 end if;
 -- WhatsApp may be enrolled at login ONLY after a successful password step
 -- and successful OTP to the phone saved in this profile.
 -- Mark its ownership before consuming the one-time challenge.
 if p_purpose='login' and c.channel='whatsapp' then
   begin
     update public.profiles set whatsapp_verified=true
     where id=p_user and phone is not null and length(phone)>0;
   exception when unique_violation then
     return 'PHONE_TAKEN';
   end;
 end if;
 if p_purpose='register' then
   update public.profiles set signup_verified=true,
     email_verified=case when c.channel='email' then true else email_verified end,
     whatsapp_verified=case when c.channel='whatsapp' then true else whatsapp_verified end
     where id=p_user;
 end if;
 update public.otp_challenges set consumed_at=now() where id=p_id;
 return 'OTP_OK';
end $$;


revoke all on function public.klikchart_verify_otp(uuid,uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.klikchart_verify_otp(uuid,uuid,text,text,integer) to service_role;


-- =============== MIGRATION 003 ===============
-- Klikchart v2.7 — additive database migration, execute AFTER 001 and 002.
-- Permits an independent WhatsApp ownership OTP from an authenticated /app session.
-- Never relax password reset permissions to unverified contacts.
BEGIN;
ALTER TABLE public.otp_challenges DROP CONSTRAINT IF EXISTS otp_challenges_purpose_check;
ALTER TABLE public.otp_challenges ADD CONSTRAINT otp_challenges_purpose_check
 CHECK (purpose IN ('register','login','reset','verify_whatsapp'));
create or replace function public.klikchart_verify_otp(
 p_id uuid,p_user uuid,p_purpose text,p_code_hash text,p_version integer
) returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.otp_challenges%rowtype; v_version integer;
begin
 select * into c from public.otp_challenges where id=p_id and user_id=p_user and purpose=p_purpose for update;
 if not found then return 'OTP_INVALID'; end if;
 if c.consumed_at is not null then return 'OTP_USED'; end if;
 if c.expires_at <= now() then return 'OTP_EXPIRED'; end if;
 if c.attempts >= 5 then return 'OTP_LOCKED'; end if;
 select auth_version into v_version from public.profiles where id=p_user;
 if v_version is null or c.auth_version<>p_version or v_version<>p_version then return 'OTP_INVALID'; end if;
 if c.code_hash <> p_code_hash then
  update public.otp_challenges set attempts=attempts+1 where id=p_id;
  if c.attempts+1 >= 5 then return 'OTP_LOCKED'; end if;
  return 'OTP_INVALID';
 end if;
 -- WhatsApp can be verified after password login or from an active account session.
 -- Ownership is confirmed only by a valid OTP to the stored phone.
 -- Mark its ownership before consuming the one-time challenge.
 if (p_purpose='login' or p_purpose='verify_whatsapp') and c.channel='whatsapp' then
   begin
     update public.profiles set whatsapp_verified=true
     where id=p_user and phone is not null and length(phone)>0;
   exception when unique_violation then
     return 'PHONE_TAKEN';
   end;
 end if;
 if p_purpose='verify_whatsapp' and c.channel<>'whatsapp' then return 'OTP_INVALID'; end if;
 if p_purpose='register' then
   update public.profiles set signup_verified=true,
     email_verified=case when c.channel='email' then true else email_verified end,
     whatsapp_verified=case when c.channel='whatsapp' then true else whatsapp_verified end
     where id=p_user;
 end if;
 update public.otp_challenges set consumed_at=now() where id=p_id;
 return 'OTP_OK';
end $$;

REVOKE ALL ON FUNCTION public.klikchart_verify_otp(uuid,uuid,text,text,integer) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.klikchart_verify_otp(uuid,uuid,text,text,integer) TO service_role;
COMMIT;


-- =============== MIGRATION 004 ===============
-- Unverified WhatsApp recovery uses TWO possession proofs: WhatsApp then the account's verified email.
-- Does not mark unverified WhatsApp as verified or weaken existing reset grants.
ALTER TABLE public.otp_challenges DROP CONSTRAINT IF EXISTS otp_challenges_purpose_check;
ALTER TABLE public.otp_challenges ADD CONSTRAINT otp_challenges_purpose_check
CHECK (purpose IN ('register','login','reset','verify_whatsapp','reset_email_check'));


-- =============== MIGRATION 005 ===============
-- Klikchart v3.5 — after 001..004: enable FIRST email or WhatsApp verification after password login.
-- Permits an independent WhatsApp ownership OTP from an authenticated /app session.
-- Never relax password reset permissions to unverified contacts.
BEGIN;
ALTER TABLE public.otp_challenges DROP CONSTRAINT IF EXISTS otp_challenges_purpose_check;
ALTER TABLE public.otp_challenges ADD CONSTRAINT otp_challenges_purpose_check
 CHECK (purpose IN ('register','login','reset','verify_whatsapp','reset_email_check'));
create or replace function public.klikchart_verify_otp(
 p_id uuid,p_user uuid,p_purpose text,p_code_hash text,p_version integer
) returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.otp_challenges%rowtype; v_version integer;
begin
 select * into c from public.otp_challenges where id=p_id and user_id=p_user and purpose=p_purpose for update;
 if not found then return 'OTP_INVALID'; end if;
 if c.consumed_at is not null then return 'OTP_USED'; end if;
 if c.expires_at <= now() then return 'OTP_EXPIRED'; end if;
 if c.attempts >= 5 then return 'OTP_LOCKED'; end if;
 select auth_version into v_version from public.profiles where id=p_user;
 if v_version is null or c.auth_version<>p_version or v_version<>p_version then return 'OTP_INVALID'; end if;
 if c.code_hash <> p_code_hash then
  update public.otp_challenges set attempts=attempts+1 where id=p_id;
  if c.attempts+1 >= 5 then return 'OTP_LOCKED'; end if;
  return 'OTP_INVALID';
 end if;
 -- WhatsApp can be verified after password login or from an active account session.
 -- Ownership is confirmed only by a valid OTP to the stored phone.
 -- Mark its ownership before consuming the one-time challenge.
 if (p_purpose='login' or p_purpose='verify_whatsapp') and c.channel='whatsapp' then
   begin
     update public.profiles set whatsapp_verified=true
     where id=p_user and phone is not null and length(phone)>0;
   exception when unique_violation then
     return 'PHONE_TAKEN';
   end;
 end if;
 -- First verified email login: password was validated before challenge issuance.
 if p_purpose='login' and c.channel='email' then
   update public.profiles set email_verified=true where id=p_user and email is not null;
 end if;
 if p_purpose='verify_whatsapp' and c.channel<>'whatsapp' then return 'OTP_INVALID'; end if;
 if p_purpose='register' then
   update public.profiles set signup_verified=true,
     email_verified=case when c.channel='email' then true else email_verified end,
     whatsapp_verified=case when c.channel='whatsapp' then true else whatsapp_verified end
     where id=p_user;
 end if;
 update public.otp_challenges set consumed_at=now() where id=p_id;
 return 'OTP_OK';
end $$;

REVOKE ALL ON FUNCTION public.klikchart_verify_otp(uuid,uuid,text,text,integer) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.klikchart_verify_otp(uuid,uuid,text,text,integer) TO service_role;
COMMIT;


-- =============== MIGRATION 006 ===============
-- v3.7: one-time signup claims, created ONLY after correct OTP.
-- Before OTP success: NO rows in auth.users, profiles, pending signup or OTP tables.
CREATE TABLE IF NOT EXISTS public.registration_claims (
 nonce_hash TEXT PRIMARY KEY,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.registration_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.registration_claims FROM anon,authenticated;
GRANT ALL ON public.registration_claims TO service_role;

CREATE OR REPLACE FUNCTION public.klikchart_claim_signup(p_nonce_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE inserted_count INTEGER;
BEGIN
 IF p_nonce_hash IS NULL OR LENGTH(p_nonce_hash)<>64 THEN RETURN FALSE; END IF;
 INSERT INTO public.registration_claims(nonce_hash)
 VALUES(p_nonce_hash)
 ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS inserted_count = ROW_COUNT;
 RETURN inserted_count=1;
END $$;
REVOKE ALL ON FUNCTION public.klikchart_claim_signup(TEXT) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.klikchart_claim_signup(TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.klikchart_cleanup()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 DELETE FROM public.otp_challenges WHERE expires_at<now()-interval '1 day';
 DELETE FROM public.app_sessions WHERE expires_at<now();
 DELETE FROM public.reset_grants WHERE expires_at<now();
 DELETE FROM public.auth_rate_limits WHERE window_start<now()-interval '2 days';
 DELETE FROM public.registration_claims WHERE created_at<now()-interval '2 days';
END $$;
REVOKE ALL ON FUNCTION public.klikchart_cleanup() FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.klikchart_cleanup() TO service_role;


-- =============== MIGRATION 007 ===============
-- Klikchart v3.9: independent Email verification from logged-in Profile.
-- Apply AFTER migrations 001–006 to an existing database. Do not delete user rows.
BEGIN;
ALTER TABLE public.otp_challenges DROP CONSTRAINT IF EXISTS otp_challenges_purpose_check;
ALTER TABLE public.otp_challenges ADD CONSTRAINT otp_challenges_purpose_check
  CHECK (purpose IN ('register','login','reset','verify_whatsapp','reset_email_check','verify_email'));
create or replace function public.klikchart_verify_otp(
 p_id uuid,p_user uuid,p_purpose text,p_code_hash text,p_version integer
) returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.otp_challenges%rowtype; v_version integer;
begin
 select * into c from public.otp_challenges where id=p_id and user_id=p_user and purpose=p_purpose for update;
 if not found then return 'OTP_INVALID'; end if;
 if c.consumed_at is not null then return 'OTP_USED'; end if;
 if c.expires_at <= now() then return 'OTP_EXPIRED'; end if;
 if c.attempts >= 5 then return 'OTP_LOCKED'; end if;
 select auth_version into v_version from public.profiles where id=p_user;
 if v_version is null or c.auth_version<>p_version or v_version<>p_version then return 'OTP_INVALID'; end if;
 if c.code_hash <> p_code_hash then
  update public.otp_challenges set attempts=attempts+1 where id=p_id;
  if c.attempts+1 >= 5 then return 'OTP_LOCKED'; end if;
  return 'OTP_INVALID';
 end if;
 -- Require the expected delivery channel before changing any contact status.
 if p_purpose='verify_whatsapp' and c.channel<>'whatsapp' then return 'OTP_INVALID'; end if;
 if p_purpose='verify_email' and c.channel<>'email' then return 'OTP_INVALID'; end if;
 -- WhatsApp can be verified after password login or from an active account session.
 -- Ownership is confirmed only by a valid OTP to the stored phone.
 -- Mark its ownership before consuming the one-time challenge.
 if (p_purpose='login' or p_purpose='verify_whatsapp') and c.channel='whatsapp' then
   begin
     update public.profiles set whatsapp_verified=true
     where id=p_user and phone is not null and length(phone)>0;
   exception when unique_violation then
     return 'PHONE_TAKEN';
   end;
 end if;
 -- First verified email login: password was validated before challenge issuance.
 if (p_purpose='login' or p_purpose='verify_email') and c.channel='email' then
   update public.profiles set email_verified=true where id=p_user and email is not null;
 end if;
 if p_purpose='register' then
   update public.profiles set signup_verified=true,
     email_verified=case when c.channel='email' then true else email_verified end,
     whatsapp_verified=case when c.channel='whatsapp' then true else whatsapp_verified end
     where id=p_user;
 end if;
 update public.otp_challenges set consumed_at=now() where id=p_id;
 return 'OTP_OK';
end $$;
REVOKE ALL ON FUNCTION public.klikchart_verify_otp(uuid,uuid,text,text,integer) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.klikchart_verify_otp(uuid,uuid,text,text,integer) TO service_role;
COMMIT;
-- Klikchart v4.1: ADDITIVE marketplace migration for existing v4.0 databases.
-- NEVER run FRESH_DATABASE.sql again on a populated project.
create extension if not exists pgcrypto;

create table if not exists public.market_roles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null default 'buyer' check(role in ('buyer','seller','owner')),
 created_at timestamptz not null default now()
);
create table if not exists public.market_seller_applications (
 user_id uuid primary key references auth.users(id) on delete cascade,
 store_name text not null check(length(store_name) between 3 and 70),
 description text not null default '',
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 owner_note text not null default '',
 reviewed_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.market_shops (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null unique references auth.users(id) on delete cascade,
 name text not null,
 description text not null default '',
 status text not null default 'active' check(status in ('active','suspended')),
 created_at timestamptz not null default now()
);
create table if not exists public.market_categories (
 id integer generated by default as identity primary key,
 name text not null unique,
 slug text not null unique
);
insert into public.market_categories(name,slug) values
 ('Elektronik','elektronik'),('Fashion','fashion'),('Kecantikan','kecantikan'),
 ('Rumah & Hobi','rumah-hobi'),('Olahraga','olahraga'),('Makanan & Minuman','makanan-minuman')
on conflict (slug) do nothing;
create table if not exists public.market_products (
 id uuid primary key default gen_random_uuid(),
 shop_id uuid not null references public.market_shops(id),
 category_id integer references public.market_categories(id),
 name text not null check(length(name) between 3 and 120),
 description text not null default '',
 image_url text,
 price bigint not null check(price between 100 and 1000000000),
 stock integer not null default 0 check(stock between 0 and 1000000),
 status text not null default 'draft' check(status in ('draft','published','archived')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists market_products_feed_idx on public.market_products(status,created_at desc);
create index if not exists market_products_shop_idx on public.market_products(shop_id,status);
create table if not exists public.market_cart_items (
 user_id uuid not null references auth.users(id) on delete cascade,
 product_id uuid not null references public.market_products(id) on delete cascade,
 quantity integer not null check(quantity between 1 and 99),
 updated_at timestamptz not null default now(),
 primary key(user_id,product_id)
);
create table if not exists public.market_addresses (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 recipient text not null,
 phone text not null,
 address text not null,
 city text not null,
 province text not null,
 postal_code text not null,
 created_at timestamptz not null default now()
);
create index if not exists market_address_user_idx on public.market_addresses(user_id);
create table if not exists public.market_orders (
 id uuid primary key default gen_random_uuid(),
 buyer_id uuid not null references auth.users(id),
 seller_id uuid not null references auth.users(id),
 shop_id uuid not null references public.market_shops(id),
 address_snapshot jsonb not null,
 subtotal bigint not null check(subtotal>=0),
 shipping_fee bigint not null default 0 check(shipping_fee>=0),
 total bigint not null check(total>=0),
 status text not null default 'pending' check(status in ('pending','accepted','packed','shipped','delivered','canceled')),
 payment_method text not null default 'cod' check(payment_method='cod'),
 payment_status text not null default 'pay_on_delivery' check(payment_status in ('pay_on_delivery','seller_reported_collected','canceled')),
 tracking_note text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists market_order_buyer_idx on public.market_orders(buyer_id,created_at desc);
create index if not exists market_order_seller_idx on public.market_orders(seller_id,created_at desc);
create table if not exists public.market_order_items (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.market_orders(id) on delete cascade,
 product_id uuid not null references public.market_products(id),
 product_name text not null,
 unit_price bigint not null,
 quantity integer not null check(quantity>0),
 line_total bigint not null
);
create index if not exists market_order_items_order_idx on public.market_order_items(order_id);
create table if not exists public.market_wishlists (
 user_id uuid not null references auth.users(id) on delete cascade,
 product_id uuid not null references public.market_products(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(user_id,product_id)
);
create table if not exists public.market_reviews (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 product_id uuid not null references public.market_products(id),
 rating integer not null check(rating between 1 and 5),
 comment text not null default '',
 created_at timestamptz not null default now(),
 unique(user_id,product_id)
);
create index if not exists market_review_product_idx on public.market_reviews(product_id);

-- All reads/writes are through the checked Express backend using service_role.
-- No direct access via anon/authenticated PostgREST, even for the public catalog.
do $$ declare t text; begin
 foreach t in array array['market_roles','market_seller_applications','market_shops','market_categories','market_products','market_cart_items','market_addresses','market_orders','market_order_items','market_wishlists','market_reviews'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;

-- One atomic transaction, grouped by shop, stock locked/discounted inside Postgres.
create or replace function public.market_checkout(p_buyer uuid,p_address uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.market_addresses%rowtype; group_row record; item record;
  o uuid; order_ids uuid[] := '{}'; subtotal bigint; shop_owner uuid; shop_status text;
begin
 select * into a from public.market_addresses where id=p_address and user_id=p_buyer;
 if not found then raise exception 'ADDRESS_INVALID'; end if;
 if not exists(select 1 from public.profiles where id=p_buyer and signup_verified=true) then raise exception 'ACCOUNT_INVALID';end if;
 -- Lock cart entries so overlapping checkouts for the same buyer serialize.
 perform 1 from public.market_cart_items where user_id=p_buyer order by product_id for update;
 if not exists(select 1 from public.market_cart_items where user_id=p_buyer) then raise exception 'CART_EMPTY';end if;
 for group_row in
  select p.shop_id from public.market_cart_items c join public.market_products p on p.id=c.product_id
  where c.user_id=p_buyer group by p.shop_id order by p.shop_id
 loop
  select owner_id,status into shop_owner,shop_status from public.market_shops where id=group_row.shop_id;
  if shop_owner=p_buyer or shop_status<>'active' then raise exception 'SHOP_UNAVAILABLE';end if;
  subtotal:=0;
  -- Product row locks prevent overselling during concurrent checkouts.
  for item in select p.*,c.quantity from public.market_cart_items c join public.market_products p on p.id=c.product_id
     where c.user_id=p_buyer and p.shop_id=group_row.shop_id order by p.id for update of p
  loop
   if item.status<>'published' or item.stock<item.quantity then raise exception 'OUT_OF_STOCK';end if;
   subtotal:=subtotal+(item.price*item.quantity);
  end loop;
  insert into public.market_orders(buyer_id,seller_id,shop_id,address_snapshot,subtotal,shipping_fee,total)
    values(p_buyer,shop_owner,group_row.shop_id,jsonb_build_object('recipient',a.recipient,'phone',a.phone,'address',a.address,'city',a.city,'province',a.province,'postal_code',a.postal_code),subtotal,15000,subtotal+15000) returning id into o;
  order_ids:=array_append(order_ids,o);
  for item in select p.*,c.quantity from public.market_cart_items c join public.market_products p on p.id=c.product_id
     where c.user_id=p_buyer and p.shop_id=group_row.shop_id order by p.id
  loop
   update public.market_products set stock=stock-item.quantity,updated_at=now() where id=item.id;
   insert into public.market_order_items(order_id,product_id,product_name,unit_price,quantity,line_total)
   values(o,item.id,item.name,item.price,item.quantity,item.price*item.quantity);
  end loop;
 end loop;
 delete from public.market_cart_items where user_id=p_buyer;
 return jsonb_build_object('orderIds',to_jsonb(order_ids),'count',cardinality(order_ids));
end $$;

-- State machine, role checking, and cancel-stock restoration are one transaction.
create or replace function public.market_transition_order(p_actor uuid,p_order uuid,p_next text,p_tracking text default '')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare o public.market_orders%rowtype; vrole text; l record;
begin
 select * into o from public.market_orders where id=p_order for update;
 if not found then raise exception 'ORDER_NOT_FOUND';end if;
 select role into vrole from public.market_roles where user_id=p_actor;
 if coalesce(vrole,'buyer')='owner' then null;
 elsif p_actor=o.buyer_id then
  if not ((o.status='pending' and p_next='canceled') or (o.status='shipped' and p_next='delivered')) then raise exception 'TRANSITION_FORBIDDEN';end if;
 elsif p_actor=o.seller_id then
  if not ((o.status='pending' and p_next in ('accepted','canceled')) or
       (o.status='accepted' and p_next in ('packed','canceled')) or
       (o.status='packed' and p_next='shipped')) then raise exception 'TRANSITION_FORBIDDEN';end if;
 else raise exception 'FORBIDDEN';end if;
 if vrole='owner' and not (
    (o.status='pending' and p_next in ('accepted','canceled')) or
    (o.status='accepted' and p_next in ('packed','canceled')) or
    (o.status='packed' and p_next='shipped') or
    (o.status='shipped' and p_next='delivered')) then raise exception 'TRANSITION_FORBIDDEN';end if;
 if p_next='canceled' then
  for l in select product_id,quantity from public.market_order_items where order_id=o.id order by product_id loop
   update public.market_products set stock=stock+l.quantity,updated_at=now() where id=l.product_id;
  end loop;
 end if;
 update public.market_orders set status=p_next,tracking_note=case when p_next='shipped' then left(coalesce(p_tracking,''),150) else tracking_note end,updated_at=now(),
 payment_status=case when p_next='canceled' then 'canceled' else payment_status end
 where id=o.id;
 return jsonb_build_object('id',o.id,'status',p_next);
end $$;
revoke all on function public.market_checkout(uuid,uuid),public.market_transition_order(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.market_checkout(uuid,uuid),public.market_transition_order(uuid,uuid,text,text) to service_role;
-- Approve/reject seller applications in one atomic DB transaction.
create or replace function public.market_review_seller(p_actor uuid,p_user uuid,p_status text,p_note text default '')
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare app public.market_seller_applications%rowtype; c record;
begin
 if not exists (select 1 from public.market_roles where user_id=p_actor and role='owner') then raise exception 'FORBIDDEN';end if;
 if p_status not in ('approved','rejected') then raise exception 'INVALID_STATUS';end if;
 select * into app from public.market_seller_applications where user_id=p_user for update;
 if not found or app.status<>'pending' then raise exception 'APPLICATION_NOT_PENDING';end if;
 if p_status='approved' then
  select email_verified,whatsapp_verified into c from public.profiles where id=p_user and signup_verified=true;
  if not found then raise exception 'SELLER_CONTACTS_REQUIRED';end if;
  if not c.email_verified or not c.whatsapp_verified then raise exception 'SELLER_CONTACTS_REQUIRED';end if;
  if exists(select 1 from public.market_roles where user_id=p_user and role<>'buyer') then raise exception 'ROLE_FORBIDDEN';end if;
  insert into public.market_shops(owner_id,name,description,status)
   values(p_user,app.store_name,app.description,'active')
   on conflict(owner_id) do update set name=excluded.name,description=excluded.description,status='active';
  insert into public.market_roles(user_id,role) values(p_user,'seller')
   on conflict(user_id) do update set role='seller';
 end if;
 update public.market_seller_applications set status=p_status,owner_note=left(coalesce(p_note,''),300),reviewed_at=now() where user_id=p_user;
 return jsonb_build_object('status',p_status);
end $$;

-- COD payment collection is a seller declaration, NOT proof from a payment provider.
create or replace function public.market_report_cod(p_actor uuid,p_order uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare o public.market_orders%rowtype;
begin
 select * into o from public.market_orders where id=p_order for update;
 if not found then raise exception 'ORDER_NOT_FOUND';end if;
 if o.seller_id<>p_actor and not exists(select 1 from public.market_roles where user_id=p_actor and role='owner') then raise exception 'FORBIDDEN';end if;
 if o.status<>'delivered' then raise exception 'TRANSITION_FORBIDDEN';end if;
 update public.market_orders set payment_status='seller_reported_collected',updated_at=now() where id=p_order;
 return jsonb_build_object('reported',true);
end $$;
revoke all on function public.market_review_seller(uuid,uuid,text,text),public.market_report_cod(uuid,uuid) from public,anon,authenticated;
grant execute on function public.market_review_seller(uuid,uuid,text,text),public.market_report_cod(uuid,uuid) to service_role;

-- OWNER BOOTSTRAP: After logging into a verified account, run separately in SQL Editor:
-- insert into public.market_roles(user_id,role)
-- select id,'owner' from auth.users where lower(email)=lower('OWNER_EMAIL_HERE')
-- on conflict(user_id) do update set role='owner';
-- NEVER place that SQL in the app or grant owner roles through client requests.

-- Migration 009: performance & settings
-- Klikchart v4.2 - non-destructive upgrade. Run once on the existing v4.1 Supabase project.
-- Existing auth, OTP, profiles and orders are preserved.
create table if not exists public.market_user_settings (
 user_id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '',
 bio text not null default '',
 avatar_url text,
 theme text not null default 'light' check(theme in ('light','dark','system')),
 email_notifications boolean not null default true,
 order_notifications boolean not null default true,
 updated_at timestamptz not null default now()
);
create table if not exists public.market_site_settings (
 id integer primary key default 1 check(id=1),
 storefront_name text not null default 'Klikchart',
 announcement text not null default 'Belanja dengan nyaman dan aman di Klikchart.',
 support_email text not null default '',
 shipping_fee bigint not null default 15000 check(shipping_fee between 0 and 10000000),
 updated_at timestamptz not null default now()
);
insert into public.market_site_settings(id) values(1) on conflict(id) do nothing;
alter table public.market_user_settings enable row level security;
alter table public.market_site_settings enable row level security;
revoke all on public.market_user_settings,public.market_site_settings from anon,authenticated;
grant all on public.market_user_settings,public.market_site_settings to service_role;
create index if not exists market_orders_created_status_idx on public.market_orders(created_at desc,status);
create index if not exists market_orders_shop_created_idx on public.market_orders(shop_id,created_at desc);
create index if not exists market_shops_status_idx on public.market_shops(status);
create index if not exists market_seller_applications_pending_idx on public.market_seller_applications(status,created_at desc);

-- Compute counts and six-month trend inside PostgreSQL (not by downloading 1,000 rows).
create or replace function public.market_owner_overview(p_actor uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if not exists(select 1 from public.market_roles where user_id=p_actor and role='owner') then raise exception 'FORBIDDEN'; end if;
 select jsonb_build_object(
  'users',(select count(*) from public.profiles where signup_verified=true),
  'sellers',(select count(*) from public.market_shops),
  'orders',(select count(*) from public.market_orders),
  'products',(select count(*) from public.market_products),
  'pendingApplications',(select count(*) from public.market_seller_applications where status='pending'),
  'grossOrders',(select coalesce(sum(total),0) from public.market_orders where status<>'canceled'),
  'trend',(select coalesce(jsonb_agg(jsonb_build_object('key',to_char(month,'YYYY-MM'),'label',to_char(month,'Mon'),'value',coalesce(s.amount,0)) order by month),'[]'::jsonb)
     from generate_series(date_trunc('month',now())-interval '5 months',date_trunc('month',now()),interval '1 month') m(month)
     left join lateral (select sum(o.total) amount from public.market_orders o where o.created_at>=m.month and o.created_at<m.month+interval '1 month' and o.status<>'canceled') s on true),
  'latest',(select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc),'[]'::jsonb) from (select id,total,status,created_at from public.market_orders order by created_at desc limit 8)t),
  'approximate',false
 ) into result;
 return result;
end $$;
revoke all on function public.market_owner_overview(uuid) from public,anon,authenticated;
grant execute on function public.market_owner_overview(uuid) to service_role;

create or replace function public.market_seller_overview(p_actor uuid,p_shop uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
 if not exists(select 1 from public.market_shops where id=p_shop and owner_id=p_actor and status='active') then raise exception 'FORBIDDEN'; end if;
 select jsonb_build_object(
   'productCount',(select count(*) from public.market_products where shop_id=p_shop),
   'lowStock',(select count(*) from public.market_products where shop_id=p_shop and stock<=5),
   'orderCount',(select count(*) from public.market_orders where shop_id=p_shop),
   'orderTotal',(select coalesce(sum(total),0) from public.market_orders where shop_id=p_shop and status<>'canceled'),
   'recent',(select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at desc),'[]'::jsonb) from (select id,total,status,created_at from public.market_orders where shop_id=p_shop order by created_at desc limit 8)t),
   'trend',(select coalesce(jsonb_agg(jsonb_build_object('key',to_char(month,'YYYY-MM'),'label',to_char(month,'Mon'),'value',coalesce(s.amount,0)) order by month),'[]'::jsonb)
     from generate_series(date_trunc('month',now())-interval '5 months',date_trunc('month',now()),interval '1 month') m(month)
     left join lateral (select sum(o.total) amount from public.market_orders o where o.shop_id=p_shop and o.created_at>=m.month and o.created_at<m.month+interval '1 month' and o.status<>'canceled') s on true)
 ) into result;
 return result;
end $$;
revoke all on function public.market_seller_overview(uuid,uuid) from public,anon,authenticated;
grant execute on function public.market_seller_overview(uuid,uuid) to service_role;

-- Reuse the safe atomic checkout; fee is controlled by owner instead of hard-coded.
create or replace function public.market_checkout(p_buyer uuid,p_address uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare a public.market_addresses%rowtype; group_row record; item record;
  v_shipping bigint := 15000; o uuid; order_ids uuid[] := '{}'; subtotal bigint; shop_owner uuid; shop_status text;
begin
 select shipping_fee into v_shipping from public.market_site_settings where id=1;
 v_shipping:=coalesce(v_shipping,15000);
 select * into a from public.market_addresses where id=p_address and user_id=p_buyer;
 if not found then raise exception 'ADDRESS_INVALID'; end if;
 if not exists(select 1 from public.profiles where id=p_buyer and signup_verified=true) then raise exception 'ACCOUNT_INVALID';end if;
 -- Lock cart entries so overlapping checkouts for the same buyer serialize.
 perform 1 from public.market_cart_items where user_id=p_buyer order by product_id for update;
 if not exists(select 1 from public.market_cart_items where user_id=p_buyer) then raise exception 'CART_EMPTY';end if;
 for group_row in
  select p.shop_id from public.market_cart_items c join public.market_products p on p.id=c.product_id
  where c.user_id=p_buyer group by p.shop_id order by p.shop_id
 loop
  select owner_id,status into shop_owner,shop_status from public.market_shops where id=group_row.shop_id;
  if shop_owner=p_buyer or shop_status<>'active' then raise exception 'SHOP_UNAVAILABLE';end if;
  subtotal:=0;
  -- Product row locks prevent overselling during concurrent checkouts.
  for item in select p.*,c.quantity from public.market_cart_items c join public.market_products p on p.id=c.product_id
     where c.user_id=p_buyer and p.shop_id=group_row.shop_id order by p.id for update of p
  loop
   if item.status<>'published' or item.stock<item.quantity then raise exception 'OUT_OF_STOCK';end if;
   subtotal:=subtotal+(item.price*item.quantity);
  end loop;
  insert into public.market_orders(buyer_id,seller_id,shop_id,address_snapshot,subtotal,shipping_fee,total)
    values(p_buyer,shop_owner,group_row.shop_id,jsonb_build_object('recipient',a.recipient,'phone',a.phone,'address',a.address,'city',a.city,'province',a.province,'postal_code',a.postal_code),subtotal,v_shipping,subtotal+v_shipping) returning id into o;
  order_ids:=array_append(order_ids,o);
  for item in select p.*,c.quantity from public.market_cart_items c join public.market_products p on p.id=c.product_id
     where c.user_id=p_buyer and p.shop_id=group_row.shop_id order by p.id
  loop
   update public.market_products set stock=stock-item.quantity,updated_at=now() where id=item.id;
   insert into public.market_order_items(order_id,product_id,product_name,unit_price,quantity,line_total)
   values(o,item.id,item.name,item.price,item.quantity,item.price*item.quantity);
  end loop;
 end loop;
 delete from public.market_cart_items where user_id=p_buyer;
 return jsonb_build_object('orderIds',to_jsonb(order_ids),'count',cardinality(order_ids));
end $$;


revoke all on function public.market_checkout(uuid,uuid) from public,anon,authenticated;
grant execute on function public.market_checkout(uuid,uuid) to service_role;


-- V4.3 MIGRATION 010
-- Klikchart Commerce v4.3 / storefront and seller-managed product photo gallery.
-- Run once AFTER 009 on your existing project. Does not drop or overwrite users, orders or products.
BEGIN;
ALTER TABLE public.market_products
  ADD COLUMN IF NOT EXISTS images text[] NOT NULL DEFAULT '{}'::text[];
UPDATE public.market_products SET images=ARRAY[image_url]
 WHERE image_url IS NOT NULL AND image_url<>'' AND cardinality(images)=0;
ALTER TABLE public.market_products
  DROP CONSTRAINT IF EXISTS market_product_images_limit;
ALTER TABLE public.market_products
  ADD CONSTRAINT market_product_images_limit CHECK (cardinality(images)<=6);
CREATE INDEX IF NOT EXISTS market_products_shop_published_idx
  ON public.market_products(shop_id,created_at DESC) WHERE status='published';
CREATE INDEX IF NOT EXISTS market_orders_buyer_created_idx ON public.market_orders(buyer_id,created_at DESC);
CREATE INDEX IF NOT EXISTS market_orders_seller_created_idx ON public.market_orders(seller_id,created_at DESC);
CREATE INDEX IF NOT EXISTS market_products_price_published_idx
  ON public.market_products(price) WHERE status='published';
-- Service-role uploads only; no anon/authenticated upload, deletion or listing policies.
INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES('klikchart-products','klikchart-products',true,2097152,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT(id) DO UPDATE SET
 public=true,file_size_limit=2097152,
 allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp'];
-- Ratings are computed in PostgreSQL, not limited to the 30 most recent review cards.
CREATE OR REPLACE FUNCTION public.market_product_rating(p_product uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('count',COUNT(*),'average',COALESCE(ROUND(AVG(rating)::numeric,1),0))
 FROM public.market_reviews WHERE product_id=p_product;
$$;
REVOKE ALL ON FUNCTION public.market_product_rating(uuid) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.market_product_rating(uuid) TO service_role;
COMMIT;
