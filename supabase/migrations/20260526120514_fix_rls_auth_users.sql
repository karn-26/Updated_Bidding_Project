-- =============================================================================
-- fix_rls_auth_users.sql
-- Drop and recreate all RLS policies.
--
-- The authenticated role cannot query auth.users directly. All role checks
-- now use auth.jwt() -> 'user_metadata' ->> 'role' which reads from the JWT
-- without touching auth.users.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
drop policy if exists "restaurant owners can manage their own orders" on orders;
drop policy if exists "suppliers can read open orders" on orders;
drop policy if exists "authenticated users can read open orders" on orders;
drop policy if exists "delivery partners can read their in_delivery orders" on orders;
drop policy if exists "delivery partners can read their assigned orders" on orders;

create policy "restaurant owners can manage their own orders"
  on orders for all
  using  (auth.uid() = restaurant_id)
  with check (auth.uid() = restaurant_id);

create policy "authenticated users can read open orders"
  on orders for select
  using (status = 'open' and auth.role() = 'authenticated');

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
drop policy if exists "restaurant owners can manage their order items" on order_items;
drop policy if exists "suppliers can read order items for open orders" on order_items;
drop policy if exists "authenticated users can read open order items" on order_items;
drop policy if exists "delivery partners can read their assigned order items" on order_items;

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

create policy "authenticated users can read open order items"
  on order_items for select
  using (
    exists (
      select 1 from orders o
      where o.id = order_items.order_id
        and o.status = 'open'
    )
  );

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
drop policy if exists "suppliers can insert their own bids" on bids;
drop policy if exists "suppliers can read their own bids" on bids;
drop policy if exists "suppliers can update their own pending bids" on bids;
drop policy if exists "restaurant owners can read bids on their orders" on bids;
drop policy if exists "restaurant owners can update bids on their orders" on bids;

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
drop policy if exists "users can read own notifications" on notifications;
drop policy if exists "users can update own notifications" on notifications;

create policy "users can read own notifications"
  on notifications for select
  using (auth.uid() = user_id);

create policy "users can update own notifications"
  on notifications for update
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- order_presets
-- ---------------------------------------------------------------------------
drop policy if exists "restaurant owners manage their own presets" on order_presets;

create policy "restaurant owners manage their own presets"
  on order_presets for all
  using  (auth.uid() = restaurant_id)
  with check (auth.uid() = restaurant_id);

-- ---------------------------------------------------------------------------
-- supplier_profiles
-- ---------------------------------------------------------------------------
drop policy if exists "suppliers can insert their profile" on supplier_profiles;
drop policy if exists "suppliers can update their profile" on supplier_profiles;
drop policy if exists "authenticated users can read supplier profiles" on supplier_profiles;

create policy "suppliers can insert their profile"
  on supplier_profiles for insert
  with check (auth.uid() = id);

create policy "suppliers can update their profile"
  on supplier_profiles for update
  using  (auth.uid() = id)
  with check (auth.uid() = id);

create policy "authenticated users can read supplier profiles"
  on supplier_profiles for select
  using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- supplier_ratings
-- ---------------------------------------------------------------------------
drop policy if exists "restaurant owners can rate suppliers on their orders" on supplier_ratings;
drop policy if exists "authenticated users can read supplier ratings" on supplier_ratings;

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

create policy "authenticated users can read supplier ratings"
  on supplier_ratings for select
  using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- delivery_partners
-- ---------------------------------------------------------------------------
drop policy if exists "delivery partners can insert their profile" on delivery_partners;
drop policy if exists "delivery partners can update their profile" on delivery_partners;
drop policy if exists "authenticated users can read delivery partner profiles" on delivery_partners;

create policy "delivery partners can insert their profile"
  on delivery_partners for insert
  with check (auth.uid() = id);

create policy "delivery partners can update their profile"
  on delivery_partners for update
  using  (auth.uid() = id)
  with check (auth.uid() = id);

create policy "authenticated users can read delivery partner profiles"
  on delivery_partners for select
  using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- deliveries
-- ---------------------------------------------------------------------------
drop policy if exists "restaurant owners can read their deliveries" on deliveries;
drop policy if exists "suppliers can read deliveries for their bids" on deliveries;
drop policy if exists "delivery partners can read pending deliveries" on deliveries;
drop policy if exists "delivery partners can read their own deliveries" on deliveries;
drop policy if exists "delivery partners can claim and update their deliveries" on deliveries;

create policy "restaurant owners can read their deliveries"
  on deliveries for select
  using (auth.uid() = restaurant_id);

create policy "suppliers can read deliveries for their bids"
  on deliveries for select
  using (auth.uid() = supplier_id);

create policy "delivery partners can read pending deliveries"
  on deliveries for select
  using (
    status = 'pending'
    and (auth.jwt() -> 'user_metadata' ->> 'role') = 'delivery_partner'
  );

create policy "delivery partners can read their own deliveries"
  on deliveries for select
  using (auth.uid() = delivery_partner_id);

create policy "delivery partners can claim and update their deliveries"
  on deliveries for update
  using (
    (status = 'pending' and delivery_partner_id is null)
    or auth.uid() = delivery_partner_id
  )
  with check (auth.uid() = delivery_partner_id);

-- ---------------------------------------------------------------------------
-- delivery_ratings
-- ---------------------------------------------------------------------------
drop policy if exists "restaurant owners and suppliers can rate deliveries" on delivery_ratings;
drop policy if exists "authenticated users can read delivery ratings" on delivery_ratings;

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

create policy "authenticated users can read delivery ratings"
  on delivery_ratings for select
  using (auth.role() = 'authenticated');
