-- =============================================================================
-- 003_realtime.sql
-- Enable Supabase Realtime on tables that need live updates.
--
-- Run AFTER 001 and 002.
-- If supabase_realtime publication doesn't exist yet, the first ALTER will
-- create it. On hosted Supabase projects it already exists.
-- =============================================================================

-- notifications: live bell icon updates for all roles
alter publication supabase_realtime add table notifications;

-- bids: live bid-status panel for suppliers (MyBidsPanel)
--       and live bid list for restaurant owners (/bids page)
alter publication supabase_realtime add table bids;

-- orders: live order feed for suppliers (LiveOrdersFeed)
alter publication supabase_realtime add table orders;

-- deliveries: live delivery board for delivery partners (LiveDeliveriesFeed)
--             and status updates for restaurant owners and suppliers
alter publication supabase_realtime add table deliveries;
