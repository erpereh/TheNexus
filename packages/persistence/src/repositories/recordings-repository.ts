import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import {
  isNormalizedEvent,
  NORMALIZED_EVENT_SCHEMA_VERSION,
  parseRecording,
  RECORDING_FORMAT_VERSION,
  type NormalizedEvent,
  type RecordingEnvelope,
  type RecordingParseResult,
  type RecordingSummary,
} from '@thenexus/contracts';
import type { DatabaseDriver, SqlParam } from '../driver/database-driver';

/** Hard ceiling on events stored per recording (retention/backstop against runaway sessions). */
export const MAX_EVENTS_PER_RECORDING = 250_000;
/** Hard ceiling on the serialized JSON size of a single event row (256 KiB). */
export const MAX_EVENT_JSON_BYTES = 262_144;
/** Hard ceiling on the serialized JSON size of an imported envelope (64 MiB). */
export const MAX_IMPORT_BYTES = 67_108_864;

export interface RecordingMeta {
  recordingId: string;
  createdAt: string;
  workspaceId?: string;
  adapterId: string;
  provider: string;
  rawEnabled: boolean;
}

export type RecordingLoadResult =
  | { ok: true; recording: RecordingEnvelope }
  | {
      ok: false;
      code: 'NOT_FOUND' | 'UNSUPPORTED_VERSION' | 'INVALID_ENVELOPE' | 'CORRUPT_EVENTS';
      message: string;
      corruptEventCount?: number;
    };

export interface RecordingsRepository {
  beginRecording(meta: RecordingMeta): Promise<void>;
  appendEvents(recordingId: string, events: readonly NormalizedEvent[]): Promise<void>;
  finalizeRecording(recordingId: string, contentHash: string, byteSize: number): Promise<void>;
  loadRecording(recordingId: string): Promise<RecordingLoadResult>;
  listRecordings(filter: {
    workspaceId?: string;
    pinnedOnly?: boolean;
  }): Promise<readonly RecordingSummary[]>;
  setPinned(recordingId: string, pinned: boolean): Promise<void>;
  deleteRecording(recordingId: string): Promise<void>;
  exportEnvelope(recordingId: string): Promise<RecordingParseResult>;
  importEnvelope(input: unknown): Promise<
    | { ok: true; recordingId: string }
    | {
        ok: false;
        code: 'UNSUPPORTED_VERSION' | 'INVALID_ENVELOPE' | 'TOO_LARGE' | 'TOO_MANY_EVENTS';
        message: string;
      }
  >;
}

// Type alias (not interface): object types carry implicit index signatures, so
// this satisfies the driver's DatabaseRow constraint without repetition.
type RecordingMetaRow = {
  recording_id: string;
  created_at: string;
  workspace_id: string | null;
  adapter_id: string;
  provider: string;
};

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Safe short description of an arbitrary rejected candidate value. */
function describeCandidate(value: unknown): string {
  try {
    return JSON.stringify(value)?.slice(0, 120) ?? String(value);
  } catch {
    return String(value);
  }
}

function jsonByteLength(json: string): number {
  return Buffer.byteLength(json, 'utf8');
}

function sha256Hex(json: string): string {
  return createHash('sha256').update(json, 'utf8').digest('hex');
}

/**
 * Local SQLite-backed recordings store (docs/superpowers/specs/
 * 2026-09-03-the-nexus-design.md §18). Events are stored as normalized-event
 * JSON rows keyed by (recording_id, seq); metadata lives on the recordings
 * row. Boundary rules:
 * - invalid NormalizedEvents are rejected on append (never persisted);
 * - loaded rows are re-validated individually: rows from unsupported event
 *   schema versions report UNSUPPORTED_VERSION, unreadable rows are skipped
 *   and reported via CORRUPT_EVENTS (load never throws on data corruption);
 * - imports are size-gated, schema-validated and inserted in ONE transaction
 *   (a rejected import leaves zero partial rows);
 * - unknown recording ids are refused loudly on mutating operations.
 */
