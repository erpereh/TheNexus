import { z } from 'zod';
import { FolderIdSchema, WorkspaceIdSchema } from './ids';

export const AuthorizedFolderSchema = z.object({
  folderId: FolderIdSchema,
  /** Real local path at authorization time; excluded from exports. */
  path: z.string().min(1),
  displayName: z.string().min(1),
});

export const WorkspaceSchema = z.object({
  id: WorkspaceIdSchema,
  name: z.string().min(1),
  /** Only explicitly authorized folders; never a whole-disk scan. */
  folders: z.array(AuthorizedFolderSchema).min(1),
  isDemo: z.boolean(),
  createdAt: z.iso.datetime(),
});

export type AuthorizedFolder = z.infer<typeof AuthorizedFolderSchema>;
export type Workspace = z.infer<typeof WorkspaceSchema>;

export function parseWorkspace(input: unknown): Workspace {
  const result = WorkspaceSchema.safeParse(input);
  if (!result.success) {
    throw new Error(
      `Invalid workspace: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    );
  }
  return result.data;
}

export function isWorkspace(input: unknown): input is Workspace {
  return WorkspaceSchema.safeParse(input).success;
}
