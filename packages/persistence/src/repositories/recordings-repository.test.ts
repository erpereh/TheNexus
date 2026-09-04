import { describe, expect, it } from 'vitest';
import {
  isNormalizedEvent,
  NORMALIZED_EVENT_SCHEMA_VERSION,
  type NormalizedEvent,
  type RecordingEnvelope,
} from '@thenexus/contracts';
import { openNodeSqlite } from '../driver/node-sqlite-driver';
import { runMigrations } from '../migrations/migrate';
import {
  createRecordingsRepository,
  MAX_EVENTS_PER_RECORDING,
  MAX_EVENT_JSON_BYTES,
  MAX_IMPORT_BYTES,
  type RecordingsRepository,
} from './recordings-repository';

function makeEvent(index: number): NormalizedEvent {
  return {
    schemaVersion: NORMALIZED_EVENT_SCHEMA_VERSION,
    eventId: `evt_${String(index).padStart(4, '0')}`,
    workspaceId: 'ws_demo',
    sessionId: 'sess_0001',
    agentId: 'agent_0001',
    parentAgentId: null,
    sequence: index,
    occurredAt: '2026-09-04T10:00:00.000Z',
    kind: 'activity.changed',
    activity: 'coding',
    source: { adapterId: 'simulator', provider: 'simulator' },
    metadata: {},
  };
}

function makeEnvelope(
  recordingId: string,
  events: NormalizedEvent[],
  overrides: Partial<Pick<RecordingEnvelope, 'createdAt' | 'workspaceId'>> = {},
): RecordingEnvelope {
  return {
    formatVersion: 1,
    recordingId,
    createdAt: '2026-09-04T10:00:00.000Z',
    workspaceId: 'ws_demo',
    generator: { adapterId: 'simulator', provider: 'simulator' },
    events,
    eventCount: events.length,
    ...overrides,
  };
}

async function makeRepository(): Promise<{
  driver: ReturnType<typeof openNodeSqlite>;
  repo: RecordingsRepository;
}> {
  const driver = openNodeSqlite(':memory:');
  await runMigrations(driver);
  return { driver, repo: createRecordingsRepository(driver) };
}

