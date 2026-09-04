import { describe, expect, it } from 'vitest';
import { NORMALIZED_EVENT_SCHEMA_VERSION, type NormalizedEvent } from '@thenexus/contracts';
import { openNodeSqlite } from '../driver/node-sqlite-driver';
import { runMigrations } from '../migrations/migrate';
import { createRecordingsRepository } from '../repositories/recordings-repository';
import {
  applyRetention,
  selectExpiredRecordings,
  type RecordingRowView,
  type RetentionSettings,
} from './retention';

const DAY_MS = 86_400_000;
const NOW = '2026-09-04T12:00:00.000Z';

const iso = (daysBeforeNow: number): string =>
  new Date(Date.parse(NOW) - daysBeforeNow * DAY_MS).toISOString();

function row(
  recordingId: string,
  createdAt: string,
  byteSize = 100,
  pinnedAt: string | null = null,
): RecordingRowView {
  return { recordingId, createdAt, byteSize, pinnedAt };
}

const ENABLED: RetentionSettings = {
  enabled: true,
  maxAgeDays: 30,
  maxUnpinnedRecordings: 1_000,
  maxTotalBytes: 1_000_000_000,
};

describe('selectExpiredRecordings', () => {
  it('returns an empty plan when retention is disabled', () => {
    const plan = selectExpiredRecordings(
      [row('rec_old_one01', iso(365))],
      { ...ENABLED, enabled: false },
      NOW,
    );
    expect(plan).toEqual({ deleteRecordingIds: [], pruneRawIds: [] });
  });

  it('honors maxAgeDays and never deletes pinned recordings', () => {
    const plan = selectExpiredRecordings(
      [
        row('rec_pinned01', iso(400), 100, iso(1)),
        row('rec_agedold1', iso(60)),
        row('rec_fresh001', iso(1)),
      ],
      { ...ENABLED, maxAgeDays: 30 },
      NOW,
    );
    expect(plan.deleteRecordingIds).toEqual(['rec_agedold1']);
  });

  it('honors maxUnpinnedRecordings by keeping the newest unpinned', () => {
    const plan = selectExpiredRecordings(
      [
        row('rec_oldest01', iso(50)),
        row('rec_oldtwo02', iso(40)),
        row('rec_oldthr03', iso(30)),
        row('rec_newfou04', iso(20)),
        row('rec_newfiv05', iso(10)),
        row('rec_pinned02', iso(500), 100, iso(1)),
      ],
      { ...ENABLED, maxUnpinnedRecordings: 2 },
      NOW,
    );
    expect(plan.deleteRecordingIds).toEqual(['rec_oldest01', 'rec_oldtwo02', 'rec_oldthr03']);
  });

  it('honors maxTotalBytes by deleting oldest unpinned until under budget', () => {
    const plan = selectExpiredRecordings(
      [
        row('rec_pinned03', iso(500), 900, iso(1)),
        row('rec_bigold01', iso(40), 500),
        row('rec_midold02', iso(30), 300),
        row('rec_small003', iso(20), 100),
      ],
      { ...ENABLED, maxTotalBytes: 1_000 },
      NOW,
    );
    // Total 1800 > 1000: drop oldest unpinned (500) -> 1300; drop next (300) -> 1000. Stop.
    expect(plan.deleteRecordingIds).toEqual(['rec_bigold01', 'rec_midold02']);
  });

  it('schedules all unpinned recordings when pinned data alone exceeds the budget', () => {
    const plan = selectExpiredRecordings(
      [
        row('rec_pinned04', iso(500), 1_500, iso(1)),
        row('rec_unpin001', iso(40), 50),
        row('rec_unpin002', iso(30), 50),
      ],
      { ...ENABLED, maxTotalBytes: 1_000 },
      NOW,
    );
    // Pinned bytes can never be freed; the budget cannot be restored, so the
    // rule still walks every unpinned recording oldest-first.
    expect(plan.deleteRecordingIds).toEqual(['rec_unpin001', 'rec_unpin002']);
  });

  it('lists a recording failing several rules exactly once', () => {
    const plan = selectExpiredRecordings(
      [row('rec_double01', iso(400), 900), row('rec_other001', iso(1), 10)],
      { ...ENABLED, maxAgeDays: 30, maxUnpinnedRecordings: 1, maxTotalBytes: 500 },
      NOW,
    );
    expect(plan.deleteRecordingIds).toEqual(['rec_double01']);
  });

  it('orders the plan deterministically oldest-first with id tiebreak', () => {
    const plan = selectExpiredRecordings(
      [
        row('rec_z_late001', iso(10), 100),
        row('rec_a_early1', iso(50), 100),
        row('rec_m_tied001', iso(10), 100),
      ],
      { ...ENABLED, maxUnpinnedRecordings: 1 },
      NOW,
    );
    // Newest 1 is kept; among the iso(10) tie the greater id
    // (rec_z_late001) wins, the deletions come out oldest-first.
    expect(plan.deleteRecordingIds).toEqual(['rec_a_early1', 'rec_m_tied001']);
  });

  it('treats rows with unparseable createdAt as oldest candidates', () => {
    const plan = selectExpiredRecordings(
      [row('rec_badtimest', 'not-a-timestamp'), row('rec_goodtime', iso(1))],
      { ...ENABLED, maxAgeDays: 30 },
      NOW,
    );
    expect(plan.deleteRecordingIds).toEqual(['rec_badtimest']);
  });

  it('rejects an invalid "now" timestamp with a descriptive error', () => {
    expect(() =>
      selectExpiredRecordings([row('rec_whatvr01', iso(1))], ENABLED, 'not-a-date'),
    ).toThrow(/now/i);
  });
});

