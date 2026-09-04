import { describe, expect, it } from 'vitest';
import { PACK_ANIMATION_SLOTS, SEMANTIC_ACTIVITIES } from '@thenexus/contracts';
import type { SemanticActivity } from '@thenexus/contracts';
import { ACTIVITY_TO_SLOT, resolveSlotForIntent, slotForActivity } from './activity-map';

describe('ACTIVITY_TO_SLOT', () => {
  it('has an entry for every SemanticActivity value', () => {
    for (const activity of SEMANTIC_ACTIVITIES) {
      const slot = ACTIVITY_TO_SLOT[activity];
      expect(slot, `activity "${activity}" must map to an animation slot`).toBeDefined();
      expect(PACK_ANIMATION_SLOTS).toContain(slot);
    }
  });

  it('implements the canonical plan assignments', () => {
    expect(slotForActivity('idle')).toBe('idle');
    expect(slotForActivity('waiting-user')).toBe('idle');
    expect(slotForActivity('planning')).toBe('planning');
    expect(slotForActivity('reading')).toBe('researching');
    expect(slotForActivity('researching')).toBe('researching');
    for (const codingLike of ['coding', 'reviewing', 'version-control', 'building'] as const) {
      expect(slotForActivity(codingLike)).toBe('coding');
    }
    expect(slotForActivity('testing')).toBe('testing');
    for (const talkingLike of ['communicating', 'delegating', 'spawning-subagent'] as const) {
      expect(slotForActivity(talkingLike)).toBe('talking');
    }
    expect(slotForActivity('error')).toBe('error');
    expect(slotForActivity('completed')).toBe('celebrating');
  });

  it('keeps the table exhaustive at the type level too', () => {
    // Compile-time exhaustiveness: assigning the record to a full
    // SemanticActivity-keyed record only compiles when every key exists.
    const exhaustive: Readonly<Record<SemanticActivity, string>> = ACTIVITY_TO_SLOT;
    expect(Object.keys(exhaustive).length).toBe(SEMANTIC_ACTIVITIES.length);
  });
});

describe('resolveSlotForIntent', () => {
  it('falls back to idle for unknown intents', () => {
    expect(resolveSlotForIntent('dance-party')).toBe('idle');
    expect(resolveSlotForIntent('')).toBe('idle');
    expect(resolveSlotForIntent('SLEEPING-DEEP')).toBe('idle');
  });

  it('passes known pack slots through unchanged', () => {
    for (const slot of PACK_ANIMATION_SLOTS) {
      expect(resolveSlotForIntent(slot)).toBe(slot);
    }
  });

  it('maps semantic activities used as intents through the table', () => {
    expect(resolveSlotForIntent('version-control')).toBe('coding');
    expect(resolveSlotForIntent('waiting-user')).toBe('idle');
    expect(resolveSlotForIntent('spawning-subagent')).toBe('talking');
    expect(resolveSlotForIntent('completed')).toBe('celebrating');
  });
});
