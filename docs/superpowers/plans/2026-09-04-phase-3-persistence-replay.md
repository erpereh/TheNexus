# TheNexus Phase 3 — Persistence and Replay Plan

**Goal:** Local SQLite persistence with versioned migrations for recordings/settings/workspaces, a retention/pinning model, best-effort secret redaction, and a timer-free deterministic replay engine with 1x/2x/5x/10x/50x speeds.

**Architecture:** `packages/persistence` owns storage behind a `DatabaseDriver` interface (framework-agnostic repositories; a Node `node:sqlite` driver for tests/scripts; the Tauri SQL driver is wired at app-integration time). `packages/replay-engine` owns deterministic playback over `RecordingEnvelope` with an injected scheduler. Both depend only on `@thenexus/contracts`.

**Tech Stack:** TypeScript strict, `node:sqlite` (`DatabaseSync`, Node >= 22.13; CI runs Node 24), Vitest 5, Zod contracts. No Tauri runtime is available or required in tests.

**Spec:** `docs/superpowers/specs/2026-09-03-the-nexus-design.md` §18/§19/§20, `docs/architecture/04-storage-privacy-security.md`, acceptance checklist section D.

## Global Constraints

- `packages/persistence` must NOT import `@tauri-apps/*` (app driver lands with app integration).
- No real provider calls; recordings come from the simulator/fixtures.
- Never silently reinterpret old persisted data: unsupported future schema versions are errors.
- Corrupt imports fail safely with structured errors; a failed migration must roll back and leave the previous schema intact.
- Raw prompts/file contents are not persisted by this layer; redaction is best-effort and documented as such.
- TDD with the listed test names; commit per task; root gates must pass.

---

### Task 1: DatabaseDriver interface + Node `node:sqlite` driver

**Files:** `packages/persistence/src/driver/database-driver.ts`, `src/driver/node-sqlite-driver.ts`, tests.

```ts
export type SqlParam = string | number | bigint | Uint8Array | null;
export type DatabaseRow = Record<string, unknown>;
export interface DatabaseDriver {
  readonly flavor: 'node-sqlite' | 'tauri-sql';
  execute(sql: string, params?: readonly SqlParam[]): Promise<{ rowsAffected: number; lastInsertRowId: number | bigint | null }>;
  select<T extends DatabaseRow = DatabaseRow>(sql: string, params?: readonly SqlParam[]): Promise<T[]>;
  transaction<T>(work: (tx: DatabaseDriver) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
```

**Tests:** DDL/DML execution; string/number/bigint/null param binding; transaction commit on success and rollback on throw; select returns typed rows.

### Task 2: Versioned migration system

**Files:** `src/migrations/migrations.ts` (MIGRATIONS table; 001 creates `schema_migrations`, `workspaces`, `recordings`, `recording_events`, `settings` per design), `src/migrations/migrate.ts` (`runMigrations`, `getSchemaVersion`, `MigrationError` with codes `FAILED` | `DB_NEWER_THAN_MIGRATIONS`), `src/migrations/fixtures/schema-v1.sql` (previous-schema fixture without an index/column that 002 adds), migrations `001` + `002` (002 adds `recording_events.event_json` index + `recordings.raw_enabled` column).

```ts
export interface Migration { readonly version: number; readonly name: string; readonly up: readonly string[]; }
export interface MigrationResult { fromVersion: number; toVersion: number; appliedVersions: readonly number[]; }
export function runMigrations(driver: DatabaseDriver, migrations?: readonly Migration[]): Promise<MigrationResult>;
export function getSchemaVersion(driver: DatabaseDriver): Promise<number>;
```

**Tests:** clean-DB full migration in order; idempotent re-run; fixture upgrade preserving data; failed migration rolls back with ledger unchanged; DB newer than migrations rejected with `DB_NEWER_THAN_MIGRATIONS`.

Schema 001 (concrete):
```sql
CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL);
CREATE TABLE workspaces (workspace_id TEXT PRIMARY KEY, name TEXT NOT NULL, root_path TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE settings (key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE recordings (
  recording_id TEXT PRIMARY KEY, created_at TEXT NOT NULL, workspace_id TEXT,
  adapter_id TEXT NOT NULL, provider TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open','finalized')),
  pinned_at TEXT, last_opened_at TEXT, byte_size INTEGER NOT NULL DEFAULT 0,
  content_hash TEXT, event_count INTEGER NOT NULL DEFAULT 0, raw_enabled INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE recording_events (
  recording_id TEXT NOT NULL REFERENCES recordings(recording_id) ON DELETE CASCADE,
  seq INTEGER NOT NULL, event_json TEXT NOT NULL,
  PRIMARY KEY (recording_id, seq)
);
CREATE INDEX idx_recordings_workspace ON recordings(workspace_id);
CREATE INDEX idx_recordings_pinned ON recordings(pinned_at);
```

### Task 3: Recordings repository + retention

**Files:** `src/repositories/recordings-repository.ts` (`createRecordingsRepository(driver)`), `src/retention/retention.ts` (`selectExpiredRecordings` pure + `applyRetention`), tests. Limits: `MAX_EVENTS_PER_RECORDING = 250_000`, `MAX_EVENT_JSON_BYTES = 262144`, `MAX_IMPORT_BYTES = 67108864`.

