-- STEP 2 (once): Run this manually in Supabase SQL Editor AFTER migration 008.
-- Replace OWNER_EMAIL_HERE with the email of YOUR already-registered, verified account.
-- Do NOT run with an unrelated email. Do NOT paste this into website JavaScript.
do $$
declare v_id uuid;
begin
 select a.id into v_id
 from auth.users a
 join public.profiles p on p.id=a.id
 where lower(a.email)=lower('OWNER_EMAIL_HERE')
   and p.signup_verified=true and (p.email_verified=true or p.whatsapp_verified=true);
 if v_id is null then raise exception 'OWNER_ACCOUNT_NOT_FOUND_OR_NOT_VERIFIED';end if;
 insert into public.market_roles(user_id,role) values(v_id,'owner')
 on conflict(user_id) do update set role='owner';
end $$;
-- Verify safely: SELECT user_id, role FROM public.market_roles WHERE role='owner';
