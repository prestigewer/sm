-- SocialBoost SMM Reseller Platform: core schema
-- All money columns use numeric(14,4). 1 credit = 1 unit of display currency (configurable).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------------------------------------------------------------
-- profiles (role lives here but can only be changed by service role / admin function)
-- ---------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  phone text,
  role text not null default 'customer' check (role in ('customer','admin')),
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_role_idx on public.profiles(role);
create index profiles_created_idx on public.profiles(created_at desc);
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and status = 'active');
$$;

-- ---------------------------------------------------------------
-- categories & services
-- ---------------------------------------------------------------
create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  platform text not null,                -- TikTok, Instagram, YouTube, Facebook, custom...
  name text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, name)
);
create trigger service_categories_updated before update on public.service_categories
  for each row execute function public.set_updated_at();

create table public.services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.service_categories(id) on delete restrict,
  name text not null,
  description text not null default '',
  supplier_rate numeric(14,4) not null check (supplier_rate >= 0),   -- per 1000, ADMIN ONLY (see service_costs view split below)
  customer_rate numeric(14,4) not null check (customer_rate >= 0),   -- per 1000
  min_qty int not null check (min_qty > 0),
  max_qty int not null check (max_qty >= min_qty),
  est_time text not null default '',
  refill_policy text not null default '',
  cancel_policy text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index services_category_idx on public.services(category_id);
create index services_active_idx on public.services(is_active);
create trigger services_updated before update on public.services
  for each row execute function public.set_updated_at();

-- Customer-visible view WITHOUT supplier_rate. Customers read this, never the base table.
create view public.services_public with (security_invoker = false) as
  select s.id, s.category_id, c.platform, c.name as category_name, s.name, s.description,
         s.customer_rate, s.min_qty, s.max_qty, s.est_time, s.refill_policy, s.cancel_policy, s.is_active
  from public.services s join public.service_categories c on c.id = s.category_id
  where s.is_active and c.is_active;
grant select on public.services_public to authenticated;

-- ---------------------------------------------------------------
-- wallets & immutable ledger
-- ---------------------------------------------------------------
create table public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance numeric(14,4) not null default 0 check (balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger wallets_updated before update on public.wallets
  for each row execute function public.set_updated_at();

create table public.recharge_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  amount numeric(14,4) not null check (amount > 0),
  transaction_ref text not null,
  proof_path text,                        -- storage path in private 'payment-proofs' bucket
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  public_note text,                       -- visible to the customer (e.g. rejection reason)
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Internal admin notes live in their own admin-only table so customers can never read them.
create table public.recharge_private (
  recharge_id uuid primary key references public.recharge_requests(id) on delete cascade,
  internal_note text not null default '',
  updated_at timestamptz not null default now()
);
create index recharge_user_idx on public.recharge_requests(user_id, created_at desc);
create index recharge_status_idx on public.recharge_requests(status);
-- the same external payment reference cannot be claimed twice (blocks replay of one receipt)
create unique index recharge_ref_unique on public.recharge_requests (lower(transaction_ref)) where status <> 'rejected';
create trigger recharge_updated before update on public.recharge_requests
  for each row execute function public.set_updated_at();

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no bigint generated always as identity,
  user_id uuid not null references public.profiles(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  service_name text not null,             -- snapshot
  target_url text not null,
  quantity int not null check (quantity > 0),
  customer_price numeric(14,4) not null check (customer_price >= 0),  -- amount charged
  refunded_amount numeric(14,4) not null default 0 check (refunded_amount >= 0 and refunded_amount <= customer_price),
  status text not null default 'pending' check (status in
    ('pending','processing','completed','partial','failed','cancelled','refunded')),
  cancel_requested boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_user_idx on public.orders(user_id, created_at desc);
create index orders_status_idx on public.orders(status, created_at desc);
create trigger orders_updated before update on public.orders
  for each row execute function public.set_updated_at();

-- Sensitive supplier / profit data is kept OUT of the customer-readable orders table.
create table public.order_private (
  order_id uuid primary key references public.orders(id) on delete cascade,
  supplier_name text,
  external_order_id text,
  supplier_cost numeric(14,4) not null default 0 check (supplier_cost >= 0),
  internal_note text,
  updated_at timestamptz not null default now()
);
create trigger order_private_updated before update on public.order_private
  for each row execute function public.set_updated_at();

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_by uuid references public.profiles(id),
  note text,
  created_at timestamptz not null default now()
);
create index osh_order_idx on public.order_status_history(order_id, created_at);

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  type text not null check (type in ('recharge','order_deduction','refund','admin_credit','admin_debit','adjustment')),
  amount numeric(14,4) not null check (amount <> 0),   -- signed: + credit, - debit
  balance_before numeric(14,4) not null,
  balance_after numeric(14,4) not null,
  order_id uuid references public.orders(id),
  recharge_id uuid references public.recharge_requests(id),
  description text not null default '',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (balance_after = balance_before + amount)
);
create index wtx_user_idx on public.wallet_transactions(user_id, created_at desc);
-- exactly-once guarantees
create unique index wtx_recharge_once on public.wallet_transactions(recharge_id) where type = 'recharge';
create unique index wtx_deduction_once on public.wallet_transactions(order_id) where type = 'order_deduction';
create unique index wtx_refund_once on public.wallet_transactions(order_id) where type = 'refund';

