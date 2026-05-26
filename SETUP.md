# FoodSource — Fresh Supabase Project Setup

Follow these steps exactly to wire a new Supabase project to this codebase.

---

## 1. Create a new Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and click **New project**.
2. Choose your organisation, give it a name (e.g. `foodsource-prod`), pick a region closest to your users, and set a strong database password.
3. Wait ~2 minutes for provisioning.

---

## 2. Get your credentials

From **Project Settings → API**:

| Variable | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` / `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key (keep secret!) |

---

## 3. Update `.env.local`

Create (or update) `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Claude API (needed for AI order extraction and bid suggestion)
ANTHROPIC_API_KEY=your-anthropic-key
```

**Never commit `.env.local` to git.**

---

## 4. Run migrations

You have two options:

### Option A — Supabase CLI (recommended)

```bash
# Install CLI if needed
npm install -g supabase

# Link to your project (get project ref from dashboard URL)
supabase link --project-ref your-project-ref

# Push all migrations
supabase db push
```

### Option B — SQL editor (manual)

In the Supabase dashboard go to **SQL Editor** and run each file in order:

1. Paste and run `supabase/migrations/20240101000001_initial_schema.sql`
2. Paste and run `supabase/migrations/20240101000002_rls_policies.sql`
3. Paste and run `supabase/migrations/20240101000003_realtime.sql`

---

## 5. Enable Realtime in the dashboard

If the Realtime migration didn't take effect automatically:

1. Go to **Database → Replication**.
2. Under **supabase_realtime**, enable the toggle for each table:
   - `notifications`
   - `bids`
   - `orders`
   - `deliveries`

---

## 6. Configure Auth redirect URLs

In **Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000` (update to your production URL when deploying)
- **Redirect URLs**: Add `http://localhost:3000/auth/callback`

---

## 7. Verify RLS is active

In **Database → Tables**, click each table and confirm **RLS enabled** is shown. All tables should have it on after running migration 002.

---

## 8. Test checklist — full three-sided flow

Work through these steps to verify the system end-to-end:

### Setup
- [ ] Sign up as a **Restaurant Owner** (`restaurant_owner` role) — confirm email
- [ ] Sign up as a **Supplier** (`supplier` role) — confirm email
- [ ] Sign up as a **Delivery Partner** (`delivery_partner` role) — confirm email

### Order flow
- [ ] Log in as Restaurant Owner → `/dashboard` loads with correct stats
- [ ] Place a new order (any method) — confirm it appears on dashboard
- [ ] Log in as Supplier → new order appears in LiveOrdersFeed
- [ ] Supplier receives "New Order Available" notification in bell

### Bid flow
- [ ] Supplier submits a bid on the order
- [ ] Restaurant Owner receives "New Bid Received" notification
- [ ] Restaurant Owner sees bid on `/bids` page with supplier profile
- [ ] Restaurant Owner accepts the bid

### Delivery flow
- [ ] After accepting bid: order status becomes `in_delivery`
- [ ] A delivery record is created with status `pending`
- [ ] All Delivery Partners receive "New Delivery Available" notification
- [ ] Log in as Delivery Partner → pending delivery appears in LiveDeliveriesFeed
- [ ] Delivery Partner clicks **Claim Delivery** — delivery status → `claimed`
- [ ] Restaurant Owner + Supplier both receive "Delivery Claimed" notification
- [ ] Delivery Partner clicks **Mark as Picked Up** — status → `picked_up`
- [ ] Delivery Partner clicks **Mark as Delivered** — status → `delivered`
- [ ] Order status updates to `fulfilled`
- [ ] Restaurant Owner + Supplier receive "Delivery Completed" notification

### Ratings
- [ ] Restaurant Owner receives "Rate your delivery partner" notification
- [ ] Rating is submitted → `delivery_partners.average_rating` updates
- [ ] Supplier can see delivery status on won bid in MyBidsPanel

### Notifications (spot check)
- [ ] All notifications arrive in real-time (no page refresh needed)
- [ ] Mark-all-read clears the bell counter

---

## 9. Production deployment

When deploying to Vercel or similar:

1. Add all env vars from step 3 to your hosting provider's environment settings.
2. Update `NEXT_PUBLIC_SITE_URL` to your production domain.
3. Update Supabase **Site URL** and **Redirect URLs** to production domain.
4. Re-run `supabase db push` against production project ref.
