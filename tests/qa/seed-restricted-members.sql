-- Reproducible restricted members for the Studio permission and navigation tests (LOCAL / DEV databases only).
--
--   docker exec -i <supabase_db_container> psql -U postgres -v ON_ERROR_STOP=1 < tests/qa/seed-restricted-members.sql
--
-- Adds four logins to the demo company (the tenant owned by owner@demo.test). The password is the public demo password
-- (Demo1234): never run this against a real project. Idempotent: running it again resets the permissions below.
--
--   design-only@demo.test    admin   products none,  settings write   -> sees Themes and Customize, not the catalogue
--   catalog-only@demo.test   admin   products write, settings none    -> sees the catalogue, not Themes or Customize
--   read-only@demo.test      staff   everything read                   -> sees the pages but cannot change anything
--   no-access@demo.test      staff   everything none                  -> sees nothing of the shop
--
-- The owner (owner@demo.test) and the manager (admin@demo.test) come from the normal demo seed.

begin;

create extension if not exists pgcrypto with schema extensions;

create temp table _members (id uuid, email text, name text, role text, permissions jsonb) on commit drop;
insert into _members values
  ('d0000000-0000-4000-8000-000000000011', 'design-only@demo.test',  'Dina Design',  'admin', '{"products":"none","orders":"none","customers":"none","settings":"write"}'),
  ('d0000000-0000-4000-8000-000000000012', 'catalog-only@demo.test', 'Cato Catalog', 'admin', '{"products":"write","orders":"none","customers":"none","settings":"none"}'),
  ('d0000000-0000-4000-8000-000000000013', 'read-only@demo.test',    'Rhea Reader',  'staff', '{"products":"read","orders":"read","customers":"read","settings":"read"}'),
  ('d0000000-0000-4000-8000-000000000014', 'no-access@demo.test',    'Nico Nothing', 'staff', '{"products":"none","orders":"none","customers":"none","settings":"none"}');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new)
select '00000000-0000-0000-0000-000000000000', m.id, 'authenticated', 'authenticated', m.email,
  extensions.crypt('Demo1234', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', m.name),
  now(), now(), '', '', '', ''
from _members m
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), m.id, m.id::text, 'email',
  jsonb_build_object('sub', m.id, 'email', m.email, 'email_verified', true), now(), now(), now()
from _members m
where not exists (select 1 from auth.identities i where i.user_id = m.id and i.provider = 'email');

-- The demo company is the tenant the demo owner owns.
do $$
declare
  t uuid;
begin
  select tenant_id into t from public.memberships where user_id = 'd0000000-0000-4000-8000-000000000001' and role = 'owner' limit 1;
  if t is null then
    raise exception 'The demo owner has no company: run the demo seed first.';
  end if;
  insert into public.memberships (tenant_id, user_id, role, permissions)
  select t, m.id, m.role, m.permissions from _members m
  on conflict (tenant_id, user_id) do update set role = excluded.role, permissions = excluded.permissions, status = 'active';
end $$;

select m.email, ms.role, ms.permissions from _members m join public.memberships ms on ms.user_id = m.id order by m.email;

commit;
