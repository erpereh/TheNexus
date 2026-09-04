import { z } from 'zod';
import { NormalizedEventSchema } from '../events';
import { RecordingIdSchema, WorkspaceIdSchema } from './ids';

export const RECORDING_FORMAT_VERSION = 1;

/**
 * A recording preserves normalized events in observed order plus enough
 * metadata to reproduce the projection deterministically. Raw provider
 * payloads are deliberately NOT part of the envelope; retention of heavy
 * data is a separate, opt-in concern.
 */
export const RecordingEnvelopeSchema = z
  .object({
    formatVersion: z.literal(RECORDING_FORMAT_VERSION),
    recordingId: RecordingIdSchema,
    createdAt: z.iso.datetime(),
    workspaceId: WorkspaceIdSchema.optional(),
    generator: z.object({
      adapterId: z.string().min(1),
      provider: z.string().min(1),
    }),
    /** Observed order is significant; parsing never reorders. */
    events: z.array(NormalizedEventSchema),
    eventCount: z.number().int().nonnegative(),
  })
  .refine((recording) => recording.eventCount === recording.events.length, {
    message: 'eventCount must match events.length',
  });

export type RecordingEnvelope = z.infer<typeof RecordingEnvelopeSchema>;

export const RecordingSummarySchema = z.object({
  recordingId: RecordingIdSchema,
  createdAt: z.iso.datetime(),
  eventCount: z.number().int().nonnegative(),
  generator: z.object({
    adapterId: z.string().min(1),
    provider: z.string().min(1),
  }),
  workspaceId: z.string().min(1).optional(),
});

export type RecordingSummary = z.infer<typeof RecordingSummarySchema>;

export type RecordingParseResult =
  | { ok: true; recording: RecordingEnvelope }
  | {
      ok: false;
      error: {
        code: 'UNSUPPORTED_VERSION' | 'INVALID_ENVELOPE';
        message: string;
      };
    };

/**
 * Safe parser for recordings of unknown provenance/version. Unsupported
 * versions and garbage inputs produce structured errors — never throws —
 * so replay tooling can show a useful message instead of crashing.
 */
export function parseRecording(input: unknown): RecordingParseResult {
  const claimedVersion =
    typeof input === 'object' && input !== null && !Array.isArray(input)
      ? (input as { formatVersion?: unknown }).formatVersion
      : undefined;
  if (claimedVersion !== undefined && claimedVersion !== RECORDING_FORMAT_VERSION) {
    return {
      ok: false,
      error: {
        code: 'UNSUPPORTED_VERSION',
        message: `recording formatVersion must be ${RECORDING_FORMAT_VERSION}`,
      },
    };
  }
  const result = RecordingEnvelopeSchema.safeParse(input);
  if (!result.success) {
    return {
      ok: false,
      error: {
        code: 'INVALID_ENVELOPE',
        message: result.error.issues
          .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
          .join('; '),
      },
    };
  }
  return { ok: true, recording: result.data };
}

export function summarizeRecording(recording: RecordingEnvelope): RecordingSummary {
  return {
    recordingId: recording.recordingId,
    createdAt: recording.createdAt,
    eventCount: recording.events.length,
    generator: recording.generator,
    ...(recording.workspaceId !== undefined ? { workspaceId: recording.workspaceId } : {}),
  };
}
