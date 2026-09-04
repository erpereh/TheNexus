import { PACK_ANIMATION_SLOTS, SEMANTIC_ACTIVITIES } from '@thenexus/contracts';
import type { PackAnimationSlot, SemanticActivity } from '@thenexus/contracts';

/**
 * Semantic activity -> animation slot table (plan Task 6).
 *
 * EVERY SemanticActivity value must have an entry; packs that do not author
 * a slot fall back to idle/walk at resolve time (see animation-state). This
 * table is presentation-neutral: themes restyle slots, never the mapping.
 */
export const ACTIVITY_TO_SLOT: Readonly<Record<SemanticActivity, PackAnimationSlot>> = {
  idle: 'idle',
  'waiting-user': 'idle',
  planning: 'planning',
  reading: 'researching',
  researching: 'researching',
  coding: 'coding',
  reviewing: 'coding',
  'version-control': 'coding',
  building: 'coding',
  testing: 'testing',
  communicating: 'talking',
  delegating: 'talking',
  'spawning-subagent': 'talking',
  error: 'error',
  completed: 'celebrating',
};

/** Slot for a canonical semantic activity. */
export function slotForActivity(activity: SemanticActivity): PackAnimationSlot {
  return ACTIVITY_TO_SLOT[activity];
}

/**
 * Resolves a free-form mapping-rule `animationIntent` to a canonical slot:
 * known pack slots pass through, known semantic activities map through
 * ACTIVITY_TO_SLOT, and anything else falls back to 'idle'. The 'walk' slot
 * applies automatically while a character is moving
 * (AnimationStateMachine), satisfying the canonical idle/walk fallback.
 */
export function resolveSlotForIntent(intent: string): PackAnimationSlot {
  if ((PACK_ANIMATION_SLOTS as readonly string[]).includes(intent)) {
    return intent as PackAnimationSlot;
  }
  if ((SEMANTIC_ACTIVITIES as readonly string[]).includes(intent)) {
    return ACTIVITY_TO_SLOT[intent as SemanticActivity];
  }
  return 'idle';
}