describe('RecordingsRepository lifecycle', () => {
  it('begin/append/finalize/load round-trips events in deterministic seq order', async () => {
    const { driver, repo } = await makeRepository();
    try {
      await repo.beginRecording({
        recordingId: 'rec_roundtrip01',
        createdAt: '2026-09-04T10:00:00.000Z',
        workspaceId: 'ws_demo',
        adapterId: 'simulator',
        provider: 'simulator',
        rawEnabled: false,
      });
      // Appends in separate batches must continue the seq sequence.
      await repo.appendEvents('rec_roundtrip01', [makeEvent(0)]);
      await repo.appendEvents('rec_roundtrip01', [makeEvent(1), makeEvent(2)]);
      await repo.finalizeRecording('rec_roundtrip01', 'deadbeef', 4096);

      const loaded = await repo.loadRecording('rec_roundtrip01');
      expect(loaded.ok).toBe(true);
      if (!loaded.ok) throw new Error('expected ok load');
      expect(loaded.recording.recordingId).toBe('rec_roundtrip01');
      expect(loaded.recording.formatVersion).toBe(1);
      expect(loaded.recording.workspaceId).toBe('ws_demo');
      expect(loaded.recording.generator).toEqual({ adapterId: 'simulator', provider: 'simulator' });
      expect(loaded.recording.events.map((event) => event.eventId)).toEqual([
        'evt_0000',
        'evt_0001',
        'evt_0002',
      ]);
      expect(loaded.recording.eventCount).toBe(3);

      const stored = await driver.select<{
        status: string;
        content_hash: string;
        byte_size: number;
      }>('SELECT status, content_hash, byte_size FROM recordings WHERE recording_id = ?', [
        'rec_roundtrip01',
      ]);
      expect(stored[0]).toMatchObject({
        status: 'finalized',
        content_hash: 'deadbeef',
        byte_size: 4096,
      });
    } finally {
      await driver.close();
    }
  });

  it('loadRecording reports NOT_FOUND for unknown ids', async () => {
    const { driver, repo } = await makeRepository();
    try {
      const result = await repo.loadRecording('rec_missing01');
      expect(result).toMatchObject({ ok: false, code: 'NOT_FOUND' });
    } finally {
      await driver.close();
    }
  });

  it('appendEvents rejects invalid events at the boundary without inserting anything', async () => {
    const { driver, repo } = await makeRepository();
    try {
      await repo.beginRecording({
        recordingId: 'rec_boundary1',
        createdAt: '2026-09-04T10:00:00.000Z',
        adapterId: 'simulator',
        provider: 'simulator',
        rawEnabled: false,
      });
      const invalid = { eventId: 'evt_bad' } as NormalizedEvent;
      expect(isNormalizedEvent(invalid)).toBe(false);
      await expect(repo.appendEvents('rec_boundary1', [makeEvent(0), invalid])).rejects.toThrow(
        /normalized event/i,
      );
      const counts = await driver.select<{ c: number }>(
        'SELECT COUNT(*) AS c FROM recording_events',
      );
      expect(counts[0]?.c).toBe(0);
    } finally {
      await driver.close();
    }
  });

  it('appendEvents refuses finalized and unknown recordings', async () => {
    const { driver, repo } = await makeRepository();
    try {
      await repo.beginRecording({
        recordingId: 'rec_finalized1',
        createdAt: '2026-09-04T10:00:00.000Z',
        adapterId: 'simulator',
        provider: 'simulator',
        rawEnabled: false,
      });
      await repo.finalizeRecording('rec_finalized1', 'hash', 10);
      await expect(repo.appendEvents('rec_finalized1', [makeEvent(0)])).rejects.toThrow(
        /finalized/i,
      );
      await expect(repo.appendEvents('rec_missing99', [makeEvent(0)])).rejects.toThrow(
        /not found/i,
      );
      expect(await driver.select('SELECT recording_id FROM recordings')).toHaveLength(1);
    } finally {
      await driver.close();
    }
  });

  it('appendEvents enforces MAX_EVENT_JSON_BYTES per event', async () => {
    const { repo } = await makeRepository();
    await repo.beginRecording({
      recordingId: 'rec_bigevent1',
      createdAt: '2026-09-04T10:00:00.000Z',
      adapterId: 'simulator',
      provider: 'simulator',
      rawEnabled: false,
    });
    const bloated = {
      ...makeEvent(0),
      metadata: { blob: 'x'.repeat(MAX_EVENT_JSON_BYTES) },
    };
    await expect(repo.appendEvents('rec_bigevent1', [bloated])).rejects.toThrow(
      /MAX_EVENT_JSON_BYTES/,
    );
  });

  it('appendEvents enforces MAX_EVENTS_PER_RECORDING', async () => {
    const { driver, repo } = await makeRepository();
    try {
      await repo.beginRecording({
        recordingId: 'rec_fulleven1',
        createdAt: '2026-09-04T10:00:00.000Z',
        adapterId: 'simulator',
        provider: 'simulator',
        rawEnabled: false,
      });
      // Seed the counter near the ceiling instead of allocating 250k events.
      await driver.execute('UPDATE recordings SET event_count = ? WHERE recording_id = ?', [
        MAX_EVENTS_PER_RECORDING - 1,
        'rec_fulleven1',
      ]);
      await expect(
        repo.appendEvents('rec_fulleven1', [makeEvent(0), makeEvent(1)]),
      ).rejects.toThrow(/MAX_EVENTS_PER_RECORDING/);
      const counts = await driver.select<{ c: number }>(
        'SELECT COUNT(*) AS c FROM recording_events',
      );
      expect(counts[0]?.c).toBe(0);
    } finally {
      await driver.close();
    }
  });

  it('loadRecording reports UNSUPPORTED_VERSION for doctored future-version event rows', async () => {
    const { driver, repo } = await makeRepository();
    try {
      await repo.beginRecording({
        recordingId: 'rec_futurev01',
        createdAt: '2026-09-04T10:00:00.000Z',
        adapterId: 'simulator',
        provider: 'simulator',
        rawEnabled: false,
      });
      await repo.appendEvents('rec_futurev01', [makeEvent(0), makeEvent(1)]);
      await driver.execute(
        'UPDATE recording_events SET event_json = REPLACE(event_json, \'"schemaVersion":1\', \'"schemaVersion":2\') ' +
          'WHERE recording_id = ? AND seq = 0',
        ['rec_futurev01'],
      );
      const result = await repo.loadRecording('rec_futurev01');
      expect(result).toMatchObject({
        ok: false,
        code: 'UNSUPPORTED_VERSION',
      });
      if (!result.ok) {
        expect(result.message).toContain('schemaVersion');
      }
    } finally {
      await driver.close();
    }
  });

  it('loadRecording reports CORRUPT_EVENTS with counts and never throws', async () => {
    const { driver, repo } = await makeRepository();
    try {
      await repo.beginRecording({
        recordingId: 'rec_corrupt01',
        createdAt: '2026-09-04T10:00:00.000Z',
        adapterId: 'simulator',
        provider: 'simulator',
        rawEnabled: false,
      });
      await repo.appendEvents('rec_corrupt01', [makeEvent(0), makeEvent(1), makeEvent(2)]);
      // Two distinct corruption modes: non-JSON text and valid JSON of the wrong shape.
      await driver.execute(
        "UPDATE recording_events SET event_json = '{not json' WHERE recording_id = ? AND seq = 0",
        ['rec_corrupt01'],
      );
      await driver.execute(
        'UPDATE recording_events SET event_json = \'"just a string"\' WHERE recording_id = ? AND seq = 2',
        ['rec_corrupt01'],
      );
      const result = await repo.loadRecording('rec_corrupt01');
      expect(result).toMatchObject({
        ok: false,
        code: 'CORRUPT_EVENTS',
        corruptEventCount: 2,
      });
    } finally {
      await driver.close();
    }
  });

  it('setPinned pins and unpins, listRecordings honors workspace/pinned filters', async () => {
    const { repo } = await makeRepository();
    const fixtures: ReadonlyArray<readonly [string, string, string]> = [
      ['rec_list_a01', 'ws_demo', '2026-09-04T10:01:00.000Z'],
      ['rec_list_b02', 'ws_demo', '2026-09-04T10:02:00.000Z'],
      ['rec_list_c03', 'ws_other', '2026-09-04T10:03:00.000Z'],
    ];
    for (const [id, workspaceId, createdAt] of fixtures) {
      await repo.beginRecording({
        recordingId: id,
        createdAt,
        workspaceId,
        adapterId: 'simulator',
        provider: 'simulator',
        rawEnabled: false,
      });
    }
    await repo.setPinned('rec_list_a01', true);

    const all = await repo.listRecordings({});
    expect(all.map((recording) => recording.recordingId)).toHaveLength(3);

    const demo = await repo.listRecordings({ workspaceId: 'ws_demo' });
    expect(demo.map((recording) => recording.recordingId).sort()).toEqual([
      'rec_list_a01',
      'rec_list_b02',
    ]);

    const pinned = await repo.listRecordings({ pinnedOnly: true });
    expect(pinned.map((recording) => recording.recordingId)).toEqual(['rec_list_a01']);

    const summary = all.find((recording) => recording.recordingId === 'rec_list_a01');
    expect(summary).toMatchObject({
      recordingId: 'rec_list_a01',
      createdAt: '2026-09-04T10:01:00.000Z',
      eventCount: 0,
      generator: { adapterId: 'simulator', provider: 'simulator' },
    });

    await repo.setPinned('rec_list_a01', false);
    expect(await repo.listRecordings({ pinnedOnly: true })).toEqual([]);
  });

  it('setPinned and deleteRecording refuse unknown recordings', async () => {
    const { repo } = await makeRepository();
    await expect(repo.setPinned('rec_missing01', true)).rejects.toThrow(/not found/i);
    await expect(repo.deleteRecording('rec_missing01')).rejects.toThrow(/not found/i);
  });

  it('deleteRecording removes the recording and cascades events', async () => {
    const { driver, repo } = await makeRepository();
    try {
      await repo.beginRecording({
        recordingId: 'rec_deleted1',
        createdAt: '2026-09-04T10:00:00.000Z',
        adapterId: 'simulator',
        provider: 'simulator',
        rawEnabled: false,
      });
      await repo.appendEvents('rec_deleted1', [makeEvent(0), makeEvent(1)]);
      await repo.deleteRecording('rec_deleted1');
      expect(await repo.loadRecording('rec_deleted1')).toMatchObject({
        ok: false,
        code: 'NOT_FOUND',
      });
      const counts = await driver.select<{ c: number }>(
        'SELECT COUNT(*) AS c FROM recording_events WHERE recording_id = ?',
        ['rec_deleted1'],
      );
      expect(counts[0]?.c).toBe(0);
    } finally {
      await driver.close();
    }
  });
});

