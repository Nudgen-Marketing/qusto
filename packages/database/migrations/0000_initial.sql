CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE environment_name AS ENUM ('development', 'staging', 'production');
CREATE TYPE fail_mode AS ENUM ('open', 'closed');
CREATE TYPE membership_role AS ENUM ('admin', 'developer', 'viewer');
CREATE TYPE policy_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE decision_outcome AS ENUM ('allow', 'deny');
CREATE TYPE reservation_status AS ENUM ('active', 'completed', 'released', 'expired');
CREATE TYPE job_status AS ENUM ('pending', 'running', 'completed', 'failed');

CREATE TABLE users (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  email_verified boolean NOT NULL DEFAULT false,
  image text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id text PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX sessions_user_id_idx ON sessions(user_id);

CREATE TABLE accounts (
  id text PRIMARY KEY,
  account_id text NOT NULL,
  provider_id text NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX accounts_user_id_idx ON accounts(user_id);

CREATE TABLE verifications (
  id text PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX verifications_identifier_idx ON verifications(identifier);

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role membership_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, user_id)
);

CREATE TABLE invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role membership_role NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, slug)
);

CREATE TABLE environments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name environment_name NOT NULL,
  fail_mode fail_mode NOT NULL,
  trace_retention_days integer NOT NULL DEFAULT 90 CHECK (trace_retention_days > 0),
  audit_retention_days integer NOT NULL DEFAULT 365 CHECK (audit_retention_days > 0),
  active_policy_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, name)
);

CREATE TABLE api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  name text NOT NULL,
  lookup text NOT NULL UNIQUE,
  secret_hash text NOT NULL,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX api_keys_environment_idx ON api_keys(environment_id) WHERE revoked_at IS NULL;

CREATE TABLE policy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  status policy_status NOT NULL,
  rules jsonb NOT NULL,
  published_at timestamptz,
  published_by text REFERENCES users(id) ON DELETE SET NULL,
  created_by text REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (environment_id, version)
);
ALTER TABLE environments
  ADD CONSTRAINT environments_active_policy_fk
  FOREIGN KEY (active_policy_version_id) REFERENCES policy_versions(id) ON DELETE SET NULL;

CREATE TABLE traces (
  id text PRIMARY KEY,
  environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'started',
  last_event_type text NOT NULL,
  protocol_version smallint,
  network text,
  asset text,
  amount_atomic numeric(78, 0),
  payer text,
  payee text,
  resource_url text,
  transaction_hash text,
  policy_outcome decision_outcome,
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX traces_environment_time_idx ON traces(environment_id, last_seen_at DESC);
CREATE INDEX traces_transaction_hash_idx ON traces(transaction_hash) WHERE transaction_hash IS NOT NULL;
CREATE INDEX traces_payer_idx ON traces(environment_id, payer, last_seen_at DESC);
CREATE INDEX traces_payee_idx ON traces(environment_id, payee, last_seen_at DESC);

CREATE TABLE trace_event_dedup (
  id text PRIMARY KEY,
  occurred_at timestamptz NOT NULL
);

CREATE TABLE trace_events (
  id text NOT NULL,
  environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  trace_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);
CREATE TABLE trace_events_default PARTITION OF trace_events DEFAULT;
CREATE INDEX trace_events_environment_time_idx ON trace_events(environment_id, occurred_at DESC);
CREATE INDEX trace_events_trace_time_idx ON trace_events(trace_id, occurred_at);

CREATE TABLE policy_decisions (
  id text PRIMARY KEY,
  environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  policy_version_id uuid NOT NULL REFERENCES policy_versions(id),
  trace_id text NOT NULL,
  idempotency_key text NOT NULL,
  outcome decision_outcome NOT NULL,
  reason_codes text[] NOT NULL DEFAULT '{}',
  rule_ids text[] NOT NULL DEFAULT '{}',
  payer text NOT NULL,
  payee text NOT NULL,
  asset text NOT NULL,
  amount_atomic numeric(78, 0) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (environment_id, idempotency_key)
);
CREATE INDEX policy_decisions_trace_idx ON policy_decisions(trace_id);

CREATE TABLE spend_reservations (
  id text PRIMARY KEY,
  environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  decision_id text NOT NULL UNIQUE REFERENCES policy_decisions(id) ON DELETE CASCADE,
  payer text NOT NULL,
  asset text NOT NULL,
  amount_atomic numeric(78, 0) NOT NULL,
  status reservation_status NOT NULL DEFAULT 'active',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX spend_reservations_active_idx
  ON spend_reservations(environment_id, payer, asset, expires_at)
  WHERE status = 'active';

CREATE TABLE spend_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  reservation_id text UNIQUE REFERENCES spend_reservations(id) ON DELETE SET NULL,
  trace_id text NOT NULL,
  payer text NOT NULL,
  payee text NOT NULL,
  asset text NOT NULL,
  amount_atomic numeric(78, 0) NOT NULL,
  transaction_hash text,
  settled_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX spend_ledger_window_idx ON spend_ledger(environment_id, payer, asset, settled_at DESC);

CREATE TABLE webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id uuid NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
  url text NOT NULL,
  secret_ciphertext text NOT NULL,
  event_types text[] NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id uuid NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  status_code integer,
  attempt integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz,
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX webhook_deliveries_pending_idx ON webhook_deliveries(next_attempt_at)
  WHERE delivered_at IS NULL;

CREATE TABLE jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  payload jsonb NOT NULL,
  status job_status NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 10,
  run_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX jobs_claim_idx ON jobs(status, run_at) WHERE status IN ('pending', 'failed');

CREATE TABLE audit_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_user_id text REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_entries_org_time_idx ON audit_entries(organization_id, occurred_at DESC);
