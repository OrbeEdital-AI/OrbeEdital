-- Deployment prerequisite: verify production database identity and backend role.
-- Apply in a transaction, only after review. No public opportunity modifications.
BEGIN;
CREATE SCHEMA IF NOT EXISTS orberadar_private;
REVOKE ALL ON SCHEMA orberadar_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS orberadar_private.runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 source text NOT NULL CHECK (source IN ('amm-mt','amm-mg')),
 started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','partial','failed')),
 candidate_count integer NOT NULL DEFAULT 0 CHECK (candidate_count >= 0),
 failures jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE TABLE IF NOT EXISTS orberadar_private.candidates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 source text NOT NULL CHECK (source IN ('amm-mt','amm-mg')),
 publication_id text NOT NULL,
 source_url text NOT NULL,
 first_seen_at timestamptz NOT NULL DEFAULT now(),
 last_seen_at timestamptz NOT NULL DEFAULT now(),
 review_status text NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','rejected','verified')),
 UNIQUE(source,publication_id)
);
CREATE TABLE IF NOT EXISTS orberadar_private.observations (
 run_id uuid NOT NULL REFERENCES orberadar_private.runs(id),
 candidate_id uuid NOT NULL REFERENCES orberadar_private.candidates(id),
 extracted_at timestamptz NOT NULL DEFAULT now(),
 payload jsonb NOT NULL,
 PRIMARY KEY(run_id,candidate_id)
);
ALTER TABLE orberadar_private.runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE orberadar_private.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE orberadar_private.observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA orberadar_private FROM PUBLIC, anon, authenticated;
COMMIT;