describe('RecordingsRepository import/export', () => {
  it('imports a valid envelope and exports an equal one via parseRecording', async () => {
    const { driver, repo } = await makeRepository();
    try {
      const envelope = makeEnvelope('rec_import01', [makeEvent(0), makeEvent(1), makeEvent(2)]);
      const imported = await repo.importEnvelope(envelope);
      expect(imported).toEqual({ ok: true, recordingId: 'rec_import01' });

      const exported = await repo.exportEnvelope('rec_import01');
      expect(exported.ok).toBe(true);
      if (exported.ok) {
        expect(exported.recording).toEqual(envelope);
      }

      const stored = await driver.select<{
        status: string;
        content_hash: string;
        byte_size: number;
        event_count: number;
      }>(
        'SELECT status, content_hash, byte_size, event_count FROM recordings WHERE recording_id = ?',
        ['rec_import01'],
      );
      expect(stored[0]).toMatchObject({
        status: 'finalized',
        event_count: 3,
      });
      expect(stored[0]?.content_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(stored[0]?.byte_size).toBeGreaterThan(0);
    } finally {
      await driver.close();
    }
  });

  it('rejects oversize imports with TOO_LARGE before any insert', async () => {
    const { driver, repo } = await makeRepository();
    try {
      const bloated = {
        ...makeEnvelope('rec_toobig01', []),
        padding: 'x'.repeat(MAX_IMPORT_BYTES),
      };
      const result = await repo.importEnvelope(bloated);
      expect(result).toMatchObject({ ok: false, code: 'TOO_LARGE' });
      expect(await driver.select('SELECT recording_id FROM recordings')).toEqual([]);
    } finally {
      await driver.close();
    }
  });

  it('rejects single oversize events with TOO_LARGE without partial inserts', async () => {
    const { driver, repo } = await makeRepository();
    try {
      const bloatedEvent = {
        ...makeEvent(0),
        metadata: { blob: 'x'.repeat(MAX_EVENT_JSON_BYTES) },
      };
      const result = await repo.importEnvelope(
        makeEnvelope('rec_bigevent2', [makeEvent(1), bloatedEvent]),
      );
      expect(result).toMatchObject({ ok: false, code: 'TOO_LARGE' });
      expect(await driver.select('SELECT recording_id FROM recordings')).toEqual([]);
    } finally {
      await driver.close();
    }
  });

  it('rejects malformed imports with INVALID_ENVELOPE without partial inserts', async () => {
    const { driver, repo } = await makeRepository();
    try {
      const result = await repo.importEnvelope({ garbage: true, notA: 'recording' });
      expect(result).toMatchObject({ ok: false, code: 'INVALID_ENVELOPE' });
      expect(await driver.select('SELECT recording_id FROM recordings')).toEqual([]);
      expect(await driver.select('SELECT seq FROM recording_events')).toEqual([]);
    } finally {
      await driver.close();
    }
  });

  it('rejects unsupported envelope versions with UNSUPPORTED_VERSION', async () => {
    const { repo } = await makeRepository();
    const result = await repo.importEnvelope({
      ...makeEnvelope('rec_futurev02', []),
      formatVersion: 99,
    });
    expect(result).toMatchObject({ ok: false, code: 'UNSUPPORTED_VERSION' });
  });

  it('rejects imports with more than MAX_EVENTS_PER_RECORDING events with TOO_MANY_EVENTS', async () => {
    const { driver, repo } = await makeRepository();
    try {
      const result = await repo.importEnvelope({
        ...makeEnvelope('rec_toomany1', []),
        events: Array.from({ length: MAX_EVENTS_PER_RECORDING + 1 }, () => ({})),
      });
      expect(result).toMatchObject({ ok: false, code: 'TOO_MANY_EVENTS' });
      expect(await driver.select('SELECT recording_id FROM recordings')).toEqual([]);
    } finally {
      await driver.close();
    }
  });

  it('refuses to overwrite an existing recording id', async () => {
    const { repo } = await makeRepository();
    const envelope = makeEnvelope('rec_duplicated', [makeEvent(0)]);
    await expect(repo.importEnvelope(envelope)).resolves.toMatchObject({ ok: true });
    await expect(repo.importEnvelope(envelope)).rejects.toThrow(/already exists/i);
  });

  it('exportEnvelope refuses unknown recordings', async () => {
    const { repo } = await makeRepository();
    await expect(repo.exportEnvelope('rec_missing01')).rejects.toThrow(/not found/i);
  });
});

describe('exportEnvelope data-safety (review hardening)', () => {
  it('export fails with INVALID_ENVELOPE on corrupt rows instead of dropping them', async () => {
    const { driver, repo } = await makeRepository();
    try {
      await repo.beginRecording({
        recordingId: 'rec_corruptexp',
        createdAt: '2026-09-04T10:00:00.000Z',
        adapterId: 'simulator',
        provider: 'simulator',
        rawEnabled: false,
      });
      await repo.appendEvents('rec_corruptexp', [makeEvent(0), makeEvent(1), makeEvent(2)]);
      await driver.execute(
        "UPDATE recording_events SET event_json = '{not json' WHERE recording_id = ? AND seq = 1",
        ['rec_corruptexp'],
      );
      const exported = await repo.exportEnvelope('rec_corruptexp');
      expect(exported.ok).toBe(false);
      if (!exported.ok) {
        expect(exported.error.code).toBe('INVALID_ENVELOPE');
        expect(exported.error.message).toContain('corrupt');
      }
      // loadRecording still reports the corruption in a structured way.
      const loaded = await repo.loadRecording('rec_corruptexp');
      expect(loaded).toMatchObject({ ok: false, code: 'CORRUPT_EVENTS', corruptEventCount: 1 });
    } finally {
      await driver.close();
    }
  });
});