export function createRecordingsRepository(driver: DatabaseDriver): RecordingsRepository {
  async function loadMetaRow(recordingId: string): Promise<RecordingMetaRow | null> {
    const rows = await driver.select<RecordingMetaRow>(
      `SELECT recording_id, created_at, workspace_id, adapter_id, provider
       FROM recordings WHERE recording_id = ?`,
      [recordingId],
    );
    return rows[0] ?? null;
  }

  return {
    async beginRecording(meta: RecordingMeta): Promise<void> {
      try {
        await driver.execute(
          `INSERT INTO recordings (
             recording_id, created_at, workspace_id, adapter_id, provider, status,
             pinned_at, last_opened_at, byte_size, content_hash, event_count, raw_enabled
           ) VALUES (?, ?, ?, ?, ?, 'open', NULL, NULL, 0, NULL, 0, ?)`,
          [
            meta.recordingId,
            meta.createdAt,
            meta.workspaceId ?? null,
            meta.adapterId,
            meta.provider,
            meta.rawEnabled ? 1 : 0,
          ],
        );
      } catch (error: unknown) {
        throw new Error(
          `beginRecording failed for "${meta.recordingId}": ${describeError(error)}`,
          { cause: error },
        );
      }
    },

    async appendEvents(recordingId: string, events: readonly NormalizedEvent[]): Promise<void> {
      if (events.length === 0) {
        return;
      }
      // Boundary validation and serialization happen before the transaction so
      // a rejected event can never produce partial inserts.
      for (const event of events) {
        if (!isNormalizedEvent(event)) {
          throw new Error(
            `appendEvents: recording "${recordingId}" received an invalid normalized event ` +
              `(candidate ${describeCandidate(event)}); events must satisfy the ` +
              'NormalizedEvent schema before persistence',
          );
        }
      }
      const serialized = events.map((event) => JSON.stringify(event));
      for (const [index, json] of serialized.entries()) {
        const event = events[index];
        if (json === undefined || event === undefined) {
          throw new Error(`appendEvents: internal serialization mismatch at index ${index}`);
        }
        const bytes = jsonByteLength(json);
        if (bytes > MAX_EVENT_JSON_BYTES) {
          throw new Error(
            `appendEvents: event "${event.eventId}" is ${bytes} bytes, exceeding ` +
              `MAX_EVENT_JSON_BYTES (${MAX_EVENT_JSON_BYTES})`,
          );
        }
      }

      try {
        await driver.transaction(async (tx) => {
          const metaRows = await tx.select<{ status: string; event_count: number | bigint }>(
            'SELECT status, event_count FROM recordings WHERE recording_id = ?',
            [recordingId],
          );
          const meta = metaRows[0];
          if (meta === undefined) {
            throw new Error(`appendEvents: recording not found: ${recordingId}`);
          }
          if (meta.status !== 'open') {
            throw new Error(
              `appendEvents: recording "${recordingId}" is finalized; new events cannot be appended`,
            );
          }
          const currentCount = Number(meta.event_count);
          if (currentCount + events.length > MAX_EVENTS_PER_RECORDING) {
            throw new Error(
              `appendEvents: recording "${recordingId}" would exceed MAX_EVENTS_PER_RECORDING ` +
                `(${MAX_EVENTS_PER_RECORDING}) with ${events.length} more events`,
            );
          }
          const seqRows = await tx.select<{ max_seq: number | bigint | null }>(
            'SELECT MAX(seq) AS max_seq FROM recording_events WHERE recording_id = ?',
            [recordingId],
          );
          const baseSeq =
            seqRows[0]?.max_seq !== null && seqRows[0]?.max_seq !== undefined
              ? Number(seqRows[0].max_seq) + 1
              : 0;
          for (const [index, json] of serialized.entries()) {
            await tx.execute(
              'INSERT INTO recording_events (recording_id, seq, event_json) VALUES (?, ?, ?)',
              [recordingId, baseSeq + index, json],
            );
          }
          const lastEvent = events[events.length - 1];
          await tx.execute(
            'UPDATE recordings SET event_count = event_count + ?, last_event_id = ? WHERE recording_id = ?',
            [events.length, lastEvent?.eventId ?? null, recordingId],
          );
        });
      } catch (error: unknown) {
        if (error instanceof Error && error.message.startsWith('appendEvents:')) {
          throw error;
        }
        throw new Error(
          `appendEvents failed for recording "${recordingId}": ${describeError(error)}`,
          { cause: error },
        );
      }
    },

    async finalizeRecording(
      recordingId: string,
      contentHash: string,
      byteSize: number,
    ): Promise<void> {
      try {
        const result = await driver.execute(
          "UPDATE recordings SET status = 'finalized', content_hash = ?, byte_size = ? WHERE recording_id = ?",
          [contentHash, byteSize, recordingId],
        );
        if (result.rowsAffected === 0) {
          throw new Error(`finalizeRecording: recording not found: ${recordingId}`);
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.message.startsWith('finalizeRecording:')) {
          throw error;
        }
        throw new Error(
          `finalizeRecording failed for recording "${recordingId}": ${describeError(error)}`,
          { cause: error },
        );
      }
    },

    async loadRecording(recordingId: string): Promise<RecordingLoadResult> {
      const meta = await loadMetaRow(recordingId);
      if (meta === null) {
        return { ok: false, code: 'NOT_FOUND', message: `recording not found: ${recordingId}` };
      }
      const assembled = await assembleEnvelope(driver, recordingId, meta, { strict: false });
      if (assembled.ok) {
        return { ok: true, recording: assembled.recording };
      }
      return assembled.code === 'INVALID_ENVELOPE' && assembled.corruptEventCount !== undefined
        ? {
            ok: false,
            code: 'CORRUPT_EVENTS',
            message: assembled.message,
            corruptEventCount: assembled.corruptEventCount,
          }
        : { ok: false, code: assembled.code, message: assembled.message };
    },

    async listRecordings(filter: {
      workspaceId?: string;
      pinnedOnly?: boolean;
    }): Promise<readonly RecordingSummary[]> {
      const conditions: string[] = [];
      const params: SqlParam[] = [];
      if (filter.workspaceId !== undefined) {
        conditions.push('workspace_id = ?');
        params.push(filter.workspaceId);
      }
      if (filter.pinnedOnly === true) {
        conditions.push('pinned_at IS NOT NULL');
      }
      const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
      const rows = await driver.select<{
        recording_id: string;
        created_at: string;
        workspace_id: string | null;
        adapter_id: string;
        provider: string;
        event_count: number | bigint;
      }>(
        `SELECT recording_id, created_at, workspace_id, adapter_id, provider, event_count
         FROM recordings${where} ORDER BY created_at ASC, recording_id ASC`,
        params,
      );
      return rows.map((row) => ({
        recordingId: row.recording_id,
        createdAt: row.created_at,
        eventCount: Number(row.event_count),
        generator: { adapterId: row.adapter_id, provider: row.provider },
        ...(row.workspace_id !== null ? { workspaceId: row.workspace_id } : {}),
      }));
    },

    async setPinned(recordingId: string, pinned: boolean): Promise<void> {
      try {
        const result = await driver.execute(
          'UPDATE recordings SET pinned_at = ? WHERE recording_id = ?',
          [pinned ? new Date().toISOString() : null, recordingId],
        );
        if (result.rowsAffected === 0) {
          throw new Error(`setPinned: recording not found: ${recordingId}`);
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.message.startsWith('setPinned:')) {
          throw error;
        }
        throw new Error(
          `setPinned failed for recording "${recordingId}": ${describeError(error)}`,
          { cause: error },
        );
      }
    },

    async deleteRecording(recordingId: string): Promise<void> {
      try {
        const result = await driver.execute('DELETE FROM recordings WHERE recording_id = ?', [
          recordingId,
        ]);
        if (result.rowsAffected === 0) {
          throw new Error(`deleteRecording: recording not found: ${recordingId}`);
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.message.startsWith('deleteRecording:')) {
          throw error;
        }
        throw new Error(
          `deleteRecording failed for recording "${recordingId}": ${describeError(error)}`,
          { cause: error },
        );
      }
    },

    async exportEnvelope(recordingId: string): Promise<RecordingParseResult> {
      const meta = await loadMetaRow(recordingId);
      if (meta === null) {
        // RecordingParseResult cannot express a missing recording; refusing
        // loudly beats returning a fabricated INVALID_ENVELOPE for data that
        // simply does not exist.
        throw new Error(`exportEnvelope: recording not found: ${recordingId}`);
      }
      const assembled = await assembleEnvelope(driver, recordingId, meta, { strict: true });
      if (!assembled.ok) {
        return {
          ok: false,
          error: {
            code:
              assembled.code === 'UNSUPPORTED_VERSION' ? 'UNSUPPORTED_VERSION' : 'INVALID_ENVELOPE',
            message: assembled.message,
          },
        };
      }
      return { ok: true, recording: assembled.recording };
    },

    async importEnvelope(input: unknown) {
      // Gate 1: total size. Serializing first also proves the input is
      // JSON-safe and gives us the byte size recorded with the import.
      let json: string;
      try {
        json = JSON.stringify(input) ?? '';
      } catch (error: unknown) {
        return {
          ok: false as const,
          code: 'INVALID_ENVELOPE' as const,
          message: `importEnvelope: input is not JSON-serializable: ${describeError(error)}`,
        };
      }
      const totalBytes = jsonByteLength(json);
      if (totalBytes > MAX_IMPORT_BYTES) {
        return {
          ok: false as const,
          code: 'TOO_LARGE' as const,
          message: `importEnvelope: input is ${totalBytes} bytes, exceeding MAX_IMPORT_BYTES (${MAX_IMPORT_BYTES})`,
        };
      }

      // Gate 2: event count checked on the raw input. Checking after
      // parseRecording would force full zod validation of 250k+ events just
      // to reject a count, so the raw array is inspected first (recorded ruling).
      const rawEvents =
        typeof input === 'object' && input !== null && 'events' in input
          ? (input as { events: unknown }).events
          : undefined;
      if (Array.isArray(rawEvents) && rawEvents.length > MAX_EVENTS_PER_RECORDING) {
        return {
          ok: false as const,
          code: 'TOO_MANY_EVENTS' as const,
          message: `importEnvelope: input carries ${rawEvents.length} events, exceeding MAX_EVENTS_PER_RECORDING (${MAX_EVENTS_PER_RECORDING})`,
        };
      }

      // Gate 3: full schema validation via the contract parser.
      const parsed = parseRecording(input);
      if (!parsed.ok) {
        return {
          ok: false as const,
          code: parsed.error.code,
          message: `importEnvelope: ${parsed.error.message}`,
        };
      }
      const envelope = parsed.recording;

      // Gate 4: per-event serialized size (256 KiB per row).
      const serializedEvents = envelope.events.map((event) => JSON.stringify(event));
      for (const [index, json] of serializedEvents.entries()) {
        const bytes = jsonByteLength(json);
        if (bytes > MAX_EVENT_JSON_BYTES) {
          return {
            ok: false as const,
            code: 'TOO_LARGE' as const,
            message: `importEnvelope: event at index ${index} (${envelope.events[index]?.eventId ?? 'unknown'}) is ${bytes} bytes, exceeding MAX_EVENT_JSON_BYTES (${MAX_EVENT_JSON_BYTES})`,
          };
        }
      }

      try {
        await driver.transaction(async (tx) => {
          await tx.execute(
            `INSERT INTO recordings (
               recording_id, created_at, workspace_id, adapter_id, provider, status,
               pinned_at, last_opened_at, byte_size, content_hash, event_count, raw_enabled
             ) VALUES (?, ?, ?, ?, ?, 'finalized', NULL, NULL, ?, ?, ?, 0)`,
            [
              envelope.recordingId,
              envelope.createdAt,
              envelope.workspaceId ?? null,
              envelope.generator.adapterId,
              envelope.generator.provider,
              totalBytes,
              sha256Hex(json),
              envelope.events.length,
            ],
          );
          for (const [seq, json] of serializedEvents.entries()) {
            await tx.execute(
              'INSERT INTO recording_events (recording_id, seq, event_json) VALUES (?, ?, ?)',
              [envelope.recordingId, seq, json],
            );
          }
          await tx.execute('UPDATE recordings SET last_event_id = ? WHERE recording_id = ?', [
            envelope.events[envelope.events.length - 1]?.eventId ?? null,
            envelope.recordingId,
          ]);
        });
      } catch (error: unknown) {
        const message = describeError(error);
        if (/unique constraint/i.test(message)) {
          throw new Error(
            `importEnvelope: a recording with id "${envelope.recordingId}" already exists`,
            { cause: error },
          );
        }
        throw new Error(
          `importEnvelope failed for recording "${envelope.recordingId}": ${message}`,
          { cause: error },
        );
      }
      return { ok: true as const, recordingId: envelope.recordingId };
    },
  };
}

