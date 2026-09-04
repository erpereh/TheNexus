import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { openNodeSqlite } from '../driver/node-sqlite-driver';
import { getSchemaVersion, MigrationError, runMigrations } from './migrate';
import { MIGRATIONS } from './migrations';

const loadFixtureSql = async (): Promise<string> =>
  readFile(fileURLToPath(new URL('./fixtures/schema-v1.sql', import.meta.url)), 'utf8');

const listObjectNames = async (
  driver: ReturnType<typeof openNodeSqlite>,
  objectType: 'table' | 'index',
): Promise<string[]> => {
  const rows = await driver.select<{ name: string }>(
    'SELECT name FROM sqlite_master WHERE type = ? ORDER BY name',
    [objectType],
  );
  return rows.map((row) => row.name);
};

describe('runMigrations', () => {
  it('applies every migration in order on a clean database', async () => {
    const driver = openNodeSqlite(':memory:');
    try {
      const result = await runMigrations(driver);
      expect(result.fromVersion).toBe(0);
      expect(result.toVersion).toBe(MIGRATIONS.length);
      expect(result.appliedVersions).toEqual(MIGRATIONS.map((migration) => migration.version));

      const tables = await listObjectNames(driver, 'table');
      for (const expected of [
        'recordings',
        'recording_events',
        'schema_migrations',
        'settings',
        'workspaces',
      ]) {
        expect(tables).toContain(expected);
      }
      const indexes = await listObjectNames(driver, 'index');
      expect(indexes).toContain('idx_recordings_workspace');
      expect(indexes).toContain('idx_recordings_pinned');
      expect(indexes).toContain('idx_recordings_status');

      const ledger = await driver.select<{ version: number; name: string }>(
        'SELECT version, name FROM schema_migrations ORDER BY version',
      );
      expect(ledger.map((row) => row.version)).toEqual([1, 2]);
      expect(ledger.map((row) => row.name)).toEqual(['initial_schema', 'add_recording_indexes']);
      expect(await getSchemaVersion(driver)).toBe(2);
    } finally {
      await driver.close();
    }
  });

  it('is idempotent: re-running applies nothing and keeps the version', async () => {
    const driver = openNodeSqlite(':memory:');
    try {
      const first = await runMigrations(driver);
      expect(first.appliedVersions).toEqual([1, 2]);
      const second = await runMigrations(driver);
      expect(second).toEqual({ fromVersion: 2, toVersion: 2, appliedVersions: [] });
      const third = await runMigrations(driver);
      expect(third.appliedVersions).toEqual([]);
      const ledger = await driver.select<{ version: number }>(
        'SELECT version FROM schema_migrations ORDER BY version',
      );
      expect(ledger.map((row) => row.version)).toEqual([1, 2]);
    } finally {
      await driver.close();
    }
  });

  it('upgrades the committed schema-v1 fixture while preserving data', async () => {
    const driver = openNodeSqlite(':memory:');
    try {
      // Seed the previous schema (post-001, pre-002) from the committed
      // fixture and store data the way the previous app version would have.
      // A real v1 database also recorded migration 001 in its ledger.
      await driver.execute(await loadFixtureSql());
      await driver.execute(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        [1, 'initial_schema', '2026-09-01T09:00:00.000Z'],
      );
      await driver.execute(
        'INSERT INTO workspaces (workspace_id, name, root_path, created_at) VALUES (?, ?, ?, ?)',
        ['ws_legacy01', 'Legacy Workspace', 'C:/projects/legacy', '2026-09-01T10:00:00.000Z'],
      );
      await driver.execute(
        `INSERT INTO recordings (
           recording_id, created_at, workspace_id, adapter_id, provider,
           status, pinned_at, last_opened_at, byte_size, content_hash, event_count, raw_enabled
         ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, NULL, ?, ?)`,
        [
          'rec_legacy01',
          '2026-09-01T11:00:00.000Z',
          'ws_legacy01',
          'simulator',
          'simulator',
          'finalized',
          1234,
          3,
          0,
        ],
      );
      await driver.execute(
        'INSERT INTO recording_events (recording_id, seq, event_json) VALUES (?, ?, ?)',
        ['rec_legacy01', 0, '{"schemaVersion":1}'],
      );

      const result = await runMigrations(driver);
      expect(result.fromVersion).toBe(1);
      expect(result.toVersion).toBe(2);
      expect(result.appliedVersions).toEqual([2]);

      // Data survives the upgrade untouched.
      const recordings = await driver.select<{ recording_id: string; event_count: number }>(
        'SELECT recording_id, event_count FROM recordings',
      );
      expect(recordings).toEqual([{ recording_id: 'rec_legacy01', event_count: 3 }]);
      const events = await driver.select<{ recording_id: string; seq: number }>(
        'SELECT recording_id, seq FROM recording_events',
      );
      expect(events).toEqual([{ recording_id: 'rec_legacy01', seq: 0 }]);
      const workspaces = await driver.select<{ workspace_id: string }>(
        'SELECT workspace_id FROM workspaces',
      );
      expect(workspaces).toEqual([{ workspace_id: 'ws_legacy01' }]);

      // 002's real diff is present: the new nullable column and the status index.
      const columns = await driver.select<{ name: string }>(
        "SELECT name FROM pragma_table_info('recordings')",
      );
      expect(columns.map((row) => row.name)).toContain('last_event_id');
      const indexes = await listObjectNames(driver, 'index');
      expect(indexes).toContain('idx_recordings_status');
      expect(await getSchemaVersion(driver)).toBe(2);
    } finally {
      await driver.close();
    }
  });

  it('rolls back a failed migration and leaves the ledger unchanged', async () => {
    const driver = openNodeSqlite(':memory:');
    try {
      await runMigrations(driver);
      const recordingsBefore = await driver.select<{ recording_id: string }>(
        'SELECT recording_id FROM recordings',
      );
      expect(recordingsBefore).toEqual([]);

      const broken: typeof MIGRATIONS = [
        ...MIGRATIONS,
        {
          version: 3,
          name: 'broken_migration',
          up: [
            'CREATE TABLE should_rollback (id INTEGER)',
            "INSERT INTO recordings (recording_id, no_such_column) VALUES ('rec_broken1', 1)",
          ],
        },
      ];
      await expect(runMigrations(driver, broken)).rejects.toMatchObject({
        name: 'MigrationError',
        code: 'FAILED',
        version: 3,
      });

      // Ledger unchanged, the partially-applied DDL is gone, existing data intact.
      expect(await getSchemaVersion(driver)).toBe(2);
      const tables = await listObjectNames(driver, 'table');
      expect(tables).not.toContain('should_rollback');
      expect(await driver.select('SELECT recording_id FROM recordings')).toEqual([]);
    } finally {
      await driver.close();
    }
  });

  it('rejects databases newer than the known migrations with DB_NEWER_THAN_MIGRATIONS', async () => {
    const driver = openNodeSqlite(':memory:');
    try {
      // Simulate a database written by a future app version.
      await driver.execute(
        'CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)',
      );
      await driver.execute(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        [9, 'future_migration', '2027-01-01T00:00:00.000Z'],
      );
      await expect(runMigrations(driver)).rejects.toMatchObject({
        name: 'MigrationError',
        code: 'DB_NEWER_THAN_MIGRATIONS',
        version: 9,
      });
      // The database is left exactly as found.
      expect(await getSchemaVersion(driver)).toBe(9);
    } finally {
      await driver.close();
    }
  });

  it('getSchemaVersion returns 0 on a fresh database without a ledger', async () => {
    const driver = openNodeSqlite(':memory:');
    try {
      expect(await getSchemaVersion(driver)).toBe(0);
      await driver.execute('CREATE TABLE unrelated (id INTEGER)');
      expect(await getSchemaVersion(driver)).toBe(0);
    } finally {
      await driver.close();
    }
  });

  it('MigrationError is an Error with a descriptive message', async () => {
    const driver = openNodeSqlite(':memory:');
    try {
      await driver.execute(
        'CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)',
      );
      await driver.execute(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        [9, 'future_migration', '2027-01-01T00:00:00.000Z'],
      );
      const error = await runMigrations(driver).then(
        () => null,
        (caught: unknown) => caught,
      );
      expect(error).toBeInstanceOf(MigrationError);
      expect(error).toBeInstanceOf(Error);
      if (error instanceof MigrationError) {
        expect(error.message).toContain('9');
        expect(error.message).toContain('migration');
      }
    } finally {
      await driver.close();
    }
  });
});
