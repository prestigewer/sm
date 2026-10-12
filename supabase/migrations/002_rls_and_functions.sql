-- SocialBoost: RLS, grants, and secure wallet/order functions

-- ---------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.service_categories  enable row level security;
alter table public.services            enable row level security;
alter table public.wallets             enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.recharge_requests   enable row level security;
alter table public.recharge_private    enable row level security;
alter table public.orders              enable row level security;
alter table public.order_private       enable row level security;
alter table public.order_status_history enable row level security;
alter table public.support_tickets     enable row level security;
alter table public.support_messages    enable row level security;
alter table public.notifications       enable row level security;
alter table public.payment_settings    enable row level security;
alter table public.site_settings       enable row level security;
alter table public.admin_audit_logs    enable row level security;

-- Start from zero privileges, then grant narrowly.
revoke all on all tables in schema public from anon, authenticated;

-- Customer-safe service list (no supplier_rate). Must be granted AFTER the blanket revoke above.
grant select on public.services_public to authenticated;

-- profiles: read own (admin reads all); update ONLY name/phone. role/status are untouchable from the browser.
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- categories: readable by signed-in users; writes by admin
grant select, insert, update, delete on public.service_categories to authenticated;
create policy cat_select on public.service_categories for select to authenticated using (is_active or public.is_admin());
create policy cat_admin_all on public.service_categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- services base table: ADMIN ONLY (holds supplier_rate). Customers use services_public view.
grant select, insert, update, delete on public.services to authenticated;
create policy services_admin_all on public.services for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- wallets: read own; no direct writes
grant select on public.wallets to authenticated;
create policy wallets_select on public.wallets for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ledger: read own; no direct writes (functions only)
grant select on public.wallet_transactions to authenticated;
create policy wtx_select on public.wallet_transactions for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- recharge requests: customer inserts own PENDING request; cannot change status/notes
grant select on public.recharge_requests to authenticated;
grant insert (amount, transaction_ref, proof_path) on public.recharge_requests to authenticated;
-- user_id defaults to auth.uid() via trigger below so clients cannot spoof it
create policy rr_select on public.recharge_requests for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy rr_insert on public.recharge_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending'
              and exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'active'));

grant select on public.recharge_private to authenticated;
create policy rp_admin_select on public.recharge_private for select to authenticated using (public.is_admin());

create or replace function public.rr_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_min numeric;
begin
  new.user_id := auth.uid();
  new.status := 'pending';
  select coalesce(min(min_recharge), 0) into v_min from public.payment_settings where is_enabled;
  if new.amount < v_min then
    raise exception 'Minimum recharge is %', v_min;
  end if;
  return new;
end $$;
create trigger rr_before_insert before insert on public.recharge_requests
  for each row execute function public.rr_before_insert();

create or replace function public.rr_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications(kind, title, body, link)
  values ('new_recharge', 'New recharge request', 'Amount ' || new.amount || ' ref ' || new.transaction_ref, '/admin/recharges');
  return new;
end $$;
create trigger rr_after_insert after insert on public.recharge_requests
  for each row execute function public.rr_after_insert();

-- orders: customers read own; NO direct writes. order_private is admin only.
grant select on public.orders to authenticated;
create policy orders_select on public.orders for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

grant select on public.order_private to authenticated;
create policy op_admin_select on public.order_private for select to authenticated using (public.is_admin());

grant select on public.order_status_history to authenticated;
create policy osh_select on public.order_status_history for select to authenticated
  using (public.is_admin() or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));

-- support
grant select, insert on public.support_tickets to authenticated;
grant update (status) on public.support_tickets to authenticated;
create policy tk_select on public.support_tickets for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy tk_insert on public.support_tickets for insert to authenticated
  with check (user_id = auth.uid() and (order_id is null or exists
    (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())));
create policy tk_update on public.support_tickets for update to authenticated
  using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());

