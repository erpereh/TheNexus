// @thenexus/persistence
// Local-first storage: database drivers, versioned migrations, the recordings
// repository with retention, and best-effort secret redaction.
//
// Boundary note: everything here is storage-agnostic. The Tauri SQL driver is
// wired at app-integration time; this package must never import
// `@tauri-apps/*` or provider-specific code.

// Database driver contract + Node driver.
export type { DatabaseDriver, DatabaseRow, SqlParam } from './driver/database-driver';
export { NodeSqliteDriver, openNodeSqlite } from './driver/node-sqlite-driver';

// Versioned migrations.
export { getSchemaVersion, MigrationError, runMigrations } from './migrations/migrate';
export type { MigrationErrorCode } from './migrations/migrate';
export { latestSchemaVersion, MIGRATIONS } from './migrations/migrations';
export type { Migration, MigrationResult } from './migrations/migrations';

// Recordings repository.
export {
  createRecordingsRepository,
  MAX_EVENTS_PER_RECORDING,
  MAX_EVENT_JSON_BYTES,
  MAX_IMPORT_BYTES,
} from './repositories/recordings-repository';
export type {
  RecordingsRepository,
  RecordingLoadResult,
  RecordingMeta,
} from './repositories/recordings-repository';

// Retention.
export { applyRetention, selectExpiredRecordings } from './retention/retention';
export type { RecordingRowView, RetentionPlan, RetentionSettings } from './retention/retention';

// Best-effort secret redaction.
export { redactJsonStrings, redactSecrets } from './redaction/redact';
export type { RedactionOptions, RedactionResult, SecretKind } from './redaction/redact';
