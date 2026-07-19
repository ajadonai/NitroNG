-- CI-only prerequisite for the immutable pre-remediation schema snapshot.
-- The snapshot declares trigram operator classes which PostgreSQL exposes
-- only after this extension is installed.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
