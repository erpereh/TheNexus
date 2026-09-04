import { z } from 'zod';
import { AssignmentIdSchema, CharacterIdSchema, WorkspaceIdSchema } from './ids';

/**
 * A temporary binding between a persistent crew character and an observed
 * agent/session. Characters stay independent from harness/model/session;
 * releasing an assignment makes the character available again.
 */
export const AssignmentSchema = z
  .object({
    id: AssignmentIdSchema,
    characterId: CharacterIdSchema,
    workspaceId: WorkspaceIdSchema,
    sessionId: z.string().min(1),
    agentId: z.string().min(1),
    taskId: z.string().min(1).optional(),
    state: z.enum(['active', 'released']),
    startedAt: z.iso.datetime(),
    releasedAt: z.iso.datetime().optional(),
  })
  .strict()
  .refine((value) => value.state !== 'released' || value.releasedAt !== undefined, {
    message: 'released assignments require releasedAt',
  })
  .refine((value) => value.state !== 'active' || value.releasedAt === undefined, {
    message: 'active assignments must not carry releasedAt',
  });

export type Assignment = z.infer<typeof AssignmentSchema>;

export function parseAssignment(input: unknown): Assignment {
  const result = AssignmentSchema.safeParse(input);
  if (!result.success) {
    throw new Error(
      `Invalid assignment: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    );
  }
  return result.data;
}

export function isAssignment(input: unknown): input is Assignment {
  return AssignmentSchema.safeParse(input).success;
}
