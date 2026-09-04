import type { DatabaseDriver } from '../driver/database-driver';
import { MIGRATIONS, type Migration, type MigrationResult } from './migrations';

export type MigrationErrorCode = 'FAILED' | 'DB_NEWER_THAN_MIGRATIONS';

/**
 * Migration failure with a stable code so callers can branch without parsing
 * messages. `FAILED` means the migration transaction was rolled back and the
 * database still sits at the previous version; `DB_NEWER_THAN_MIGRATIONS`
 * means the database was written by a newer app version and must never be
 * silently reinterpreted (docs/architecture/04-storage-privacy-security.md).
 */
export class MigrationError extends Error {
  readonly code: MigrationErrorCode;
  /** Migration version involved, when known. */
  readonly version: number | null;

  constructor(
    code: MigrationErrorCode,
    message: string,
    options: { version?: number; cause?: unknown } = {},
  ) {
    const { cause, version } = options;
    if (cause !== undefined) {
      super(message, { cause });
    } else {
      super(message);
    }
    this.name = 'MigrationError';
    this.code = code;
    this.version = version ?? null;
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Highest version recorded in the schema_migrations ledger; 0 when the
 * ledger does not exist yet (fresh database, or a database this layer has
 * never touched).
 */
export async function getSchemaVersion(driver: DatabaseDriver): Promise<number> {
  const ledger = await driver.select<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'",
  );
  if (ledger.length === 0) {
    return 0;
  }
  const rows = await driver.select<{ version: number | bigint | null }>(
    'SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations',
  );
  const version = rows[0]?.version;
  if (typeof version === 'bigint') {
    return Number(version);
  }
  return typeof version === 'number' ? version : 0;
}

/**
 * Apply pending migrations in version order. Each migration runs inside a
 * single transaction (statements + ledger insert): on failure the
 * transaction rolls back and the database keeps the previous schema, then a
 * `MigrationError` with code `FAILED` is thrown. Re-running on an
 * already-migrated database applies nothing (idempotent by ledger). A
 * database whose recorded version exceeds the highest known migration is
 * rejected with `DB_NEWER_THAN_MIGRATIONS` and left untouched.
 */
export async function runMigrations(
  driver: DatabaseDriver,
  migrations: readonly Migration[] = MIGRATIONS,
): Promise<MigrationResult> {
  const fromVersion = await getSchemaVersion(driver);
  const maxKnownVersion = migrations.reduce(
    (max, migration) => Math.max(max, migration.version),
    0,
  );
  if (fromVersion > maxKnownVersion) {
    throw new MigrationError(
      'DB_NEWER_THAN_MIGRATIONS',
      `database schema version ${fromVersion} is newer than the highest known migration ` +
        `${maxKnownVersion}; refusing to modify a database written by a newer app version`,
      { version: fromVersion },
    );
  }

  const pending = [...migrations]
    .sort((a, b) => a.version - b.version)
    .filter((migration) => migration.version > fromVersion);

  const appliedVersions: number[] = [];
  for (const migration of pending) {
    try {
      await driver.transaction(async (tx) => {
        for (const statement of migration.up) {
          await tx.execute(statement);
        }
        await tx.execute(
          'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
          [migration.version, migration.name, new Date().toISOString()],
        );
      });
    } catch (error: unknown) {
      throw new MigrationError(
        'FAILED',
        `migration ${migration.version} (${migration.name}) failed; the transaction was rolled ` +
          `back and the database remains at schema version ${fromVersion + appliedVersions.length}: ` +
          describeError(error),
        { version: migration.version, cause: error },
      );
    }
    appliedVersions.push(migration.version);
  }

  return {
    fromVersion,
    toVersion: fromVersion + appliedVersions.length,
    appliedVersions,
  };
}
