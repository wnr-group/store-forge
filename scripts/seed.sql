-- =============================================================================
-- DEVELOPMENT SEED DATA - LOCAL ONLY.
-- Applied by `npm run db:seed` (scripts/seed.ts) - refuses to run against production.
-- NEVER run this against a hosted/production project: it creates users with a
-- publicly known password. Contains no real customer data.
--
-- Accounts (password for all: Password123):
--   merchant.a@example.test  -> owner of "Alpha Goods" (store: alpha-goods)
--   merchant.b@example.test  -> owner of "Beta Wares"  (store: beta-wares)
--                               and staff in Alpha Goods (multi-tenant demo)
--   newcomer@example.test    -> no tenant (lands on the "no workspace" page: nobody can self-onboard)
--   platform@example.test    -> StoreForge Platform Admin (lands on /admin, creates companies)
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

do $$
declare
  u record;
begin
  for u in
    select * from (values
      ('11111111-1111-1111-1111-111111111111'::uuid, 'merchant.a@example.test', 'Alice Merchant'),
      ('22222222-2222-2222-2222-222222222222'::uuid, 'merchant.b@example.test', 'Bob Merchant'),
      ('33333333-3333-3333-3333-333333333333'::uuid, 'newcomer@example.test',  'Nina Newcomer'),
      ('44444444-4444-4444-4444-444444444444'::uuid, 'platform@example.test',  'Priya Platform')
    ) as t(id, email, full_name)
  loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
      u.email, extensions.crypt('Password123', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', u.full_name),
      now(), now(), '', '', '', ''
    ) on conflict (id) do nothing;

    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), u.id, u.id::text, 'email',
      jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
      now(), now(), now()
    ) on conflict do nothing;
    -- public.profiles rows are created by the on_auth_user_created trigger.
  end loop;
end $$;

-- Seed runs as the table owner, so it can write tenants/memberships directly
-- (tenants are created in the app only by a Platform Admin through platform_provision_tenant()).
insert into public.tenants (id, name, slug, created_by) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Alpha Goods Ltd', 'alpha-goods', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Beta Wares Pvt Ltd', 'beta-wares', '22222222-2222-2222-2222-222222222222')
on conflict (id) do nothing;

insert into public.memberships (tenant_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'staff')
on conflict (tenant_id, user_id) do nothing;

insert into public.platform_admins (user_id) values
  ('44444444-4444-4444-4444-444444444444')
on conflict do nothing;

insert into public.stores (tenant_id, name, slug, description) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Alpha Goods', 'alpha-goods', 'Demo store for Merchant A.'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Beta Wares', 'beta-wares', 'Demo store for Merchant B.')
on conflict (slug) do nothing;