grant select, insert on public.support_messages to authenticated;
create policy sm_select on public.support_messages for select to authenticated
  using (public.is_admin() or exists (select 1 from public.support_tickets t where t.id = ticket_id and t.user_id = auth.uid()));
create policy sm_insert on public.support_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and is_admin = public.is_admin()
    and (public.is_admin() or exists (select 1 from public.support_tickets t
         where t.id = ticket_id and t.user_id = auth.uid() and t.status <> 'closed'))
  );

create or replace function public.ticket_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications(kind, title, body, link)
  values ('new_ticket', 'New support ticket', new.subject, '/admin/tickets/' || new.id);
  return new;
end $$;
create trigger ticket_notify after insert on public.support_tickets
  for each row execute function public.ticket_notify();

create or replace function public.message_status_sync() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.support_tickets
     set status = case when new.is_admin then 'answered' else 'customer_reply' end
   where id = new.ticket_id and status <> 'closed';
  return new;
end $$;
create trigger message_status_sync after insert on public.support_messages
  for each row execute function public.message_status_sync();

-- notifications: admin only
grant select, update (is_read) on public.notifications to authenticated;
create policy notif_admin_select on public.notifications for select to authenticated using (public.is_admin());
create policy notif_admin_update on public.notifications for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- payment settings: customers see only enabled methods via a view that omits nothing secret.
-- (account_details are the PUBLIC details the admin wants customers to pay into; never store secrets here.)
grant select, insert, update, delete on public.payment_settings to authenticated;
create policy ps_select on public.payment_settings for select to authenticated using (is_enabled or public.is_admin());
create policy ps_admin_write on public.payment_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- site settings: public read, admin write
grant select on public.site_settings to anon, authenticated;
grant update on public.site_settings to authenticated;
create policy ss_select on public.site_settings for select to anon, authenticated using (true);
create policy ss_update on public.site_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- audit logs: admin read only; written by functions
grant select on public.admin_audit_logs to authenticated;
create policy audit_select on public.admin_audit_logs for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------
-- Internal helper: apply a signed wallet movement + ledger row atomically.
-- Not callable from the API.
-- ---------------------------------------------------------------
create or replace function public._wallet_apply(
  p_user uuid, p_amount numeric, p_type text, p_desc text,
  p_order uuid, p_recharge uuid, p_by uuid
) returns numeric
language plpgsql security definer set search_path = public as $$
declare v_before numeric; v_after numeric;
begin
  select balance into v_before from public.wallets where user_id = p_user for update;
  if not found then raise exception 'Wallet not found'; end if;
  v_after := v_before + p_amount;
  if v_after < 0 then raise exception 'Insufficient balance'; end if;
  update public.wallets set balance = v_after where user_id = p_user;
  insert into public.wallet_transactions
    (user_id, type, amount, balance_before, balance_after, order_id, recharge_id, description, created_by)
  values (p_user, p_type, p_amount, v_before, v_after, p_order, p_recharge, p_desc, p_by);
  return v_after;
end $$;
revoke all on function public._wallet_apply(uuid,numeric,text,text,uuid,uuid,uuid) from public, anon, authenticated;

