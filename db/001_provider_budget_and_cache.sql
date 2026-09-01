CREATE TABLE IF NOT EXISTS adl_provider_usage (
  provider TEXT NOT NULL,
  period TEXT NOT NULL,
  call_count INTEGER NOT NULL DEFAULT 0 CHECK (call_count >= 0),
  spend_micros BIGINT NOT NULL DEFAULT 0 CHECK (spend_micros >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (provider, period)
);

CREATE TABLE IF NOT EXISTS adl_search_cache (
  query_key TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  payload JSONB NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS adl_search_cache_expires_idx
  ON adl_search_cache (expires_at);
