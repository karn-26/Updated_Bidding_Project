# PROJECT_CONTEXT.md

> Comprehensive reference for AI assistants (or new developers) with zero prior context on this codebase.

---

## 1. Project Overview

### What it does
**FoodSource** is a two-sided B2B marketplace that connects restaurant owners with food/ingredient suppliers through a transparent competitive-bidding system. The core workflow is:

1. A restaurant owner posts a procurement order (e.g. "Weekly Produce — 10 kg tomatoes, 5 L olive oil…")
2. Verified suppliers browse open orders and submit competitive bids (price + delivery date + notes)
3. The restaurant owner reviews bids side-by-side and accepts the best one with a single click
4. Accepting a bid automatically closes the order and notifies all other suppliers that their bid was not selected

### Problem it solves
Traditional restaurant procurement involves phone calls, WhatsApp chains, and ad-hoc supplier relationships. FoodSource replaces that with a structured, asynchronous bidding market — reducing admin overhead and surfacing competitive pricing.

### Who it's for
- **Restaurant owners** — post ingredient/supply orders, manage procurement, track fulfillment
- **Suppliers** (distributors, wholesalers) — browse live orders, submit bids, grow their customer base

### Development stage
**Early MVP** — all core flows are functional and the app was being deployed to Vercel. No tests exist. The README is still the boilerplate `create-next-app` README (not project-specific).

---

## 2. Tech Stack & Architecture

### Languages & Frameworks
| Layer | Technology |
|---|---|
| Framework | Next.js 14.2.35 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3.4 + custom component classes in `globals.css` |
| Auth & Database | Supabase (PostgreSQL + Supabase Auth) |
| AI | Anthropic Claude API (`@anthropic-ai/sdk ^0.78.0`) |
| Font | Inter (Google Fonts via `next/font`) |

### Architecture Pattern
**Monolith** — single Next.js App Router application. No microservices or separate backend.

- **Server Components** handle all data fetching (pages render on the server with Supabase queries)
- **Client Components** (`"use client"`) handle interactivity: forms, real-time UI updates, voice recording
- **Server Actions** (`"use server"`) handle all mutations: auth, bid accept/reject, preset management
- **API Route Handlers** (`app/api/*/route.ts`) proxy Anthropic Claude API calls (keeps the API key server-side)

### External Services
| Service | Purpose |
|---|---|
| Supabase | PostgreSQL database, row-level security (RLS), email/password auth, Realtime (WebSocket pub/sub) |
| Anthropic Claude API | Two features: (1) item extraction from photos/voice using `claude-opus-4-6`, (2) bid price suggestion using `claude-haiku-4-5-20251001` |
| Vercel | Deployment target |

---

## 3. Codebase Structure

