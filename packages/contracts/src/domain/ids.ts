import { z } from 'zod';

/**
 * Stable opaque IDs. Identity never derives from mutable names or absolute
 * filesystem paths (docs/architecture/04-storage-privacy-security.md), and
 * prefixes make persisted data human-auditable and validation strict.
 */
const prefixed = (prefix: string) =>
  z.string().regex(new RegExp(`^${prefix}[A-Za-z0-9_-]+$`), {
    message: `expected id with prefix "${prefix}"`,
  });

export const WorkspaceIdSchema = prefixed('ws_');
export const ShipIdSchema = prefixed('ship_');
export const RoomInstanceIdSchema = prefixed('room_');
export const StationInstanceIdSchema = prefixed('station_');
export const CharacterIdSchema = prefixed('char_');
export const GuestIdSchema = prefixed('guest_');
export const AssignmentIdSchema = prefixed('assign_');
export const MappingRuleIdSchema = prefixed('rule_');
export const RecordingIdSchema = prefixed('rec_');
export const BlueprintIdSchema = prefixed('bp_');
export const PackIdSchema = prefixed('pack_');
export const ThemeIdSchema = prefixed('theme_');
export const FolderIdSchema = prefixed('folder_');

export type WorkspaceId = z.infer<typeof WorkspaceIdSchema>;
export type ShipId = z.infer<typeof ShipIdSchema>;
export type RoomInstanceId = z.infer<typeof RoomInstanceIdSchema>;
export type StationInstanceId = z.infer<typeof StationInstanceIdSchema>;
export type CharacterId = z.infer<typeof CharacterIdSchema>;
export type GuestId = z.infer<typeof GuestIdSchema>;
export type AssignmentId = z.infer<typeof AssignmentIdSchema>;
export type MappingRuleId = z.infer<typeof MappingRuleIdSchema>;
export type RecordingId = z.infer<typeof RecordingIdSchema>;
export type BlueprintId = z.infer<typeof BlueprintIdSchema>;
export type PackId = z.infer<typeof PackIdSchema>;
export type ThemeId = z.infer<typeof ThemeIdSchema>;
export type FolderId = z.infer<typeof FolderIdSchema>;
