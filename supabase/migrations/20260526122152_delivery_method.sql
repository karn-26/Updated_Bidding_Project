-- =============================================================================
-- delivery_method.sql
-- Add delivery_method to the deliveries table.
--
-- Two values:
--   'supplier'         — winning supplier handles delivery themselves.
--                        delivery_partner_id is set to supplier_id so the
--                        same updateDeliveryStatus action works unchanged.
--   'delivery_partner' — a delivery partner claims the job via the marketplace.
--
-- Supplier-handled deliveries start at status='claimed' (already assigned)
-- and never appear in the delivery partner marketplace feed.
-- =============================================================================

alter table deliveries
  add column if not exists delivery_method text not null default 'delivery_partner';

-- Refresh the "delivery partners can read pending deliveries" policy so
-- supplier-handled orders never surface in the delivery partner marketplace.
drop policy if exists "delivery partners can read pending deliveries" on deliveries;
create policy "delivery partners can read pending deliveries"
  on deliveries for select
  using (
    status = 'pending'
    and delivery_method = 'delivery_partner'
    and (auth.jwt() -> 'user_metadata' ->> 'role') = 'delivery_partner'
  );