```
Bidding_Project/
├── app/                          # Next.js App Router root
│   ├── layout.tsx                # Root layout: fetches user + notifications, renders Navbar/Footer
│   ├── page.tsx                  # Public landing page (redirects logged-in users to their dashboard)
│   ├── globals.css               # Tailwind directives + custom component classes (btn-primary, card, input, etc.)
│   │
│   ├── auth/
│   │   ├── actions.ts            # Server Actions: signUp(), signIn(), signOut()
│   │   ├── login/page.tsx        # Login form
│   │   ├── signup/page.tsx       # Signup form (captures role + business_name)
│   │   ├── confirm/page.tsx      # "Check your email" screen after signup
│   │   └── callback/route.ts     # Supabase auth callback handler (email confirmation redirect)
│   │
│   ├── dashboard/
│   │   └── page.tsx              # Restaurant owner dashboard: stats, orders table, quick reorder presets
│   │
│   ├── orders/
│   │   ├── new/page.tsx          # Multi-step order creation wizard (photo / voice / manual -> AI extract -> review -> save)
│   │   └── [id]/page.tsx         # Order detail view (items list, status, link to bids)
│   │
│   ├── bids/
│   │   ├── page.tsx              # Restaurant owner: view all bids with filter tabs, accept/reject actions
│   │   └── actions.ts            # Server Actions: acceptBid(), rejectBid() — updates DB + sends notifications
│   │
│   ├── presets/
│   │   ├── page.tsx              # Presets management page (server shell, delegates to PresetsClient)
│   │   └── actions.ts            # Server Actions: createPreset(), deletePreset(), placeOrderFromPreset()
│   │
│   ├── notifications/
│   │   └── actions.ts            # Server Actions: markNotificationRead(), markAllNotificationsRead()
│   │
│   ├── supplier/
│   │   ├── dashboard/page.tsx    # Supplier dashboard: open orders list + MyBidsPanel sidebar
│   │   └── bids/
│   │       ├── new/page.tsx      # Submit bid form (client component, fetches order, AI price suggestion)
│   │       ├── [id]/page.tsx     # Bid detail / edit view
│   │       └── actions.ts        # Server Actions for supplier bid mutations
│   │
│   └── api/
│       ├── extract-order/route.ts  # POST — sends photo (base64) or text to claude-opus-4-6; returns structured OrderItem[]
│       ├── suggest-bid/route.ts    # POST — sends order data to claude-haiku-4-5-20251001; returns { suggestedPrice, reasoning }
│       ├── notify-new-bid/route.ts # POST — inserts notification for the restaurant owner when a bid is placed
│       └── notify-new-order/route.ts # POST — broadcasts notification to ALL suppliers when an order is posted
│
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx            # Top nav with role-aware links, NotificationBell, SignOutButton
│   │   ├── Footer.tsx            # Simple footer
│   │   ├── NotificationBell.tsx  # Client component: dropdown bell, listens to Supabase Realtime for live updates
│   │   └── SignOutButton.tsx     # Client component wrapping the signOut() Server Action
│   ├── presets/
│   │   ├── PresetsClient.tsx     # Client component: preset cards with delete + quick-order actions
│   │   └── QuickOrderButton.tsx  # Client component: opens deadline picker, calls placeOrderFromPreset()
│   └── supplier/
│       ├── MyBidsPanel.tsx       # Client component: tabbed bid list with Supabase Realtime for live status updates
│       └── EditBidForm.tsx       # Client component: edit a pending bid
│
├── lib/
│   └── supabase/
│       ├── client.ts             # Browser Supabase client (for Client Components)
│       ├── server.ts             # Server Supabase client using cookies (for Server Components / Actions)
│       └── admin.ts              # Service-role admin client — bypasses RLS (used for cross-user notifications)
│
├── types/
│   └── index.ts                  # Shared TypeScript types: UserRole, User, Order, OrderItem, Bid
│
├── middleware.ts                  # Auth guard + role-based redirects for all protected routes
├── tailwind.config.ts             # Custom brand colors, card box-shadows
├── next.config.mjs                # Empty (default Next.js config)
├── tsconfig.json                  # Standard Next.js TS config, path alias @ -> root
└── package.json                   # Dependencies and scripts
```

### Entry Points
- **Web request**: `middleware.ts` runs first on every matched request, then Next.js resolves to `app/layout.tsx` + the matching page
- **Public landing**: `app/page.tsx` — unauthenticated users see the marketing page; authenticated users are immediately redirected
- **Restaurant app**: `app/dashboard/page.tsx`
- **Supplier app**: `app/supplier/dashboard/page.tsx`

---

## 4. Setup & Running

### Install & Run
```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # Production build
npm run start      # Serve production build
npm run lint       # ESLint
```

