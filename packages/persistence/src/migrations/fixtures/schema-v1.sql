-- schema-v1.sql — committed fixture recreating the "previous schema" state
-- (post-001, pre-002): the initial TheNexus storage schema WITHOUT the
-- last_event_id column and the idx_recordings_status index that migration 002
-- adds. Upgrade tests load this file into a fresh database, seed legacy rows,
-- run the full migration list and assert both the 002 diff and data survival.
--
-- Keep in sync with migration 001 until real v1 databases exist; the fixture
-- exists so forward-migration tests never depend on live app code.

CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL);
CREATE TABLE workspaces (workspace_id TEXT PRIMARY KEY, name TEXT NOT NULL, root_path TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE settings (key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE recordings (
  recording_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  workspace_id TEXT,
  adapter_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open','finalized')),
  pinned_at TEXT,
  last_opened_at TEXT,
  byte_size INTEGER NOT NULL DEFAULT 0,
  content_hash TEXT,
  event_count INTEGER NOT NULL DEFAULT 0,
  raw_enabled INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE recording_events (
  recording_id TEXT NOT NULL REFERENCES recordings(recording_id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  event_json TEXT NOT NULL,
  PRIMARY KEY (recording_id, seq)
);
CREATE INDEX idx_recordings_workspace ON recordings(workspace_id);
CREATE INDEX idx_recordings_pinned ON recordings(pinned_at);