/**
 * Reads all event rows and assembles a fully-validated envelope.
 *
 * - strict (export): any unreadable row is an error — exports must never
 *   silently drop data, so corruption maps to INVALID_ENVELOPE with a count
 *   in the message.
 * - non-strict (load): unreadable rows are skipped; the count is carried
 *   through `corruptEventCount` and surfaced as CORRUPT_EVENTS by loadRecording.
 * - rows claiming an unsupported event schemaVersion report UNSUPPORTED_VERSION
 *   in both modes (never silently reinterpreted).
 */
async function assembleEnvelope(
  driver: DatabaseDriver,
  recordingId: string,
  meta: RecordingMetaRow,
  options: { strict: boolean },
): Promise<
  | { ok: true; recording: RecordingEnvelope }
  | {
      ok: false;
      code: 'UNSUPPORTED_VERSION' | 'INVALID_ENVELOPE';
      message: string;
      corruptEventCount?: number;
    }
> {
  const rows = await driver.select<{ seq: number | bigint; event_json: string }>(
    'SELECT seq, event_json FROM recording_events WHERE recording_id = ? ORDER BY seq ASC',
    [recordingId],
  );
  const events: NormalizedEvent[] = [];
  let corruptCount = 0;
  for (const row of rows) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.event_json);
    } catch {
      corruptCount += 1;
      continue;
    }
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'schemaVersion' in parsed &&
      typeof parsed.schemaVersion === 'number' &&
      parsed.schemaVersion !== NORMALIZED_EVENT_SCHEMA_VERSION
    ) {
      return {
        ok: false,
        code: 'UNSUPPORTED_VERSION',
        message:
          `event at seq ${Number(row.seq)} of recording "${recordingId}" claims schemaVersion ` +
          `${parsed.schemaVersion}; this build supports ${NORMALIZED_EVENT_SCHEMA_VERSION}`,
      };
    }
    if (isNormalizedEvent(parsed)) {
      events.push(parsed);
    } else {
      corruptCount += 1;
    }
  }

  if (corruptCount > 0 && options.strict) {
    return {
      ok: false,
      code: 'INVALID_ENVELOPE',
      message:
        `recording "${recordingId}" contains ${corruptCount} corrupt event row(s); ` +
        'export refuses to drop data silently',
    };
  }
  if (corruptCount > 0) {
    return {
      ok: false,
      code: 'INVALID_ENVELOPE',
      message: `recording "${recordingId}" contains ${corruptCount} corrupt event row(s); they were skipped`,
      corruptEventCount: corruptCount,
    };
  }

  // Final contract-level re-validation keeps assembled envelopes honest even
  // if metadata rows were doctored directly in the database.
  const validated = parseRecording({
    formatVersion: RECORDING_FORMAT_VERSION,
    recordingId: meta.recording_id,
    createdAt: meta.created_at,
    ...(meta.workspace_id !== null ? { workspaceId: meta.workspace_id } : {}),
    generator: { adapterId: meta.adapter_id, provider: meta.provider },
    events,
    eventCount: events.length,
  });
  if (!validated.ok) {
    return { ok: false, code: validated.error.code, message: validated.error.message };
  }
  return { ok: true, recording: validated.recording };
}
