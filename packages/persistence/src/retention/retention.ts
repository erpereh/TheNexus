import type { RecordingsRepository } from '../repositories/recordings-repository';

/** The subset of a recordings row retention decisions need. */
export interface RecordingRowView {
  recordingId: string;
  /** ISO timestamp; unparseable values are treated as oldest candidates. */
  createdAt: string;
  byteSize: number;
  /** Non-null means pinned; pinned recordings are never deleted. */
  pinnedAt: string | null;
}

export interface RetentionSettings {
  enabled: boolean;
  maxAgeDays: number;
  maxUnpinnedRecordings: number;
  maxTotalBytes: number;
}

export interface RetentionPlan {
  deleteRecordingIds: readonly string[];
  /**
   * Always empty in v1: raw provider payloads are deliberately not persisted
   * by this layer (envelopes carry normalized events only), so there is
   * nothing to prune yet. The field exists so retention policy can grow
   * raw-purge support without breaking callers.
   */
  pruneRawIds: readonly string[];
}

const EMPTY_PLAN: RetentionPlan = { deleteRecordingIds: [], pruneRawIds: [] };
const DAY_MS = 86_400_000;

function createdAtMs(row: RecordingRowView): number {
  const parsed = Date.parse(row.createdAt);
  // Unparseable timestamps are treated as epoch (oldest) so corrupt metadata
  // cannot pin garbage rows out of reach of retention forever.
  return Number.isNaN(parsed) ? 0 : parsed;
}

function byAgeThenId(a: RecordingRowView, b: RecordingRowView): number {
  return (
    createdAtMs(a) - createdAtMs(b) ||
    (a.recordingId < b.recordingId ? -1 : a.recordingId > b.recordingId ? 1 : 0)
  );
}

/**
 * Pure retention selector (docs/architecture/04-storage-privacy-security.md
 * "Retention model"). Builds the set of recordings to delete from the given
 * rows; the caller owns persistence via {@link applyRetention}.
 *
 * Rules, applied only to UNPINNED recordings (pinned rows are permanent):
 * - maxAgeDays: unpinned recordings created before `now - maxAgeDays` expire;
 * - maxUnpinnedRecordings: only the newest N unpinned recordings are kept;
 * - maxTotalBytes: oldest unpinned recordings are deleted until the total
 *   byte size (pinned included) fits the budget. If pinned data alone
 *   exceeds the budget, every unpinned recording is scheduled — the budget
 *   cannot be restored without touching pinned data, which never happens.
 *
 * Deterministic: `deleteRecordingIds` is ordered oldest-first with
 * recordingId as tiebreak; a row failing several rules appears once.
 */
export function selectExpiredRecordings(
  rows: readonly RecordingRowView[],
  settings: RetentionSettings,
  now: string,
): RetentionPlan {
  if (!settings.enabled) {
    return EMPTY_PLAN;
  }
  const nowMs = Date.parse(now);
  if (Number.isNaN(nowMs)) {
    throw new Error(
      `selectExpiredRecordings: "now" is not a valid timestamp: ${JSON.stringify(now)}`,
    );
  }

  const expired = new Set<string>();
  const unpinned = rows.filter((row) => row.pinnedAt === null).sort(byAgeThenId);

  // Rule 1: age.
  const ageCutoffMs = nowMs - settings.maxAgeDays * DAY_MS;
  for (const row of unpinned) {
    if (createdAtMs(row) < ageCutoffMs) {
      expired.add(row.recordingId);
    }
  }

  // Rule 2: count of unpinned recordings (newest N are kept).
  const excess = unpinned.length - Math.max(0, settings.maxUnpinnedRecordings);
  for (let index = 0; index < excess; index++) {
    const row = unpinned[index];
    if (row !== undefined) {
      expired.add(row.recordingId);
    }
  }

  // Rule 3: total byte budget, oldest unpinned first.
  let totalBytes = rows.reduce((sum, row) => sum + Math.max(0, row.byteSize), 0);
  for (const row of unpinned) {
    if (totalBytes <= settings.maxTotalBytes) {
      break;
    }
    if (!expired.has(row.recordingId)) {
      expired.add(row.recordingId);
    }
    totalBytes -= Math.max(0, row.byteSize);
  }

  // unpinned is already sorted oldest-first, so the plan order is stable.
  const deleteRecordingIds = unpinned
    .filter((row) => expired.has(row.recordingId))
    .map((row) => row.recordingId);

  return { deleteRecordingIds, pruneRawIds: [] };
}

/**
 * Executes a {@link RetentionPlan} through the repository. Deleting a
 * recording cascades its normalized event rows (schema 001 FK). Returns the
 * number of recordings actually deleted. Raw pruning is a no-op in v1 (see
 * {@link RetentionPlan.pruneRawIds}).
 */
export async function applyRetention(
  repository: Pick<RecordingsRepository, 'deleteRecording'>,
  plan: RetentionPlan,
): Promise<number> {
  let deleted = 0;
  for (const recordingId of plan.deleteRecordingIds) {
    await repository.deleteRecording(recordingId);
    deleted += 1;
  }
  return deleted;
}
