import { z } from 'zod';
import { ShipIdSchema, WorkspaceIdSchema } from './ids';

/**
 * Metadata-level ship entity. A workspace maps to exactly one ship/station;
 * the full room topology lives with the editor domain (later phase) and is
 * not part of this metadata contract.
 */
export const ShipSchema = z.object({
  id: ShipIdSchema,
  workspaceId: WorkspaceIdSchema,
  name: z.string().min(1),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type Ship = z.infer<typeof ShipSchema>;
