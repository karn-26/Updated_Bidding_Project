-- =============================================================================
-- 006_delivery_order_access.sql
-- Allow delivery partners to read orders (title + items) that appear in the
-- pending partner-delivery feed — even before the job has been claimed.
--
-- Without these policies the nested orders JOIN returns NULL and the order
-- title slot on the delivery job card shows "—".
--
-- Drop-safe: all policies use DROP IF EXISTS before CREATE.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- orders: delivery partners can read orders with pending partner deliveries
-- ---------------------------------------------------------------------------
drop policy if exists "delivery partners can read pending partner delivery orders" on orders;
create policy "delivery partners can read pending partner delivery orders"
  on orders for select
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'delivery_partner'
    and exists (
      select 1 from deliveries d
      where d.order_id = orders.id
        and d.status          = 'pending'
        and d.delivery_method = 'delivery_partner'
    )
  );

-- ---------------------------------------------------------------------------
-- order_items: delivery partners can read items on those same orders
-- ---------------------------------------------------------------------------
drop policy if exists "delivery partners can read pending partner delivery order items" on order_items;
create policy "delivery partners can read pending partner delivery order items"
  on order_items for select
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'delivery_partner'
    and exists (
      select 1 from deliveries d
      where d.order_id         = order_items.order_id
        and d.status           = 'pending'
        and d.delivery_method  = 'delivery_partner'
    )
  );

-- ---------------------------------------------------------------------------
-- delivery_ratings: explicit drop-then-recreate for supplier INSERT
-- (confirms supplier can rate, without reading auth.users)
-- ---------------------------------------------------------------------------
alter table delivery_ratings enable row level security;

drop policy if exists "restaurant owners and suppliers can rate deliveries" on delivery_ratings;
create policy "suppliers can rate partner deliveries"
  on delivery_ratings for insert
  with check (
    auth.uid() = rated_by
    and exists (
      select 1 from deliveries d
      where d.id            = delivery_ratings.delivery_id
        and d.supplier_id   = auth.uid()
        and d.delivery_method = 'delivery_partner'
    )
  );

drop policy if exists "authenticated users can read delivery ratings" on delivery_ratings;
create policy "authenticated users can read delivery ratings"
  on delivery_ratings for select
  using (auth.role() = 'authenticated');