describe('applyRetention', () => {
  it('deletes planned recordings via the repository and cascades their events', async () => {
    const driver = openNodeSqlite(':memory:');
    try {
      await runMigrations(driver);
      const repo = createRecordingsRepository(driver);
      const makeEvent = (id: string): NormalizedEvent => ({
        schemaVersion: NORMALIZED_EVENT_SCHEMA_VERSION,
        eventId: id,
        workspaceId: 'ws_demo',
        sessionId: 'sess_0001',
        agentId: 'agent_0001',
        parentAgentId: null,
        sequence: 0,
        occurredAt: NOW,
        kind: 'activity.changed',
        activity: 'coding',
        source: { adapterId: 'simulator', provider: 'simulator' },
        metadata: {},
      });
      await repo.beginRecording({
        recordingId: 'rec_doomed001',
        createdAt: iso(400),
        adapterId: 'simulator',
        provider: 'simulator',
        rawEnabled: false,
      });
      await repo.appendEvents('rec_doomed001', [makeEvent('evt_doomed01')]);
      await repo.beginRecording({
        recordingId: 'rec_survives1',
        createdAt: iso(1),
        adapterId: 'simulator',
        provider: 'simulator',
        rawEnabled: false,
      });
      await repo.appendEvents('rec_survives1', [makeEvent('evt_survive1')]);

      const deleted = await applyRetention(repo, {
        deleteRecordingIds: ['rec_doomed001'],
        pruneRawIds: [],
      });
      expect(deleted).toBe(1);
      expect(await repo.loadRecording('rec_doomed001')).toMatchObject({
        ok: false,
        code: 'NOT_FOUND',
      });
      const doomedEvents = await driver.select<{ c: number }>(
        'SELECT COUNT(*) AS c FROM recording_events WHERE recording_id = ?',
        ['rec_doomed001'],
      );
      expect(doomedEvents[0]?.c).toBe(0);
      const survivors = await repo.loadRecording('rec_survives1');
      expect(survivors.ok).toBe(true);
      if (survivors.ok) {
        expect(survivors.recording.events.map((event) => event.eventId)).toEqual(['evt_survive1']);
      }
    } finally {
      await driver.close();
    }
  });

  it('is a no-op for an empty plan and reports zero deletions', async () => {
    const driver = openNodeSqlite(':memory:');
    try {
      await runMigrations(driver);
      const repo = createRecordingsRepository(driver);
      await expect(applyRetention(repo, { deleteRecordingIds: [], pruneRawIds: [] })).resolves.toBe(
        0,
      );
    } finally {
      await driver.close();
    }
  });
});