### Required Environment Variables
Create a `.env.local` file in the project root:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
NEXT_PUBLIC_SITE_URL
```

| Variable | Where it's used |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | All three Supabase clients |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `lib/supabase/client.ts`, `lib/supabase/server.ts`, `middleware.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase/admin.ts` — bypasses RLS; must never be exposed to the browser |
| `ANTHROPIC_API_KEY` | `app/api/extract-order/route.ts`, `app/api/suggest-bid/route.ts` |
| `NEXT_PUBLIC_SITE_URL` | Auth callback URL in `app/auth/actions.ts` (`signUp`) |

### Supabase: Auth Configuration
In your Supabase project under **Authentication → URL Configuration**, add a redirect URL:
```
http://localhost:3000/auth/callback
```

### Database Setup
There is **no migrations folder**. The required SQL DDL is embedded as comments directly in source files:

- **`orders` + `order_items` tables**: comment at `app/orders/new/page.tsx:236-254`
- **`order_presets` table + RLS policies**: comment at `app/presets/actions.ts:3-17`

You also need a `bids` table and a `notifications` table. These are not documented in SQL comments but can be inferred from the queries:

**`bids`**:
```sql
create table bids (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade not null,
  supplier_id uuid references auth.users not null,
  supplier_name text not null,
  price numeric not null,
  delivery_date date,
  notes text,
  status text not null default 'pending', -- 'pending' | 'won' | 'rejected'
  created_at timestamptz default now()
);
```

**`notifications`**:
```sql
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  title text not null,
  message text not null,
  is_read boolean not null default false,
  link text,
  created_at timestamptz default now()
);
```

You also need to enable **Supabase Realtime** on the `notifications` and `bids` tables for live updates to work.

---

## 5. Current State & Context

### What's been built
All core features are implemented and working:

- **Authentication**: Email/password signup with role selection (`restaurant_owner` / `supplier`) and business name. Role and business name are stored in Supabase `user_metadata`. Email confirmation is enabled.
- **Restaurant owner flow**:
  - Create orders via a 3-method wizard: upload a photo of a handwritten list (Claude vision), record voice (Web Speech API → Claude text extraction), or type manually
  - Dashboard with stat cards (open orders, pending bids, fulfilled orders)
  - Order detail page
  - Bids inbox page with filter tabs (All / Pending / Accepted / Rejected) and per-order filtering via `?order=` URL param
  - Accept bid (marks winner as `won`, rejects all others, closes order, notifies all suppliers)
  - Reject individual bid
  - Order presets for one-click reordering
- **Supplier flow**:
  - Dashboard showing all open orders with item tags
  - "Bid Submitted" indicator if they've already bid on an order
  - Submit bid form with AI price suggestion (Claude Haiku analyses order items and returns a recommended price + reasoning)
  - Real-time bid status updates via Supabase Realtime (`MyBidsPanel.tsx`)
  - Edit pending bids (`EditBidForm.tsx`)
  - Bid detail view
- **Notifications**: In-app bell in the navbar. Loads initial 30 on page load, then listens for new ones via Supabase Realtime. Mark-as-read and mark-all-read. Notifications are created by:
  - `POST /api/notify-new-order` (when a restaurant posts an order — all suppliers notified)
  - `POST /api/notify-new-bid` (when a supplier places a bid — restaurant owner notified)
  - `acceptBid()` Server Action (winning supplier + rejected suppliers all notified)
  - `rejectBid()` Server Action (rejected supplier notified)
  - `placeOrderFromPreset()` Server Action (all suppliers notified)
- **Route protection**: `middleware.ts` covers all app routes. Handles: unauthenticated redirect to login, post-login redirect to correct dashboard, cross-role access blocking (supplier can't access `/dashboard`, restaurant owner can't access `/supplier/*`).

### Known Issues & Gotchas
- **No migration files** — the database schema exists only as SQL comments in application code. A newcomer must manually run these DDL statements.
- **Notification broadcast scalability**: `notify-new-order/route.ts` and `placeOrderFromPreset()` call `admin.auth.admin.listUsers({ perPage: 1000 })` to fan out to all suppliers — this will silently miss users beyond the first 1,000.
- **Bid status naming mismatch**: The database stores accepted bids as `status = "won"`, but the UI calls them "Accepted". The mapping lives in `app/bids/page.tsx:13-17` (`STATUS_MAP`). Searching for "accepted" in the DB will find nothing.
- **Voice input browser dependency**: `app/orders/new/page.tsx` uses `window.SpeechRecognition` / `window.webkitSpeechRecognition` — only works in Chrome and Edge. The UI degrades gracefully (disables the voice option card).
- **No rate limiting** on `/api/extract-order` or `/api/suggest-bid` — any authenticated (or even unauthenticated) request can call Claude at the app owner's cost.
- **No test suite** — zero unit, integration, or e2e tests.
- **No error boundaries** — unhandled promise rejections in client components will silently fail.
- **`app/supplier/bids/[id]/page.tsx`** exists but was not fully reviewed; `EditBidForm.tsx` component also exists — these represent the bid-editing flow for suppliers.

### Recent Commits (newest first)
| Hash | Message |
|---|---|
| `90953ba` | fix SupplierBid orders type to array |
| `d2252ab` | fix SupplierBid type error in supplier dashboard |
| `28370ad` | fix StatCard trend prop type error |
| `8fba45f` | fix typescript error in bids page |
| `ffdb5c1` | fix eslint errors for vercel build |
| `0601f5c` | latest changes |
| `2c7b63b` | added working notification system |
| `3628059` | Initial commit |
| `f0f8d90` | Initial commit from Create Next App |

The last several commits are TypeScript/ESLint fixes targeting a clean Vercel build. The notification system was added in `2c7b63b`.

---

## 6. Conventions & Patterns

### Styling
- Tailwind utility classes everywhere. **No CSS Modules or styled-components**.
- Custom reusable component classes are defined in `app/globals.css` using `@layer components`:
  - `.btn-primary` — indigo filled button
  - `.btn-secondary` — white/bordered button
  - `.btn-danger` — red tinted button
  - `.card` — white rounded card with light border + shadow
  - `.input` — styled form input
  - `.label` — form label
  - `.badge` — pill badge
- Custom Tailwind theme extensions in `tailwind.config.ts`: `brand.*` color scale, `shadow-card`, `shadow-card-hover`.

### Data Fetching
- **Server Components** fetch data directly with the server Supabase client (`lib/supabase/server.ts`). No `useEffect` + fetch patterns on the server side.
- **Client Components** that need data use `useEffect` + `createClient()` from `lib/supabase/client.ts` (e.g. `app/supplier/bids/new/page.tsx` fetches the order on mount).

### Mutations
- All mutations go through **Next.js Server Actions** (`"use server"` directive), not API routes.
- API routes are reserved exclusively for Anthropic Claude proxying and notification fan-out.
- Server Actions call `revalidatePath()` after mutations to bust the Next.js cache.

### Supabase Client Selection
There are three different Supabase clients — using the wrong one is a common mistake:

| Client | File | Use case |
|---|---|---|
| Browser client | `lib/supabase/client.ts` | Client Components only (`"use client"`) |
| Server client | `lib/supabase/server.ts` | Server Components, Server Actions, middleware — reads auth session from cookies |
| Admin client | `lib/supabase/admin.ts` | Server-side only; uses `SUPABASE_SERVICE_ROLE_KEY`; bypasses RLS entirely — used when writing notifications across different users |

### Authentication & Role
- Role is stored in `user.user_metadata.role` — either `"restaurant_owner"` or `"supplier"`.
- Business name is in `user.user_metadata.business_name`.
- Middleware reads the role from `user_metadata` and enforces cross-role route protection.
- Note: middleware checks `role === "restaurant"` (line 59) when protecting `/supplier/*` from restaurant owners — but role is stored as `"restaurant_owner"`. This may be a latent bug if a user with `role = "restaurant_owner"` tries to access supplier routes; the check won't fire. In practice it works because suppliers are redirected away from `/dashboard` separately.

### Component Co-location
- Sub-components (e.g. `StatCard`, `Shell`, `Header`, `MethodCard`, icon helpers) are defined at the bottom of the same file that uses them rather than extracted to separate files. This keeps large page files long (e.g. `app/orders/new/page.tsx` is 1,073 lines).

### Notification Pattern
Notifications are fire-and-forget from the client side:
```ts
fetch("/api/notify-new-bid", { method: "POST", ... }).catch(console.error);
```
They use the admin client server-side so they can write to any user's notifications row regardless of who triggered the action.

### TypeScript
- Strict mode. No `any` except where the Web Speech API requires it (explicitly suppressed with `eslint-disable` comments).
- Types for Supabase rows are defined inline per-file rather than generated from the schema. `types/index.ts` has the shared domain types (`Order`, `Bid`, `User`, etc.) but they are not always used — local types are often redefined per page.
