-- Optional starter data. Everything here is editable from the admin panel.
-- Prices are sample values only; business logic reads rates from the services table.

insert into public.service_categories (platform, name, sort_order) values
  ('TikTok', 'Likes', 1), ('TikTok', 'Followers', 2),
  ('Instagram', 'Likes', 1), ('Instagram', 'Followers', 2),
  ('YouTube', 'Views', 1), ('Facebook', 'Likes', 1)
on conflict do nothing;

insert into public.services (category_id, name, description, supplier_rate, customer_rate, min_qty, max_qty, est_time, refill_policy, cancel_policy)
select id, 'TikTok Likes', 'Likes on a public TikTok video.', 50, 60, 100, 50000, '0-6 hours', 'No refill', 'Cancel only before processing starts'
from public.service_categories where platform = 'TikTok' and name = 'Likes';

insert into public.payment_settings (method_name, account_holder, account_details, instructions, supported_currencies, min_recharge)
values ('Bank transfer (edit me)', 'Account Holder Name', 'Bank / IBAN / account number here',
        'Send the exact amount, then submit your transaction reference and a screenshot on the Add Funds page.', array['PKR'], 100);
