import { z } from 'zod';
import { RoomTypeSchema, StationTypeSchema } from './semantics';
import { CharacterIdSchema, GuestIdSchema, PackIdSchema } from './ids';

/**
 * Personality scores influence only cosmetic/idle presentation. They are
 * plain numbers so ambient behavior stays deterministic and free of any
 * LLM/provider dependency by construction.
 */
export const PersonalityTraitsSchema = z.object({
  sociability: z.number().min(0).max(1),
  energy: z.number().min(0).max(1),
  curiosity: z.number().min(0).max(1),
  organization: z.number().min(0).max(1),
  nocturnality: z.number().min(0).max(1),
  celebratory: z.number().min(0).max(1),
  bookish: z.number().min(0).max(1),
});

export const CrewStatsSchema = z.object({
  tasksCompleted: z.number().int().nonnegative(),
  sessionsParticipated: z.number().int().nonnegative(),
  errorsRecoveredFrom: z.number().int().nonnegative(),
  subagentsAccompanied: z.number().int().nonnegative(),
});

export const CrewCharacterSchema = z
  .object({
    id: CharacterIdSchema,
    displayName: z.string().min(1),
    packId: PackIdSchema.nullable(),
    role: z.string().min(1).nullable(),
    specialties: z.array(z.string().min(1)),
    personality: PersonalityTraitsSchema,
    favoriteRoomTypes: z.array(RoomTypeSchema),
    favoriteStationTypes: z.array(StationTypeSchema),
    // Signed affinity: negative values encode rivalry/tension, which
    // game/02's "affinity score/history" permits. Range keeps it sane.
    affinity: z.record(CharacterIdSchema, z.number().int().min(-100).max(100)),
    stats: CrewStatsSchema,
    createdAt: z.iso.datetime(),
    lastActiveAt: z.iso.datetime().optional(),
  })
  .strict();

export type PersonalityTraits = z.infer<typeof PersonalityTraitsSchema>;
export type CrewStats = z.infer<typeof CrewStatsSchema>;
export type CrewCharacter = z.infer<typeof CrewCharacterSchema>;

export function parseCrewCharacter(input: unknown): CrewCharacter {
  const result = CrewCharacterSchema.safeParse(input);
  if (!result.success) {
    throw new Error(
      `Invalid crew character: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    );
  }
  return result.data;
}

/**
 * Guest Agents are temporary visual identities for observed subagents when
 * no persistent crew member is available. They are convertible to crew by
 * the user later (crew-simulation phase).
 */
export const GuestAgentSchema = z.object({
  id: GuestIdSchema,
  generatedFromPackId: PackIdSchema,
  createdFromAgentId: z.string().min(1),
  createdAt: z.iso.datetime(),
});

export type GuestAgent = z.infer<typeof GuestAgentSchema>;

export function isCrewCharacter(input: unknown): input is CrewCharacter {
  return CrewCharacterSchema.safeParse(input).success;
}
