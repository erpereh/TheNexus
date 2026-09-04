import { z } from 'zod';
import { SemanticActivitySchema } from './activity';

/**
 * Canonical normalized event envelope (schema version 1).
 *
 * Design requirements (docs/architecture/02-event-model-and-mapping.md):
 * - enough identity/ordering information to replay deterministically;
 * - provider-neutral: no provider names in core semantics;
 * - `metadata` retains JSON-safe provider-neutral diagnostics only.
 */
export const NORMALIZED_EVENT_SCHEMA_VERSION = 1;

export const NormalizedEventSchema = z.object({
  schemaVersion: z.literal(NORMALIZED_EVENT_SCHEMA_VERSION),
  eventId: z.string().min(1),
  workspaceId: z.string().min(1),
  sessionId: z.string().min(1),
  agentId: z.string().min(1),
  parentAgentId: z.string().min(1).nullable(),
  sequence: z.number().int().nonnegative(),
  occurredAt: z.iso.datetime(),
  kind: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/, 'event kind must be dotted'),
  activity: SemanticActivitySchema,
  source: z.object({
    adapterId: z.string().min(1),
    provider: z.string().min(1),
  }),
  metadata: z.record(z.string(), z.json()),
});

export type NormalizedEvent = z.infer<typeof NormalizedEventSchema>;

/**
 * Parse unknown input into a {@link NormalizedEvent}, throwing a descriptive
 * error when the input does not satisfy the canonical schema.
 */
export function parseNormalizedEvent(input: unknown): NormalizedEvent {
  const result = NormalizedEventSchema.safeParse(input);
  if (!result.success) {
    const summary = result.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid normalized event: ${summary}`);
  }
  return result.data;
}

/** Type-guard variant of {@link parseNormalizedEvent} that never throws. */
export function isNormalizedEvent(input: unknown): input is NormalizedEvent {
  return NormalizedEventSchema.safeParse(input).success;
}
