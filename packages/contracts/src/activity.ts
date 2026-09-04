import { z } from 'zod';

/**
 * Provider-neutral semantic activity taxonomy.
 *
 * These values describe *what an observed agent is doing*, never which
 * provider, model or harness produced the observation. Themes and adapters
 * must not extend or reinterpret this vocabulary; new activities require a
 * schema-version bump of the event contract.
 */
export const SEMANTIC_ACTIVITIES = [
  'idle',
  'planning',
  'reading',
  'coding',
  'researching',
  'testing',
  'building',
  'reviewing',
  'version-control',
  'communicating',
  'delegating',
  'waiting-user',
  'error',
  'completed',
  'spawning-subagent',
] as const;

export const SemanticActivitySchema = z.enum(SEMANTIC_ACTIVITIES);

export type SemanticActivity = z.infer<typeof SemanticActivitySchema>;
