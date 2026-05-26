-- =============================================================================
-- 002_rls_policies.sql
-- Row Level Security for every table.
-- Service-role key bypasses RLS automatically — no extra policy needed.
--
-- Role checks use auth.jwt() -> 'user_metadata' ->> 'role' to read the
-- app role from the JWT. This avoids any direct access to auth.users,
-- which the authenticated role is not permitted to query.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
alter table orders enable row level security;

-- Restaurant owners: full CRUD on their own orders
create policy "restaurant owners can manage their own orders"
  on orders for all
  using  (auth.uid() = restaurant_id)
  with check (auth.uid() = restaurant_id);

-- Suppliers and delivery partners: read open orders
-- (suppliers need to browse and bid; delivery partners need to see order
--  details linked to their claimed delivery — covered separately below)
-- We use a simple authenticated check here; ownership on insert/update
-- is enforced by the restaurant_id policy above.
create policy "authenticated users can read open orders"
  on orders for select
  using (status = 'open' and auth.role() = 'authenticated');

-- Delivery partners: read orders assigned to them via a delivery record
create policy "delivery partners can read their assigned orders"
  on orders for select
  using (
    exists (
      select 1 from deliveries d
      where d.order_id = orders.id
        and d.delivery_partner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- order_items
-- ---------------------------------------------------------------------------
alter table order_items enable row level security;

-- Restaurant owners: full CRUD on items belonging to their orders
create policy "restaurant owners can manage their order items"
  on order_items for all
  using (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and o.restaurant_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and o.restaurant_id = auth.uid()
    )
  );

-- All authenticated users: read items on open orders (suppliers browsing)
create policy "authenticated users can read open order items"
  on order_items for select
  using (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and o.status = 'open'
    )
  );

-- Delivery partners: read items on orders assigned to them
create policy "delivery partners can read their assigned order items"
  on order_items for select
  using (
    exists (
      select 1 from deliveries d
      where d.order_id = order_items.order_id
        and d.delivery_partner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- bids
-- ---------------------------------------------------------------------------
alter table bids enable row level security;

-- Suppliers: full lifecycle on their own bids
create policy "suppliers can insert their own bids"
  on bids for insert
  with check (auth.uid() = supplier_id);

create policy "suppliers can read their own bids"
  on bids for select
  using (auth.uid() = supplier_id);

create policy "suppliers can update their own pending bids"
  on bids for update
  using (auth.uid() = supplier_id and status = 'pending')
  with check (auth.uid() = supplier_id);

-- Restaurant owners: read and action bids on their own orders
create policy "restaurant owners can read bids on their orders"
  on bids for select
  using (
    exists (
      select 1 from orders o
      where o.id = bids.order_id
        and o.restaurant_id = auth.uid()
    )
  );

create policy "restaurant owners can update bids on their orders"
  on bids for update
  using (
    exists (
      select 1 from orders o
      where o.id = bids.order_id
        and o.restaurant_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
alter table notifications enable row level security;

-- Users: read and mark-read their own notifications only
create policy "users can read own notifications"
  on notifications for select
  using (auth.uid() = user_id);

create policy "users can update own notifications"
  on notifications for update
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- INSERT is admin-only (service role bypasses RLS).

-- ---------------------------------------------------------------------------
-- order_presets
-- ---------------------------------------------------------------------------
alter table order_presets enable row level security;

create policy "restaurant owners manage their own presets"
  on order_presets for all
  using  (auth.uid() = restaurant_id)
  with check (auth.uid() = restaurant_id);

-- ---------------------------------------------------------------------------
-- supplier_profiles
-- ---------------------------------------------------------------------------
alter table supplier_profiles enable row level security;

-- Suppliers: manage their own profile row
create policy "suppliers can insert their profile"
  on supplier_profiles for insert
  with check (auth.uid() = id);

create policy "suppliers can update their profile"
  on supplier_profiles for update
  using  (auth.uid() = id)
  with check (auth.uid() = id);

-- Everyone authenticated: read profiles (locality matching, directory)
create policy "authenticated users can read supplier profiles"
  on supplier_profiles for select
  using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- supplier_ratings
-- ---------------------------------------------------------------------------
alter table supplier_ratings enable row level security;

-- Restaurant owners: insert a rating for an order they own
create policy "restaurant owners can rate suppliers on their orders"
  on supplier_ratings for insert
  with check (
    auth.uid() = restaurant_id
    and exists (
      select 1 from orders o
      where o.id = supplier_ratings.order_id
        and o.restaurant_id = auth.uid()
    )
  );

-- Everyone authenticated: read ratings (public trust signal)
create policy "authenticated users can read supplier ratings"
  on supplier_ratings for select
  using (auth.role() = 'authenticated');

-- No UPDATE or DELETE on supplier_ratings.

-- ---------------------------------------------------------------------------
-- delivery_partners
-- ---------------------------------------------------------------------------
alter table delivery_partners enable row level security;

-- Delivery partners: manage their own profile row
create policy "delivery partners can insert their profile"
  on delivery_partners for insert
  with check (auth.uid() = id);

create policy "delivery partners can update their profile"
  on delivery_partners for update
  using  (auth.uid() = id)
  with check (auth.uid() = id);

-- Everyone authenticated: read profiles
create policy "authenticated users can read delivery partner profiles"
  on delivery_partners for select
  using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- deliveries
-- ---------------------------------------------------------------------------
alter table deliveries enable row level security;

-- Restaurant owners: read deliveries on their orders
create policy "restaurant owners can read their deliveries"
  on deliveries for select
  using (auth.uid() = restaurant_id);

-- Suppliers: read deliveries for their won bids
create policy "suppliers can read deliveries for their bids"
  on deliveries for select
  using (auth.uid() = supplier_id);

-- Delivery partners: read all pending unclaimed deliveries (to browse & claim)
-- Uses auth.jwt() -> 'user_metadata' to avoid any access to auth.users.
create policy "delivery partners can read pending deliveries"
  on deliveries for select
  using (
    status = 'pending'
    and (auth.jwt() -> 'user_metadata' ->> 'role') = 'delivery_partner'
  );

-- Delivery partners: read their own active/completed deliveries
create policy "delivery partners can read their own deliveries"
  on deliveries for select
  using (auth.uid() = delivery_partner_id);

-- Delivery partners: claim a pending delivery or update one they own
create policy "delivery partners can claim and update their deliveries"
  on deliveries for update
  using (
    (status = 'pending' and delivery_partner_id is null)
    or auth.uid() = delivery_partner_id
  )
  with check (auth.uid() = delivery_partner_id);

-- INSERT is admin-only (service role, created on bid acceptance).

-- ---------------------------------------------------------------------------
-- delivery_ratings
-- ---------------------------------------------------------------------------
alter table delivery_ratings enable row level security;

-- Restaurant owners and suppliers can rate a delivery on their order
create policy "restaurant owners and suppliers can rate deliveries"
  on delivery_ratings for insert
  with check (
    auth.uid() = rated_by
    and exists (
      select 1 from deliveries d
      where d.id = delivery_ratings.delivery_id
        and (d.restaurant_id = auth.uid() or d.supplier_id = auth.uid())
    )
  );

-- Everyone authenticated: read ratings
create policy "authenticated users can read delivery ratings"
  on delivery_ratings for select
  using (auth.role() = 'authenticated');
