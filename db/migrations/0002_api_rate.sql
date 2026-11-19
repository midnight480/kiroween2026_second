-- 灯 Tomoshibi: request counter for the public API (/api/v1/*, worker/index.ts).
-- One row per API key, keyed by the SHA-256 of the key (the key itself is never stored).
-- The window restarts when a request comes more than a minute after the window began.

CREATE TABLE IF NOT EXISTS api_rate (
  key_hash     text        PRIMARY KEY,
  window_start timestamptz NOT NULL,
  count        integer     NOT NULL
);
