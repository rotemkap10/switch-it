-- Initial schema for Switch It MVP.
-- Tables, constraints, indexes, and RLS enabled (no policies yet).
-- No triggers, RPCs, or signup hooks in this migration.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  display_name text not null,
  credits integer not null default 5,
  role text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_credits_non_negative check (credits >= 0),
  constraint profiles_role_allowed check (role in ('user'))
);

comment on table public.profiles is
  'App user profile linked 1:1 with auth.users. Credits are virtual points.';

-- ---------------------------------------------------------------------------
-- parking_spots
-- ---------------------------------------------------------------------------
create table public.parking_spots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete restrict,
  latitude double precision not null,
  longitude double precision not null,
  address text,
  available_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null default 'available',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint parking_spots_status_allowed check (
    status in ('available', 'claimed', 'completed', 'cancelled', 'expired')
  ),
  constraint parking_spots_expires_after_available check (expires_at > available_at),
  constraint parking_spots_latitude_range check (latitude >= -90 and latitude <= 90),
  constraint parking_spots_longitude_range check (longitude >= -180 and longitude <= 180)
);

comment on table public.parking_spots is
  'Published public-street parking handoff spots. Coordination only; no ownership.';

create unique index parking_spots_one_open_per_owner
  on public.parking_spots (owner_id)
  where status in ('available', 'claimed');

create index parking_spots_status_expires_at_idx
  on public.parking_spots (status, expires_at);

create index parking_spots_owner_created_at_idx
  on public.parking_spots (owner_id, created_at desc);

-- ---------------------------------------------------------------------------
-- claims
-- ---------------------------------------------------------------------------
create table public.claims (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references public.parking_spots (id) on delete restrict,
  seeker_id uuid not null references public.profiles (id) on delete restrict,
  status text not null default 'active',
  claimed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  completed_at timestamptz,
  cancelled_at timestamptz,

  constraint claims_status_allowed check (
    status in ('active', 'completed', 'cancelled', 'expired')
  ),
  constraint claims_expires_after_claimed check (expires_at > claimed_at),
  constraint claims_completed_at_consistency check (
    completed_at is null or completed_at >= claimed_at
  ),
  constraint claims_cancelled_at_consistency check (
    cancelled_at is null or cancelled_at >= claimed_at
  ),
  constraint claims_completed_and_cancelled_mutex check (
    not (completed_at is not null and cancelled_at is not null)
  )
);

comment on table public.claims is
  'Time-limited claim by a seeker on a parking spot. At most one active claim per spot/seeker.';

create unique index claims_one_active_per_spot
  on public.claims (spot_id)
  where status = 'active';

create unique index claims_one_active_per_seeker
  on public.claims (seeker_id)
  where status = 'active';

create index claims_seeker_claimed_at_idx
  on public.claims (seeker_id, claimed_at desc);

create index claims_spot_status_idx
  on public.claims (spot_id, status);

-- ---------------------------------------------------------------------------
-- credit_transactions
-- ---------------------------------------------------------------------------
create table public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  spot_id uuid references public.parking_spots (id) on delete restrict,
  claim_id uuid references public.claims (id) on delete restrict,
  amount integer not null,
  transaction_type text not null,
  created_at timestamptz not null default now(),

  constraint credit_transactions_type_allowed check (
    transaction_type in ('initial_grant', 'handoff_debit', 'handoff_credit')
  ),
  constraint credit_transactions_amount_nonzero check (amount <> 0),
  constraint credit_transactions_amount_sign_by_type check (
    (transaction_type = 'initial_grant' and amount > 0)
    or (transaction_type = 'handoff_credit' and amount > 0)
    or (transaction_type = 'handoff_debit' and amount < 0)
  ),
  constraint credit_transactions_claim_id_by_type check (
    (transaction_type = 'initial_grant' and claim_id is null)
    or (
      transaction_type in ('handoff_debit', 'handoff_credit')
      and claim_id is not null
    )
  )
);

comment on table public.credit_transactions is
  'Append-only credit ledger. Handoff debit/credit require a claim_id; initial_grant does not.';

create unique index credit_tx_one_debit_per_claim
  on public.credit_transactions (claim_id)
  where transaction_type = 'handoff_debit';

create unique index credit_tx_one_credit_per_claim
  on public.credit_transactions (claim_id)
  where transaction_type = 'handoff_credit';

create index credit_transactions_user_created_at_idx
  on public.credit_transactions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security (enabled; policies added in a later migration)
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.parking_spots enable row level security;
alter table public.claims enable row level security;
alter table public.credit_transactions enable row level security;
