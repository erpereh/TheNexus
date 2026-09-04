/** A single forward-only schema migration. `up` statements run inside one transaction. */
export interface Migration {
  readonly version: number;
  readonly name: string;
  readonly up: readonly string[];
}

export interface MigrationResult {
  fromVersion: number;
  toVersion: number;
  appliedVersions: readonly number[];
}

/**
 * The canonical schema history of TheNexus local storage.
 *
 * 001 — initial schema: ledger, workspaces, settings, recordings and
 * recording_events (per docs/superpowers/specs/2026-09-03-the-nexus-design.md §19).
 *
 * 002 — retention/replay-support diff. Deliberately exercises both index and
 * column changes so upgrade tests run against a real schema delta:
 * `last_event_id` speeds up resume-from-tail queries, and the status index
 * supports listing by lifecycle state. (Recorded ruling: the plan's original
 * 002 index on recording_events(recording_id, seq) was dropped — that is
 * already the table's PRIMARY KEY.)
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: [
      'CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)',
      'CREATE TABLE workspaces (workspace_id TEXT PRIMARY KEY, name TEXT NOT NULL, root_path TEXT NOT NULL, created_at TEXT NOT NULL)',
      'CREATE TABLE settings (key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at TEXT NOT NULL)',
      `CREATE TABLE recordings (
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
      )`,
      `CREATE TABLE recording_events (
        recording_id TEXT NOT NULL REFERENCES recordings(recording_id) ON DELETE CASCADE,
        seq INTEGER NOT NULL,
        event_json TEXT NOT NULL,
        PRIMARY KEY (recording_id, seq)
      )`,
      'CREATE INDEX idx_recordings_workspace ON recordings(workspace_id)',
      'CREATE INDEX idx_recordings_pinned ON recordings(pinned_at)',
    ],
  },
  {
    version: 2,
    name: 'add_recording_indexes',
    up: [
      'ALTER TABLE recordings ADD COLUMN last_event_id TEXT',
      'CREATE INDEX idx_recordings_status ON recordings(status)',
    ],
  },
];

/** Convenience helper for callers that only need the newest known schema version. */
export function latestSchemaVersion(migrations: readonly Migration[] = MIGRATIONS): number {
  return migrations.reduce((max, migration) => Math.max(max, migration.version), 0);
}
