-- =============================================================================
-- 005_delivery_redesign.sql
-- Delivery redesign: supplier chooses delivery method at bid time,
-- Japanese address fields, restaurant_profiles, partner deadline fallback.
-- Drop-safe: all ADD COLUMN / CREATE TABLE use IF NOT EXISTS / IF NOT EXISTS.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. bids — delivery_type, delivery_fee, delivery_fee_estimated
-- ---------------------------------------------------------------------------
alter table bids
  add column if not exists delivery_type          text    not null default 'supplier',
  add column if not exists delivery_fee           numeric not null default 0,
  add column if not exists delivery_fee_estimated boolean not null default false;

-- delivery_type: 'supplier' | 'partner'

-- ---------------------------------------------------------------------------
-- 2. deliveries — pickup/dropoff lat/lng for proximity sorting,
--                  partner_deadline for fallback
-- ---------------------------------------------------------------------------
alter table deliveries
  add column if not exists pickup_lat       numeric,
  add column if not exists pickup_lng       numeric,
  add column if not exists dropoff_lat      numeric,
  add column if not exists dropoff_lng      numeric,
  add column if not exists delivery_fee     numeric not null default 0,
  add column if not exists partner_deadline timestamptz;

-- ---------------------------------------------------------------------------
-- 3. restaurant_profiles — Japan address + coordinates
--    Delivery dropoff address lives here.
-- ---------------------------------------------------------------------------
create table if not exists restaurant_profiles (
  id           uuid references auth.users primary key,
  business_name text,
  postal_code  text,
  prefecture   text,
  city_ward    text,
  block_banchi text,
  latitude     numeric,
  longitude    numeric,
  updated_at   timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- 4. supplier_profiles — add Japan address fields
--    (keep city/country columns; they remain but are superseded by the four
--     structured address fields below; old values are ignored in new code)
-- ---------------------------------------------------------------------------
alter table supplier_profiles
  add column if not exists postal_code  text,
  add column if not exists prefecture   text,
  add column if not exists city_ward    text,
  add column if not exists block_banchi text;
-- latitude/longitude already exist in the initial schema

-- ---------------------------------------------------------------------------
-- 5. delivery_partners — add Japan address fields + coordinates
--    (keep city/country columns for backward compat; superseded below)
-- ---------------------------------------------------------------------------
alter table delivery_partners
  add column if not exists postal_code  text,
  add column if not exists prefecture   text,
  add column if not exists city_ward    text,
  add column if not exists block_banchi text,
  add column if not exists latitude     numeric,
  add column if not exists longitude    numeric;

-- ---------------------------------------------------------------------------
-- 6. RLS for restaurant_profiles
-- ---------------------------------------------------------------------------
alter table restaurant_profiles enable row level security;

drop policy if exists "restaurant owners can manage their profile" on restaurant_profiles;
create policy "restaurant owners can manage their profile"
  on restaurant_profiles for all
  using  (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "authenticated users can read restaurant profiles" on restaurant_profiles;
create policy "authenticated users can read restaurant profiles"
  on restaurant_profiles for select
  using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- 7. Update deliveries RLS — pending filter must also check delivery_method
--    to keep supplier-handled deliveries off the partner feed.
--    Also add supplier UPDATE policy so supplier can self-deliver fallback.
-- ---------------------------------------------------------------------------
drop policy if exists "delivery partners can read pending deliveries" on deliveries;
create policy "delivery partners can read pending deliveries"
  on deliveries for select
  using (
    status = 'pending'
    and delivery_method = 'delivery_partner'
    and (auth.jwt() -> 'user_metadata' ->> 'role') = 'delivery_partner'
  );

-- Suppliers can update deliveries for their own won bids
-- (needed for self-deliver fallback and stage updates)
drop policy if exists "suppliers can update their deliveries" on deliveries;
create policy "suppliers can update their deliveries"
  on deliveries for update
  using  (auth.uid() = supplier_id)
  with check (auth.uid() = supplier_id);
