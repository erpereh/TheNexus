import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { DatabaseDriver } from './database-driver';
import { NodeSqliteDriver, openNodeSqlite } from './node-sqlite-driver';

describe('NodeSqliteDriver', () => {
  let tempDir: string | undefined;
  const makeTempDir = (): string => {
    tempDir = mkdtempSync(join(tmpdir(), 'thenexus-persistence-'));
    return tempDir;
  };
  afterEach(() => {
    if (tempDir !== undefined) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it('reports the node-sqlite flavor and satisfies the DatabaseDriver contract', async () => {
    const driver: DatabaseDriver = openNodeSqlite(':memory:');
    try {
      expect(driver.flavor).toBe('node-sqlite');
      expect(driver).toBeInstanceOf(NodeSqliteDriver);
    } finally {
      await driver.close();
    }
  });

  it('executes DDL and DML, reporting rowsAffected and lastInsertRowId', async () => {
    const driver = openNodeSqlite(':memory:');
    try {
      await driver.execute('CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
      const first = await driver.execute('INSERT INTO items (name) VALUES (?)', ['alpha']);
      expect(first.rowsAffected).toBe(1);
      expect(first.lastInsertRowId).toBe(1);
      const batch = await driver.execute("INSERT INTO items (name) VALUES ('beta'), ('gamma')");
      expect(batch.rowsAffected).toBe(2);
      const removed = await driver.execute('DELETE FROM items WHERE name = ?', ['beta']);
      expect(removed.rowsAffected).toBe(1);
      expect(first.lastInsertRowId).not.toBeNull();
    } finally {
      await driver.close();
    }
  });

  it('binds string, number, bigint, null and blob parameters and round-trips values', async () => {
    const driver = openNodeSqlite(':memory:');
    try {
      await driver.execute('CREATE TABLE t (s TEXT, n INTEGER, b INTEGER, z, x BLOB)');
      await driver.execute('INSERT INTO t (s, n, b, z, x) VALUES (?, ?, ?, ?, ?)', [
        'text',
        42,
        9007199254740993n,
        null,
        new Uint8Array([1, 2, 3, 250]),
      ]);
      // Driver rule: statements executed with bigint parameters read integer
      // columns back as bigint for that statement, so out-of-safe-range
      // INTEGER values round-trip without precision loss (small integers on
      // bigint-param statements also come back as bigint).
      const rows = await driver.select<{
        s: string;
        n: number | bigint;
        b: number | bigint;
        z: null;
        x: Uint8Array;
      }>('SELECT s, n, b, z, x FROM t WHERE b = ?', [9007199254740993n]);
      expect(rows).toEqual([
        { s: 'text', n: 42n, b: 9007199254740993n, z: null, x: new Uint8Array([1, 2, 3, 250]) },
      ]);
    } finally {
      await driver.close();
    }
  });

  it('select returns typed rows and an empty array when nothing matches', async () => {
    const driver = openNodeSqlite(':memory:');
    try {
      await driver.execute('CREATE TABLE t (v TEXT)');
      await driver.execute('INSERT INTO t (v) VALUES (?)', ['value']);
      const rows = await driver.select<{ v: string }>('SELECT v FROM t WHERE v = ?', ['value']);
      expect(rows.map((row) => row.v)).toEqual(['value']);
      const none = await driver.select<{ v: string }>('SELECT v FROM t WHERE v = ?', ['missing']);
      expect(none).toEqual([]);
    } finally {
      await driver.close();
    }
  });

  it('commits transactional work on success', async () => {
    const driver = openNodeSqlite(':memory:');
    try {
      await driver.execute('CREATE TABLE t (v INTEGER)');
      const result = await driver.transaction(async (tx) => {
        await tx.execute('INSERT INTO t (v) VALUES (?)', [1]);
        await tx.execute('INSERT INTO t (v) VALUES (?)', [2]);
        return 'done';
      });
      expect(result).toBe('done');
      const rows = await driver.select<{ v: number }>('SELECT v FROM t ORDER BY v');
      expect(rows.map((row) => row.v)).toEqual([1, 2]);
    } finally {
      await driver.close();
    }
  });

  it('rolls back and rethrows when the transactional callback throws', async () => {
    const driver = openNodeSqlite(':memory:');
    try {
      await driver.execute('CREATE TABLE t (v INTEGER)');
      await expect(
        driver.transaction(async (tx) => {
          await tx.execute('INSERT INTO t (v) VALUES (?)', [1]);
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');
      const rows = await driver.select<{ v: number }>('SELECT v FROM t');
      expect(rows).toEqual([]);
    } finally {
      await driver.close();
    }
  });

  it('rolls back when a statement fails mid-transaction and the driver stays usable', async () => {
    const driver = openNodeSqlite(':memory:');
    try {
      await driver.execute('CREATE TABLE t (id TEXT PRIMARY KEY, v INTEGER)');
      await expect(
        driver.transaction(async (tx) => {
          await tx.execute("INSERT INTO t (id, v) VALUES ('kept', 1)");
          await tx.execute("INSERT INTO t (id, v) VALUES ('kept', 2)");
          return null;
        }),
      ).rejects.toThrow(/unique constraint/i);
      const rows = await driver.select<{ id: string }>('SELECT id FROM t');
      expect(rows).toEqual([]);
      await driver.execute("INSERT INTO t (id, v) VALUES ('after', 3)");
      expect(await driver.select('SELECT id FROM t')).toHaveLength(1);
    } finally {
      await driver.close();
    }
  });

  it('rejects nested transactions with a descriptive error', async () => {
    const driver = openNodeSqlite(':memory:');
    try {
      await driver.execute('CREATE TABLE t (v INTEGER)');
      await expect(
        driver.transaction(async (tx) => tx.transaction(async () => 'inner')),
      ).rejects.toThrow(/nested transaction/i);
      // The failed nesting must not leave the driver wedged.
      await driver.execute('INSERT INTO t (v) VALUES (?)', [7]);
      expect(await driver.select('SELECT v FROM t')).toHaveLength(1);
    } finally {
      await driver.close();
    }
  });

  it('supports file-backed databases and creates missing parent directories', async () => {
    const location = join(makeTempDir(), 'nested', 'deeper', 'test.db');
    const writer = openNodeSqlite(location);
    try {
      await writer.execute('CREATE TABLE t (v TEXT)');
      await writer.execute('INSERT INTO t (v) VALUES (?)', ['persisted']);
    } finally {
      await writer.close();
    }
    const reopened = openNodeSqlite(location);
    try {
      const rows = await reopened.select<{ v: string }>('SELECT v FROM t');
      expect(rows.map((row) => row.v)).toEqual(['persisted']);
    } finally {
      await reopened.close();
    }
  });

  it('close is idempotent and a closed driver refuses operations with a descriptive error', async () => {
    const driver = openNodeSqlite(':memory:');
    await driver.close();
    await expect(driver.close()).resolves.toBeUndefined();
    await expect(driver.execute('SELECT 1')).rejects.toThrow(/closed/i);
    await expect(driver.select('SELECT 1')).rejects.toThrow(/closed/i);
    await expect(driver.transaction(async () => 'x')).rejects.toThrow(/closed/i);
  });
});
