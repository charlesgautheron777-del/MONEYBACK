create extension if not exists pgcrypto;

create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  email text not null,
  status text not null default 'pending',
  offer_type text not null default 'paid_audit',
  amount_cents integer not null default 49000,
  access_token text not null,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create unique index if not exists deals_stripe_checkout_session_id_idx
  on public.deals(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

alter table public.deals enable row level security;
