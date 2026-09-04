import type { RecordingEnvelope } from '@thenexus/contracts';
import type { SemanticActivity } from '@thenexus/contracts';

export interface ReplayEntry {
  index: number;
  eventId: string;
  kind: string;
  activity: SemanticActivity;
  occurredAt: string;
  offsetMs: number;
  delayMs: number;
}

export interface ReplayTimeline {
  recordingId: string;
  entries: readonly ReplayEntry[];
  totalEvents: number;
  durationMs: number;
}

/**
 * Derives the playback timeline from a recording. The observed event order
 * is preserved exactly (parsing never reorders); delays are derived from
 * ISO timestamps with non-monotonic gaps clamped to zero so playback stays
 * deterministic for any recorded stream.
 */
export function buildReplayTimeline(
  recording: Pick<RecordingEnvelope, 'recordingId' | 'events'> &
    Partial<Pick<RecordingEnvelope, 'createdAt' | 'eventCount' | 'formatVersion' | 'generator'>>,
): ReplayTimeline {
  let previousOffsetMs = 0;
  const entries = recording.events.map((event, index): ReplayEntry => {
    const occurredMs = Date.parse(event.occurredAt);
    const first = recording.events[0];
    const baseMs = first !== undefined ? Date.parse(first.occurredAt) : Number.NaN;
    const offsetMs =
      index === 0 || Number.isNaN(occurredMs) || Number.isNaN(baseMs)
        ? 0
        : Math.max(0, occurredMs - baseMs);
    const delayMs = index === 0 ? 0 : Math.max(0, offsetMs - previousOffsetMs);
    previousOffsetMs = offsetMs;
    return {
      index,
      eventId: event.eventId,
      kind: event.kind,
      activity: event.activity,
      occurredAt: event.occurredAt,
      offsetMs,
      delayMs,
    };
  });
  return {
    recordingId: recording.recordingId,
    entries,
    totalEvents: entries.length,
    durationMs: entries.length > 0 ? (entries[entries.length - 1] as ReplayEntry).offsetMs : 0,
  };
}
