import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { DatabaseDriver, DatabaseRow, SqlParam } from './database-driver';

/**
 * True when the SQL string carries more than one statement. `node:sqlite`
 * silently drops statements after the first when preparing, so anything with
 * an interior `;` must go through `DatabaseSync#exec`. A `;` inside a string
 * literal triggers the (still correct) bulk path; only the reported
 * rowsAffected/lastInsertRowId are lost in that case.
 */
function hasMultipleStatements(sql: string): boolean {
  return /;/.test(sql.trim().replace(/;\s*$/, ''));
}

/**
 * Describes an unexpected low-level error without swallowing its identity.
 * Keeps node:sqlite messages ("UNIQUE constraint failed: ...") attached as
 * cause while giving callers the operation context.
 */
function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * SQLite driver for tests, scripts and tools, backed by `node:sqlite`
 * (Node >= 22.13). Supports `:memory:` and file paths; missing parent
 * directories of file paths are created on open.
 *
 * Precision rule: a statement executed with bigint parameters reads integer
 * columns back as bigint for that statement (`setReadBigInts`), so
 * out-of-safe-range INTEGER values round-trip losslessly. Statements without
 * bigint parameters use the default mapping (integers as numbers).
 *
 * Transactions are BEGIN/COMMIT/ROLLBACK without savepoint emulation: nested
 * `transaction()` calls throw a descriptive error instead of corrupting the
 * outer transaction.
 */
export class NodeSqliteDriver implements DatabaseDriver {
  readonly flavor = 'node-sqlite' as const;

  private db: DatabaseSync | null;
  private readonly location: string;
  private transactionDepth = 0;

  constructor(location: string) {
    this.location = location;
    if (location !== ':memory:') {
      // DatabaseSync does not create parent directories; do it for callers
      // handing us deep app-data paths.
      mkdirSync(dirname(location), { recursive: true });
    }
    this.db = new DatabaseSync(location);
  }

  async execute(
    sql: string,
    params: readonly SqlParam[] = [],
  ): Promise<{ rowsAffected: number; lastInsertRowId: number | bigint | null }> {
    const db = this.requireOpen();
    if (params.length > 0) {
      const statement = db.prepare(sql);
      if (params.some((param) => typeof param === 'bigint')) {
        statement.setReadBigInts(true);
      }
      const info = statement.run(...params);
      return { rowsAffected: Number(info.changes), lastInsertRowId: info.lastInsertRowid };
    }
    if (hasMultipleStatements(sql)) {
      db.exec(sql);
      return { rowsAffected: 0, lastInsertRowId: null };
    }
    const statement = db.prepare(sql);
    const info = statement.run();
    return { rowsAffected: Number(info.changes), lastInsertRowId: info.lastInsertRowid };
  }

  async select<T extends DatabaseRow = DatabaseRow>(
    sql: string,
    params: readonly SqlParam[] = [],
  ): Promise<T[]> {
    const db = this.requireOpen();
    const statement = db.prepare(sql);
    if (params.length > 0) {
      if (params.some((param) => typeof param === 'bigint')) {
        statement.setReadBigInts(true);
      }
      return statement.all(...params) as T[];
    }
    return statement.all() as T[];
  }

  async transaction<T>(work: (tx: DatabaseDriver) => Promise<T>): Promise<T> {
    const db = this.requireOpen();
    if (this.transactionDepth > 0) {
      throw new Error(
        'NodeSqliteDriver: nested transactions are not supported (no savepoint emulation); ' +
          'run the inner work inside the active transaction instead',
      );
    }
    this.transactionDepth = 1;
    try {
      db.exec('BEGIN');
    } catch (error: unknown) {
      this.transactionDepth = 0;
      throw new Error(`NodeSqliteDriver: failed to begin transaction: ${describeError(error)}`, {
        cause: error,
      });
    }
    let result: T;
    try {
      result = await work(this);
    } catch (error: unknown) {
      this.rollbackQuietly(db);
      this.transactionDepth = 0;
      throw error;
    }
    try {
      db.exec('COMMIT');
    } catch (error: unknown) {
      this.rollbackQuietly(db);
      throw new Error(`NodeSqliteDriver: failed to commit transaction: ${describeError(error)}`, {
        cause: error,
      });
    } finally {
      this.transactionDepth = 0;
    }
    return result;
  }

  async close(): Promise<void> {
    const db = this.db;
    if (db === null) {
      return;
    }
    this.db = null;
    db.close();
  }

  private requireOpen(): DatabaseSync {
    if (this.db === null) {
      throw new Error(`NodeSqliteDriver: database is closed (${this.location})`);
    }
    return this.db;
  }

  private rollbackQuietly(db: DatabaseSync): void {
    try {
      db.exec('ROLLBACK');
    } catch {
      // A failed COMMIT/aborted connection can leave no transaction to undo;
      // the original error is what matters for the caller.
    }
  }
}

/** Convenience opener for the Node SQLite driver. */
export function openNodeSqlite(location: string): NodeSqliteDriver {
  return new NodeSqliteDriver(location);
}
