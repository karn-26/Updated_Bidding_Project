-- =============================================================================
-- 001_initial_schema.sql
-- Complete schema for FoodSource (restaurant_owner + supplier + delivery_partner)
-- Run this first in a fresh Supabase project via the SQL editor or supabase db push.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
create table if not exists orders (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid references auth.users not null,
  title         text not null,
  deadline      date,
  status        text not null default 'open',
  -- 'open' | 'closed' | 'cancelled' | 'in_delivery' | 'fulfilled'
  created_at    timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- order_items
-- ---------------------------------------------------------------------------
create table if not exists order_items (
  id        uuid primary key default gen_random_uuid(),
  order_id  uuid references orders(id) on delete cascade not null,
  name      text not null,
  quantity  numeric not null default 1,
  unit      text not null default 'units',
  notes     text
);

-- ---------------------------------------------------------------------------
-- bids
-- ---------------------------------------------------------------------------
create table if not exists bids (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid references orders(id) on delete cascade not null,
  supplier_id    uuid references auth.users not null,
  supplier_name  text not null,
  price          numeric not null,
  delivery_date  date,
  notes          text,
  status         text not null default 'pending',
  -- 'pending' | 'won' | 'rejected'
  created_at     timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users not null,
  title      text not null,
  message    text not null,
  is_read    boolean not null default false,
  link       text,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- order_presets
-- ---------------------------------------------------------------------------
create table if not exists order_presets (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid references auth.users not null,
  name          text not null,
  items         jsonb not null,
  created_at    timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- supplier_profiles
-- ---------------------------------------------------------------------------
create table if not exists supplier_profiles (
  id             uuid references auth.users primary key,
  business_name  text,
  city           text,
  country        text,
  latitude       numeric,
  longitude      numeric,
  average_rating numeric default 0,
  total_ratings  integer default 0,
  updated_at     timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- supplier_ratings
-- ---------------------------------------------------------------------------
create table if not exists supplier_ratings (
  id                       uuid primary key default gen_random_uuid(),
  supplier_id              uuid references auth.users not null,
  restaurant_id            uuid references auth.users not null,
  order_id                 uuid references orders(id) not null,
  restaurant_business_name text,
  rating                   integer not null check (rating between 1 and 5),
  review                   text,
  created_at               timestamptz default now(),
  unique (order_id)  -- one rating per order
);

-- ---------------------------------------------------------------------------
-- delivery_partners  (new)
-- ---------------------------------------------------------------------------
create table if not exists delivery_partners (
  id             uuid references auth.users primary key,
  business_name  text not null,
  city           text,
  country        text,
  phone          text,
  vehicle_type   text,
  -- 'bike' | 'car' | 'van' | 'truck'
  is_available   boolean default true,
  average_rating numeric default 0,
  total_ratings  integer default 0,
  updated_at     timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- deliveries  (new)
-- Created automatically when a bid is accepted (via Server Action / admin client).
-- ---------------------------------------------------------------------------
create table if not exists deliveries (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid references orders(id) on delete cascade not null unique,
  bid_id              uuid references bids(id) not null,
  delivery_partner_id uuid references auth.users,
  -- null until a partner claims it
  restaurant_id       uuid references auth.users not null,
  supplier_id         uuid references auth.users not null,
  pickup_address      text,
  dropoff_address     text,
  status              text not null default 'pending',
  -- 'pending' | 'claimed' | 'picked_up' | 'delivered'
  claimed_at          timestamptz,
  picked_up_at        timestamptz,
  delivered_at        timestamptz,
  created_at          timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- delivery_ratings  (new)
-- ---------------------------------------------------------------------------
create table if not exists delivery_ratings (
  id                  uuid primary key default gen_random_uuid(),
  delivery_id         uuid references deliveries(id) not null,
  delivery_partner_id uuid references auth.users not null,
  rated_by            uuid references auth.users not null,
  rating              integer not null check (rating between 1 and 5),
  review              text,
  created_at          timestamptz default now(),
  unique (delivery_id, rated_by)  -- one rating per rater per delivery
);
