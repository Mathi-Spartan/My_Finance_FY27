-- Ledgerline schema. Run once in the Supabase SQL editor.
-- Every table is locked to the signed-in user by row level security.

create extension if not exists "pgcrypto";

-- ---------- accounts ----------
create table if not exists accounts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  kind         text not null default 'bank',      -- bank | cash | card | wallet
  currency     text not null default 'INR',
  opening      numeric(14,2) not null default 0,
  archived     boolean not null default false,
  sort         int not null default 0,
  created_at   timestamptz not null default now()
);

-- ---------- categories ----------
create table if not exists categories (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  direction    text not null default 'out',       -- out | in
  budget       numeric(14,2) not null default 0,  -- monthly budget, 0 = untracked
  color        text not null default 'slate',
  archived     boolean not null default false,
  sort         int not null default 0
);

-- ---------- transactions ----------
create table if not exists transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  account_id   uuid references accounts(id) on delete set null,
  category_id  uuid references categories(id) on delete set null,
  merchant     text not null default '',
  direction    text not null,                     -- in | out | transfer
  amount       numeric(14,2) not null,
  occurred_at  timestamptz not null default now(),
  context      text not null default 'personal',  -- personal | business
  note         text not null default '',
  recurring_id uuid,
  transfer_to  uuid references accounts(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists tx_user_date on transactions(user_id, occurred_at desc);
create index if not exists tx_user_merchant on transactions(user_id, merchant);

-- ---------- recurring commitments ----------
create table if not exists recurring (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  amount       numeric(14,2) not null,
  day_of_month int not null default 1,
  account_id   uuid references accounts(id) on delete set null,
  category_id  uuid references categories(id) on delete set null,
  direction    text not null default 'out',
  status       text not null default 'tracked',   -- tracked | ignored
  last_seen    date,
  created_at   timestamptz not null default now()
);

-- ---------- one row of settings per user ----------
create table if not exists settings (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  currency        text not null default 'INR',
  monthly_income  numeric(14,2) not null default 0,
  savings_target  numeric(14,2) not null default 0,
  pin             text not null default '',
  default_context text not null default 'personal',
  seeded          boolean not null default false
);

-- ---------- row level security ----------
alter table accounts     enable row level security;
alter table categories   enable row level security;
alter table transactions enable row level security;
alter table recurring    enable row level security;
alter table settings     enable row level security;

do $$
declare t text;
begin
  foreach t in array array['accounts','categories','transactions','recurring','settings'] loop
    execute format('drop policy if exists "own rows" on %I', t);
    execute format(
      'create policy "own rows" on %I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- ---------- starter data for a new user ----------
create or replace function public.bootstrap_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into settings(user_id) values (new.id) on conflict do nothing;

  insert into accounts(user_id, name, kind, opening, sort) values
    (new.id, 'HDFC Savings', 'bank', 0, 1),
    (new.id, 'UPI / GPay',   'wallet', 0, 2),
    (new.id, 'Credit Card',  'card', 0, 3),
    (new.id, 'Cash',         'cash', 0, 4);

  insert into categories(user_id, name, direction, budget, color, sort) values
    (new.id, 'Groceries',    'out', 8000,  'green',  1),
    (new.id, 'Eating out',   'out', 4000,  'red',    2),
    (new.id, 'Transport',    'out', 3000,  'blue',   3),
    (new.id, 'Rent',         'out', 0,     'slate',  4),
    (new.id, 'Utilities',    'out', 2500,  'amber',  5),
    (new.id, 'Dev tools',    'out', 6000,  'violet', 6),
    (new.id, 'Health',       'out', 2000,  'green',  7),
    (new.id, 'Shopping',     'out', 5000,  'red',    8),
    (new.id, 'Family',       'out', 0,     'amber',  9),
    (new.id, 'Other',        'out', 0,     'slate', 10),
    (new.id, 'Salary',       'in',  0,     'green', 11),
    (new.id, 'Business income','in',0,     'green', 12),
    (new.id, 'Refund',       'in',  0,     'blue',  13);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.bootstrap_user();
