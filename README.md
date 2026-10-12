# SocialBoost – SMM Reseller Platform

React + Vite + TypeScript + Tailwind frontend on Supabase (Auth, Postgres, RLS, Storage). Customer panel at `/`, admin panel at `/admin`.

## Setup

1. **Create a Supabase project.**
2. **Run the migrations** in the SQL editor, in order:
   - `supabase/migrations/001_schema.sql`
   - `supabase/migrations/002_rls_and_functions.sql`
   - optional: `supabase/seed.sql` (sample categories, one service, one payment method)
3. **Auth settings** (Authentication → URL configuration): set Site URL to your deployed URL and add `<your-url>/reset-password` and `<your-url>/login` to Redirect URLs. Turn on "Confirm email" if you want email verification.
4. **Realtime (optional):** Database → Replication → enable `notifications` for instant bell updates. Without it the bell refreshes every 30 s.
5. **Env vars:** copy `.env.example` to `.env`, fill in the project URL and **anon** key. Never use the service_role key in this app.
6. `npm install && npm run dev`
7. **Create your first admin.** Register normally, then in the SQL editor run:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```
   This is the only way to create an admin; customers cannot change `role` (column-level grants + RLS).
8. **Deploy to Vercel:** import the repo, set the two env vars, deploy. `vercel.json` handles SPA routing and basic security headers.

## How money is protected

- Customers have **no direct write access** to wallets, ledger, orders, order_private, notifications or audit logs. All money movement goes through `SECURITY DEFINER` functions that lock the wallet row (`FOR UPDATE`), write the ledger entry and change the balance in one transaction: `place_order`, `admin_approve_recharge`, `admin_adjust_wallet`, `admin_refund_order`.
- `wallet_transactions` is immutable (trigger blocks UPDATE/DELETE, even for service role) and has unique indexes so a recharge can be credited once, an order charged once and refunded once.
- Supplier cost, supplier name/ID and internal notes live in admin-only tables (`order_private`, `recharge_private`, `services.supplier_rate`). Customers read services through the `services_public` view, which omits supplier rates.
- Refunds can't exceed the amount charged; cancellation requests only flag the order for admin review.
- Every admin action writes to `admin_audit_logs`.

## Supplier API later

Fulfilment is manual. To automate it, add a Supabase Edge Function (service role, secrets in function env) that reads pending orders, calls the supplier, then calls `admin_update_order`-equivalent SQL. Keep supplier keys out of the browser.

## Notes

- Money is `numeric(14,4)`; price = `round(rate × qty / 1000, 4)`, computed in the database. The UI preview uses the same formula but the server is authoritative.
- Prices and balances are stored in credits; `site_settings.credits_per_currency_unit` controls how recharge amounts convert (default 1 credit = 1 PKR).
- UI components are hand-written Tailwind in `src/components/ui.tsx` (shadcn-style) rather than generated with the shadcn CLI.
