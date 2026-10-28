-- KLIKCHART COMMERCE 4.4: UPGRADE LAMA v4.1 -> v4.4 (009 + 010).
-- Jalankan SEKALI saja jika tabel marketplace dari v4.1 (migration 008) sudah ada.
-- Jika 009 sudah pernah dijalankan, skrip ini dirancang aman untuk diulang, tetapi backup tetap wajib.
-- Tidak membuat ulang Supabase Auth, tidak menghapus akun/produk/pesanan.
-- Jangan jalankan jika kamu sudah punya skema lengkap v4.3/v4.4.
BEGIN;

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


-- Klikchart Commerce v4.3 / storefront and seller-managed product photo gallery.
-- Run once AFTER 009 on your existing project. Does not drop or overwrite users, orders or products.
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