```ts
export interface RecordingMeta { recordingId: string; createdAt: string; workspaceId?: string; adapterId: string; provider: string; rawEnabled: boolean; }
export type RecordingLoadResult =
  | { ok: true; recording: RecordingEnvelope }
  | { ok: false; code: 'NOT_FOUND' | 'UNSUPPORTED_VERSION' | 'INVALID_ENVELOPE' | 'CORRUPT_EVENTS'; message: string; corruptEventCount?: number };
export interface RecordingsRepository {
  beginRecording(meta: RecordingMeta): Promise<void>;
  appendEvents(recordingId: string, events: readonly NormalizedEvent[]): Promise<void>;
  finalizeRecording(recordingId: string, contentHash: string, byteSize: number): Promise<void>;
  loadRecording(recordingId: string): Promise<RecordingLoadResult>;
  listRecordings(filter: { workspaceId?: string; pinnedOnly?: boolean }): Promise<readonly RecordingSummary[]>;
  setPinned(recordingId: string, pinned: boolean): Promise<void>;
  deleteRecording(recordingId: string): Promise<void>;
  exportEnvelope(recordingId: string): Promise<RecordingParseResult>;
  importEnvelope(input: unknown): Promise<{ ok: true; recordingId: string } | { ok: false; code: 'UNSUPPORTED_VERSION' | 'INVALID_ENVELOPE' | 'TOO_LARGE' | 'TOO_MANY_EVENTS'; message: string }>;
}
```

```ts
export interface RetentionSettings { enabled: boolean; maxAgeDays: number; maxUnpinnedRecordings: number; maxTotalBytes: number; }
export interface RetentionPlan { deleteRecordingIds: readonly string[]; pruneRawIds: readonly string[]; }
export function selectExpiredRecordings(rows: readonly RecordingRowView, settings: RetentionSettings, now: string): RetentionPlan;
```

**Tests:** begin/append/finalize/load round-trip with deterministic seq order; UNSUPPORTED_VERSION from a doctored future-version row; CORRUPT_EVENTS with counts (skips bad rows, never throws); import rejects oversize/malformed without partial inserts; export re-parses via `parseRecording` and equals original; pinned/list filters; retention honors maxAgeDays/maxUnpinned/maxTotalBytes and NEVER deletes pinned; applyRetention cascades.

### Task 4: Secret redaction (pure)

**Files:** `src/redaction/redact.ts`, tests.

```ts
export type SecretKind = 'api-key' | 'bearer' | 'auth-header' | 'private-key' | 'env-secret' | 'jwt' | 'provider-token';
export interface RedactionOptions { kinds?: readonly SecretKind[]; replacement?: string; }
export interface RedactionResult { text: string; redactedCount: number; kinds: readonly SecretKind[]; }
export function redactSecrets(text: string, options?: RedactionOptions): RedactionResult;
export function redactJsonStrings(value: unknown, options?: RedactionOptions): unknown;
```

Patterns: `sk-proj-…`/`sk-ant-…`/`sk-…`, `gh[pousr]_…`, `glpat-…`, `xox…`, `AKIA…`+secret, `AIza…`, `npm_…`, JWT `eyJ…` triplets, `Authorization: Bearer …`, private-key blocks, `VAR_(KEY|TOKEN|SECRET|PASSWORD)=…`/`export …`. Replacement `[REDACTED:<kind>]`. Idempotent; non-secret text untouched. Doc comment must state best-effort, not exhaustive.

**Tests:** one per pattern class + idempotency + non-secret preservation + nested `redactJsonStrings`.

### Task 5: Replay engine (timer-free, deterministic)

**Files:** `packages/replay-engine/src/timeline.ts`, `src/replay-engine.ts`, `src/manual-scheduler.ts`, `src/index.ts`, tests.

```ts
export const REPLAY_SPEEDS = [1, 2, 5, 10, 50] as const;
export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number];
export type ReplayStatus = 'idle' | 'playing' | 'paused' | 'finished';
export interface ReplayEntry { index: number; eventId: string; kind: string; activity: SemanticActivity; occurredAt: string; offsetMs: number; delayMs: number; }
export interface ReplayTimeline { recordingId: string; entries: readonly ReplayEntry[]; totalEvents: number; durationMs: number; }
export function buildReplayTimeline(recording: RecordingEnvelope): ReplayTimeline; // preserves observed order; clamps non-monotonic gaps to delayMs 0
export interface ReplayScheduler { nowMs(): number; schedule(delayMs: number, task: () => void): () => void; }
export interface ReplayListener { onStateChange?(state: ReplayState): void; onEvent?(event: NormalizedEvent, index: number): void; onJump?(applied: readonly NormalizedEvent[], toIndex: number): void; onFinish?(): void; }
export interface ReplayProjector<S> { initialState(): S; apply(state: S, event: NormalizedEvent): S; }
export interface ReplayState { status: ReplayStatus; speed: ReplaySpeed; nextIndex: number; totalEvents: number; }
export class ReplayEngine<S> {
  constructor(options: { timeline: ReplayTimeline; scheduler: ReplayScheduler; projector: ReplayProjector<S>; listener?: ReplayListener });
  play(): void; pause(): void; resume(): void; stepForward(): void; stepBackward(): void; jumpTo(index: number): void; setSpeed(speed: ReplaySpeed): void; getState(): ReplayState; dispose(): void;
}
export class ManualReplayScheduler implements ReplayScheduler { /* virtual time: advanceBy, advanceToNext, pendingCount */ }
```

**Tests:** timeline order preserved + gap clamping; 1x full play in order; identical projector snapshots at 1x/2x/5x/10x/50x; mid-flight speed change does not alter logical outcome; pause/resume no loss/duplication; stepForward/stepBackward exactly one entry; jumpTo applies prefix through projector; dispose/pause cancels pending; onFinish exactly once; two different control interleavings reach identical final state.

### Task 6: Review gate + evidence

Fresh reviewer subagent over the whole Phase 3 diff; fix Critical/High; run root gates + package tests fresh; update ledger + checklist section D items proven; commit.

## Ownership

- Agent A owns `packages/persistence/**` exclusively.
- Agent B owns `packages/replay-engine/**` exclusively.
- Coordinator integrates, updates root configs if needed, commits.
