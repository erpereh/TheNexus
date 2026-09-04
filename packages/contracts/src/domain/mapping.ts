import { z } from 'zod';
import type { NormalizedEvent } from '../events';
import { SemanticActivitySchema } from '../activity';
import { RoomTypeSchema, StationTypeSchema } from './semantics';
import { MappingRuleIdSchema } from './ids';

/**
 * A user-editable mapping rule translating a matched normalized event into
 * semantic world targets (docs/architecture/02-event-model-and-mapping.md).
 * Rules are evaluated deterministically; see `selectMappingRule`.
 */
export const MappingRuleSchema = z
  .object({
    id: MappingRuleIdSchema,
    enabled: z.boolean(),
    priority: z.number().int(),
    match: z.object({
      /** 'any' matches every semantic activity; otherwise a canonical value. */
      activity: z.union([z.literal('any'), SemanticActivitySchema]),
      kind: z.string().min(1).optional(),
      provider: z.string().min(1).optional(),
    }),
    overrideActivity: SemanticActivitySchema.optional(),
    preferredRoomType: RoomTypeSchema,
    preferredStationType: StationTypeSchema,
    /** Free-form intent; world engine resolves unknown intents to the
     * canonical slot fallback (idle/walk) so packs never break. */
    animationIntent: z.string().min(1),
    effectIntent: z.string().min(1).optional(),
    statusDisplay: z.enum(['always', 'overview', 'hidden']),
    allowFallback: z.boolean(),
  })
  .strict();

export type MappingRule = z.infer<typeof MappingRuleSchema>;

export function parseMappingRule(input: unknown): MappingRule {
  const result = MappingRuleSchema.safeParse(input);
  if (!result.success) {
    throw new Error(
      `Invalid mapping rule: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    );
  }
  return result.data;
}

export interface MappingConsideration {
  rule: MappingRule;
  matched: boolean;
  reason: string;
}

export interface MappingSelection {
  rule: MappingRule | null;
  /** Every candidate in deterministic evaluation order, with match verdicts. */
  considered: MappingConsideration[];
  /**
   * Matching rules that shared the winner's priority and lost only on the
   * id tie-break (empty when no tie occurred). Exposed for the Mapping
   * Debugger so tie-breaking is explainable, not hidden.
   */
  tiedRuleIds: readonly string[];
}

const activityMatches = (pattern: string, event: NormalizedEvent): boolean =>
  pattern === 'any' || pattern === event.activity;

/**
 * Deterministic rule selection: enabled + matching rules ordered by
 * priority DESC, then rule id ASC (documented tie-break); the first one
 * wins. All candidates are reported in `considered` so the Mapping
 * Debugger can explain the outcome without recomputing it.
 */
export function selectMappingRule(
  rules: readonly MappingRule[],
  event: NormalizedEvent,
): MappingSelection {
  const considered: MappingConsideration[] = rules.map((rule) => {
    if (!rule.enabled) {
      return { rule, matched: false, reason: 'disabled' };
    }
    if (!activityMatches(rule.match.activity, event)) {
      return {
        rule,
        matched: false,
        reason: `activity ${event.activity} != ${rule.match.activity}`,
      };
    }
    if (rule.match.kind !== undefined && rule.match.kind !== event.kind) {
      return {
        rule,
        matched: false,
        reason: `kind ${event.kind} != ${rule.match.kind}`,
      };
    }
    if (rule.match.provider !== undefined && rule.match.provider !== event.source.provider) {
      return {
        rule,
        matched: false,
        reason: `provider ${event.source.provider} != ${rule.match.provider}`,
      };
    }
    return { rule, matched: true, reason: 'match' };
  });

  const ordered = [...considered].sort((a, b) => {
    if (a.rule.priority !== b.rule.priority) {
      return b.rule.priority - a.rule.priority;
    }
    return a.rule.id < b.rule.id ? -1 : a.rule.id > b.rule.id ? 1 : 0;
  });

  const winner = ordered.find((entry) => entry.matched) ?? null;

  const tiedRuleIds =
    winner === null
      ? []
      : ordered
          .filter((entry) => entry.matched && entry.rule.priority === winner.rule.priority)
          .map((entry) => entry.rule.id)
          .filter((id) => id !== winner.rule.id);

  return {
    rule: winner?.rule ?? null,
    considered: ordered,
    tiedRuleIds,
  };
}
