/**
 * Storage-agnostic database contract for the persistence layer.
 *
 * Repositories and migrations code against this interface only; concrete
 * drivers (Node `node:sqlite` for tests/scripts, the Tauri SQL plugin for the
 * desktop app) plug in at the edge. `packages/persistence` must not import
 * `@tauri-apps/*` (app driver lands with app integration).
 */
export type SqlParam = string | number | bigint | Uint8Array | null;
export type DatabaseRow = Record<string, unknown>;

export interface DatabaseDriver {
  /** Which concrete technology backs this driver instance. */
  readonly flavor: 'node-sqlite' | 'tauri-sql';
  /**
   * Run a mutating/DDL statement. `SELECT`s belong in {@link DatabaseDriver.select}.
   * When the SQL contains multiple statements (fixtures, migration scripts)
   * the driver falls back to bulk execution and cannot report per-statement
   * change counts (returns rowsAffected 0 / lastInsertRowId null).
   */
  execute(
    sql: string,
    params?: readonly SqlParam[],
  ): Promise<{ rowsAffected: number; lastInsertRowId: number | bigint | null }>;
  /** Run a query and return all rows as objects. */
  select<T extends DatabaseRow = DatabaseRow>(
    sql: string,
    params?: readonly SqlParam[],
  ): Promise<T[]>;
  /**
   * Run `work` inside BEGIN/COMMIT/ROLLBACK. On throw the transaction is
   * rolled back and the original error rethrown. Nested transactions are
   * rejected (no savepoint emulation) — run inner work inside the active
   * transaction instead.
   */
  transaction<T>(work: (tx: DatabaseDriver) => Promise<T>): Promise<T>;
  /** Release the underlying connection. Idempotent. */
  close(): Promise<void>;
}
