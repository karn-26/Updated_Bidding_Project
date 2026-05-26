-- =============================================================================
-- 002_rls_policies.sql
-- Row Level Security for every table.
-- Service-role key bypasses RLS automatically — no extra policy needed.
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

-- Suppliers: read open orders only
create policy "suppliers can read open orders"
  on orders for select
  using (
    auth.jwt() ->> 'role' = 'authenticated'
    and status = 'open'
  );

-- Delivery partners: read orders that are in_delivery and assigned to them
-- (they need to see the order title/items on their active delivery)
create policy "delivery partners can read their in_delivery orders"
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

-- Restaurant owners: manage items on their own orders
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

-- Suppliers: read items on open orders
create policy "suppliers can read order items for open orders"
  on order_items for select
  using (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and o.status = 'open'
    )
  );

-- Delivery partners: read items on orders assigned to them
create policy "delivery partners can read order items for their deliveries"
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

-- Suppliers: insert and manage their own bids
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

-- Restaurant owners: read bids on their own orders
create policy "restaurant owners can read bids on their orders"
  on bids for select
  using (
    exists (
      select 1 from orders o
      where o.id = bids.order_id
        and o.restaurant_id = auth.uid()
    )
  );

-- Restaurant owners: update bids on their own orders (accept/reject)
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

-- Users: read and update their own notifications
create policy "users can read own notifications"
  on notifications for select
  using (auth.uid() = user_id);

create policy "users can update own notifications"
  on notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- INSERT is handled by admin client (service role) only — no user policy needed.
-- Service role bypasses RLS by default.

-- ---------------------------------------------------------------------------
-- order_presets
-- ---------------------------------------------------------------------------
alter table order_presets enable row level security;

create policy "restaurant owners manage their own presets"
  on order_presets for all
  using (auth.uid() = restaurant_id)
  with check (auth.uid() = restaurant_id);

-- ---------------------------------------------------------------------------
-- supplier_profiles
-- ---------------------------------------------------------------------------
alter table supplier_profiles enable row level security;

-- Suppliers: manage their own profile
create policy "suppliers can insert their profile"
  on supplier_profiles for insert
  with check (auth.uid() = id);

create policy "suppliers can update their profile"
  on supplier_profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Everyone authenticated: read supplier profiles (for locality matching)
create policy "authenticated users can read supplier profiles"
  on supplier_profiles for select
  using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- supplier_ratings
-- ---------------------------------------------------------------------------
alter table supplier_ratings enable row level security;

-- Restaurant owners: insert ratings for orders they own
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

-- No updates or deletes on supplier_ratings.

-- ---------------------------------------------------------------------------
-- delivery_partners
-- ---------------------------------------------------------------------------
alter table delivery_partners enable row level security;

-- Delivery partners: manage their own profile
create policy "delivery partners can insert their profile"
  on delivery_partners for insert
  with check (auth.uid() = id);

create policy "delivery partners can update their profile"
  on delivery_partners for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Everyone authenticated: read delivery partner profiles
create policy "authenticated users can read delivery partner profiles"
  on delivery_partners for select
  using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- deliveries
-- ---------------------------------------------------------------------------
alter table deliveries enable row level security;

-- Restaurant owners: read deliveries for their orders
create policy "restaurant owners can read their deliveries"
  on deliveries for select
  using (auth.uid() = restaurant_id);

-- Suppliers: read deliveries for their won bids
create policy "suppliers can read deliveries for their bids"
  on deliveries for select
  using (auth.uid() = supplier_id);

-- Delivery partners: read ALL pending deliveries (to browse and claim)
create policy "delivery partners can read pending deliveries"
  on deliveries for select
  using (
    status = 'pending'
    and exists (
      select 1 from auth.users u
      where u.id = auth.uid()
        and u.raw_user_meta_data ->> 'role' = 'delivery_partner'
    )
  );

-- Delivery partners: read their own claimed/active deliveries
create policy "delivery partners can read their own deliveries"
  on deliveries for select
  using (auth.uid() = delivery_partner_id);

-- Delivery partners: update to claim a delivery (pending → claimed)
-- and to update status on deliveries they already own
create policy "delivery partners can claim and update their deliveries"
  on deliveries for update
  using (
    -- Either it's unclaimed (claiming it) or they already own it
    (status = 'pending' and delivery_partner_id is null)
    or auth.uid() = delivery_partner_id
  )
  with check (
    auth.uid() = delivery_partner_id
  );

-- INSERT is admin-only (created when bid is accepted in Server Action).

-- ---------------------------------------------------------------------------
-- delivery_ratings
-- ---------------------------------------------------------------------------
alter table delivery_ratings enable row level security;

-- Restaurant owners and suppliers can rate deliveries on their orders
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

-- Everyone authenticated: read delivery ratings
create policy "authenticated users can read delivery ratings"
  on delivery_ratings for select
  using (auth.role() = 'authenticated');