create or replace function public._audit(p_action text, p_entity text, p_id text, p_details jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.admin_audit_logs(admin_id, action, entity, entity_id, details)
  values (auth.uid(), p_action, p_entity, p_id, coalesce(p_details,'{}'::jsonb));
$$;
revoke all on function public._audit(text,text,text,jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------
-- place_order: validates, charges, creates order, notifies. One transaction.
-- ---------------------------------------------------------------
create or replace function public.place_order(p_service_id uuid, p_target_url text, p_quantity int)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
  s record;
  v_price numeric; v_cost numeric; v_order uuid;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;
  select status into v_status from public.profiles where id = v_uid;
  if v_status is distinct from 'active' then raise exception 'Account is not active'; end if;

  if p_target_url is null or p_target_url !~* '^https?://[^\s]{3,2000}$' then
    raise exception 'Invalid target URL';
  end if;

  select s.*, c.is_active as cat_active into s
    from public.services s join public.service_categories c on c.id = s.category_id
   where s.id = p_service_id;
  if not found or not s.is_active or not s.cat_active then raise exception 'Service unavailable'; end if;
  if p_quantity is null or p_quantity < s.min_qty or p_quantity > s.max_qty then
    raise exception 'Quantity must be between % and %', s.min_qty, s.max_qty;
  end if;

  v_price := round(s.customer_rate * p_quantity / 1000, 4);
  v_cost  := round(s.supplier_rate * p_quantity / 1000, 4);

  insert into public.orders(user_id, service_id, service_name, target_url, quantity, customer_price)
  values (v_uid, s.id, s.name, p_target_url, p_quantity, v_price)
  returning id into v_order;

  insert into public.order_private(order_id, supplier_cost) values (v_order, v_cost);
  insert into public.order_status_history(order_id, old_status, new_status, changed_by, note)
  values (v_order, null, 'pending', v_uid, 'Order placed');

  if v_price > 0 then
    perform public._wallet_apply(v_uid, -v_price, 'order_deduction', 'Order for ' || s.name, v_order, null, v_uid);
  end if;

  insert into public.notifications(kind, title, body, link)
  values ('new_order', 'New order', s.name || ' x ' || p_quantity, '/admin/orders/' || v_order);
  return v_order;
end $$;
grant execute on function public.place_order(uuid,text,int) to authenticated;

-- ---------------------------------------------------------------
-- Customer: request cancellation (does NOT refund)
-- ---------------------------------------------------------------
create or replace function public.request_order_cancel(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o record;
begin
  select * into o from public.orders where id = p_order and user_id = auth.uid() for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status not in ('pending','processing') then raise exception 'Order can no longer be cancelled'; end if;
  if o.cancel_requested then return; end if;
  update public.orders set cancel_requested = true where id = p_order;
  insert into public.notifications(kind, title, body, link)
  values ('refund_request', 'Cancellation requested', 'Order #' || o.order_no, '/admin/orders/' || p_order);
end $$;
grant execute on function public.request_order_cancel(uuid) to authenticated;

-- ---------------------------------------------------------------
-- Admin: recharge approve / reject (exactly once)
-- ---------------------------------------------------------------
create or replace function public.admin_save_recharge_note(p_id uuid, p_note text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;
  insert into public.recharge_private(recharge_id, internal_note) values (p_id, coalesce(p_note,''))
  on conflict (recharge_id) do update set internal_note = excluded.internal_note, updated_at = now();
end $$;
grant execute on function public.admin_save_recharge_note(uuid,text) to authenticated;

create or replace function public.admin_approve_recharge(p_id uuid, p_internal_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;
  select * into r from public.recharge_requests where id = p_id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status <> 'pending' then raise exception 'Request already %', r.status; end if;
  perform public._wallet_apply(r.user_id, r.amount, 'recharge', 'Recharge ref ' || r.transaction_ref, null, r.id, auth.uid());
  update public.recharge_requests
     set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id;
  if p_internal_note is not null then perform public.admin_save_recharge_note(p_id, p_internal_note); end if;
  perform public._audit('approve_recharge', 'recharge_requests', p_id::text, jsonb_build_object('amount', r.amount));
end $$;
grant execute on function public.admin_approve_recharge(uuid,text) to authenticated;

create or replace function public.admin_reject_recharge(p_id uuid, p_public_note text default null, p_internal_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;
  select * into r from public.recharge_requests where id = p_id for update;
  if not found then raise exception 'Request not found'; end if;
  if r.status <> 'pending' then raise exception 'Request already %', r.status; end if;
  update public.recharge_requests
     set status = 'rejected', public_note = p_public_note, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p_id;
  if p_internal_note is not null then perform public.admin_save_recharge_note(p_id, p_internal_note); end if;
  perform public._audit('reject_recharge', 'recharge_requests', p_id::text, jsonb_build_object('reason', p_public_note));
end $$;
grant execute on function public.admin_reject_recharge(uuid,text,text) to authenticated;

-- ---------------------------------------------------------------
-- Admin: manual wallet adjustment (signed amount, reason required)
-- ---------------------------------------------------------------
create or replace function public.admin_adjust_wallet(p_user uuid, p_amount numeric, p_reason text) returns numeric
language plpgsql security definer set search_path = public as $$
declare v_new numeric;
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;
  if p_amount is null or p_amount = 0 then raise exception 'Amount must be non-zero'; end if;
  if p_reason is null or char_length(trim(p_reason)) < 3 then raise exception 'A reason is required'; end if;
  v_new := public._wallet_apply(p_user, p_amount,
             case when p_amount > 0 then 'admin_credit' else 'admin_debit' end,
             trim(p_reason), null, null, auth.uid());
  perform public._audit('wallet_adjust', 'wallets', p_user::text, jsonb_build_object('amount', p_amount, 'reason', p_reason));
  return v_new;
end $$;
grant execute on function public.admin_adjust_wallet(uuid,numeric,text) to authenticated;

-- ---------------------------------------------------------------
-- Admin: set account status
-- ---------------------------------------------------------------
create or replace function public.admin_set_user_status(p_user uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;
  if p_status not in ('active','suspended') then raise exception 'Invalid status'; end if;
  if p_user = auth.uid() then raise exception 'You cannot change your own status'; end if;
  update public.profiles set status = p_status where id = p_user;
  perform public._audit('set_user_status', 'profiles', p_user::text, jsonb_build_object('status', p_status));
end $$;
grant execute on function public.admin_set_user_status(uuid,text) to authenticated;

-- ---------------------------------------------------------------
-- Admin: update order (status, supplier info, cost, note). No money moves here.
-- Moving to 'refunded' is only possible through admin_refund_order.
-- ---------------------------------------------------------------
create or replace function public.admin_update_order(
  p_order uuid, p_status text, p_supplier_name text, p_external_id text,
  p_supplier_cost numeric, p_note text
) returns void
language plpgsql security definer set search_path = public as $$
declare o record;
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;
  if p_status not in ('pending','processing','completed','partial','failed','cancelled') then
    raise exception 'Invalid status (use refund action to refund)';
  end if;
  if p_supplier_cost is not null and p_supplier_cost < 0 then raise exception 'Invalid supplier cost'; end if;
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found'; end if;
  if o.status = 'refunded' then raise exception 'Refunded orders are locked'; end if;

  update public.order_private
     set supplier_name = p_supplier_name,
         external_order_id = p_external_id,
         supplier_cost = coalesce(p_supplier_cost, supplier_cost),
         internal_note = p_note
   where order_id = p_order;

  if o.status <> p_status then
    update public.orders set status = p_status where id = p_order;
    insert into public.order_status_history(order_id, old_status, new_status, changed_by, note)
    values (p_order, o.status, p_status, auth.uid(), p_note);
    if p_status = 'failed' then
      insert into public.notifications(kind, title, body, link)
      values ('failed_order', 'Order failed', 'Order #' || o.order_no, '/admin/orders/' || p_order);
    end if;
  end if;
  perform public._audit('update_order', 'orders', p_order::text,
          jsonb_build_object('status', p_status, 'supplier', p_supplier_name, 'external_id', p_external_id));
end $$;
grant execute on function public.admin_update_order(uuid,text,text,text,numeric,text) to authenticated;

-- ---------------------------------------------------------------
-- Admin: refund (once, never above the amount charged). Partial refunds allowed, once.
-- ---------------------------------------------------------------
create or replace function public.admin_refund_order(p_order uuid, p_amount numeric, p_note text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare o record; v_full boolean;
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;
  select * into o from public.orders where id = p_order for update;
  if not found then raise exception 'Order not found'; end if;
  if o.refunded_amount > 0 then raise exception 'Order already refunded'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > o.customer_price then
    raise exception 'Refund must be between 0 and the amount charged (%)', o.customer_price;
  end if;
  perform public._wallet_apply(o.user_id, p_amount, 'refund',
          'Refund for order #' || o.order_no || coalesce(' - ' || p_note, ''), p_order, null, auth.uid());
  v_full := (p_amount = o.customer_price);
  update public.orders
     set refunded_amount = p_amount,
         status = case when v_full then 'refunded' else o.status end
   where id = p_order;
  if v_full then
    insert into public.order_status_history(order_id, old_status, new_status, changed_by, note)
    values (p_order, o.status, 'refunded', auth.uid(), p_note);
  end if;
  perform public._audit('refund_order', 'orders', p_order::text, jsonb_build_object('amount', p_amount, 'full', v_full));
end $$;
grant execute on function public.admin_refund_order(uuid,numeric,text) to authenticated;

-- ---------------------------------------------------------------
-- Admin stats & reports (aggregated server-side)
-- ---------------------------------------------------------------
create or replace function public.admin_dashboard_stats() returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;
  select jsonb_build_object(
    'customers',        (select count(*) from public.profiles where role = 'customer'),
    'orders',           (select count(*) from public.orders),
    'pending_orders',   (select count(*) from public.orders where status = 'pending'),
    'completed_orders', (select count(*) from public.orders where status = 'completed'),
    'pending_recharges',(select count(*) from public.recharge_requests where status = 'pending'),
    'approved_recharge_total', (select coalesce(sum(amount),0) from public.recharge_requests where status = 'approved'),
    'sales',            (select coalesce(sum(customer_price - refunded_amount),0) from public.orders where status not in ('cancelled','failed')),
    'supplier_cost',    (select coalesce(sum(op.supplier_cost),0) from public.orders o join public.order_private op on op.order_id = o.id
                          where o.status not in ('cancelled','failed','refunded')),
    'refunds',          (select coalesce(sum(refunded_amount),0) from public.orders)
  ) into r;
  return r || jsonb_build_object('gross_profit', (r->>'sales')::numeric - (r->>'supplier_cost')::numeric);
end $$;
grant execute on function public.admin_dashboard_stats() to authenticated;

create or replace function public.admin_sales_report(p_from date, p_to date, p_bucket text default 'day')
returns table(period date, orders bigint, sales numeric, supplier_cost numeric, gross_profit numeric, refunds numeric)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;
  if p_bucket not in ('day','week','month') then raise exception 'Invalid bucket'; end if;
  return query
    select date_trunc(p_bucket, o.created_at)::date,
           count(*),
           coalesce(sum(o.customer_price - o.refunded_amount),0),
           coalesce(sum(op.supplier_cost) filter (where o.status not in ('failed','cancelled','refunded')),0),
           coalesce(sum(o.customer_price - o.refunded_amount),0)
             - coalesce(sum(op.supplier_cost) filter (where o.status not in ('failed','cancelled','refunded')),0),
           coalesce(sum(o.refunded_amount),0)
      from public.orders o join public.order_private op on op.order_id = o.id
     where o.created_at >= p_from and o.created_at < p_to + 1
       and o.status not in ('failed','cancelled')
     group by 1 order by 1;
end $$;
grant execute on function public.admin_sales_report(date,date,text) to authenticated;

create or replace function public.admin_service_performance(p_from date, p_to date)
returns table(service_name text, orders bigint, units bigint, sales numeric, completed bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;
  return query
    select o.service_name, count(*), sum(o.quantity)::bigint,
           coalesce(sum(o.customer_price - o.refunded_amount),0),
           count(*) filter (where o.status = 'completed')
      from public.orders o
     where o.created_at >= p_from and o.created_at < p_to + 1
     group by o.service_name order by count(*) desc;
end $$;
grant execute on function public.admin_service_performance(date,date) to authenticated;

-- ---------------------------------------------------------------
-- Storage: private bucket for payment proofs, folder = user id
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('payment-proofs','payment-proofs', false)
on conflict (id) do nothing;

create policy proofs_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy proofs_select_own on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