-- Immutable ledger: block UPDATE/DELETE for everyone, including service role.
create or replace function public.ledger_immutable() returns trigger language plpgsql as $$
begin raise exception 'wallet_transactions is immutable'; end $$;
create trigger wtx_no_update before update or delete on public.wallet_transactions
  for each row execute function public.ledger_immutable();

-- ---------------------------------------------------------------
-- support
-- ---------------------------------------------------------------
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id),
  subject text not null check (char_length(subject) between 3 and 200),
  status text not null default 'open' check (status in ('open','answered','customer_reply','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tickets_user_idx on public.support_tickets(user_id, created_at desc);
create trigger tickets_updated before update on public.support_tickets
  for each row execute function public.set_updated_at();

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  is_admin boolean not null default false,
  message text not null check (char_length(message) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index smsg_ticket_idx on public.support_messages(ticket_id, created_at);

-- ---------------------------------------------------------------
-- notifications (admin), payment settings, audit logs
-- ---------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('new_order','new_recharge','new_ticket','failed_order','refund_request')),
  title text not null,
  body text not null default '',
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notif_unread_idx on public.notifications(is_read, created_at desc);

create table public.payment_settings (
  id uuid primary key default gen_random_uuid(),
  method_name text not null,
  account_holder text not null default '',
  account_details text not null default '',
  instructions text not null default '',
  supported_currencies text[] not null default array['PKR'],
  min_recharge numeric(14,4) not null default 100 check (min_recharge >= 0),
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger payment_settings_updated before update on public.payment_settings
  for each row execute function public.set_updated_at();

-- Site configuration (brand, currency, credit rate) is non-secret and publicly readable.
create table public.site_settings (
  id int primary key default 1 check (id = 1),
  brand_name text not null default 'SocialBoost',
  logo_url text,
  currency_code text not null default 'PKR',
  currency_symbol text not null default 'PKR',
  credits_per_currency_unit numeric(14,6) not null default 1 check (credits_per_currency_unit > 0),
  primary_color text not null default '#4f46e5',
  updated_at timestamptz not null default now()
);
insert into public.site_settings default values;

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id),
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_created_idx on public.admin_audit_logs(created_at desc);
create trigger audit_no_update before update or delete on public.admin_audit_logs
  for each row execute function public.ledger_immutable();

-- ---------------------------------------------------------------
-- New-user trigger: profile + wallet. Role is ALWAYS 'customer' here.
-- ---------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), coalesce(new.email,''));
  insert into public.wallets (user_id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
