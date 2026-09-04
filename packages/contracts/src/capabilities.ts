import { z } from 'zod';

/**
 * Baseline adapter capability flags.
 *
 * Capability truthfulness rule: an adapter declares exactly what it can do.
 * Every flag is a required explicit boolean — absence is an error, never an
 * implicit default — so the UI can never fabricate unsupported data or actions.
 */
export const ADAPTER_CAPABILITIES = [
  'observeSessions',
  'observeAgents',
  'observeToolCalls',
  'observeFilesystemActivity',
  'observeTokens',
  'observeTasks',
  'sendTask',
  'sendMessage',
  'cancelTask',
] as const;

export const AdapterCapabilitiesSchema = z
  .object({
    observeSessions: z.boolean(),
    observeAgents: z.boolean(),
    observeToolCalls: z.boolean(),
    observeFilesystemActivity: z.boolean(),
    observeTokens: z.boolean(),
    observeTasks: z.boolean(),
    sendTask: z.boolean(),
    sendMessage: z.boolean(),
    cancelTask: z.boolean(),
  })
  .strict();

export type AdapterCapabilities = z.infer<typeof AdapterCapabilitiesSchema>;

/**
 * Runtime-validated static declaration of one harness adapter.
 *
 * `experimental: true` marks adapters whose behavior may change;
 * experimental adapters never enable control capabilities by default in
 * the UI. The schema exists so adapter manifests/registrations can be
 * validated at runtime instead of trusted by type alone.
 */
export const HarnessAdapterDescriptorSchema = z
  .object({
    id: z.string().min(1),
    displayName: z.string().min(1),
    capabilities: AdapterCapabilitiesSchema,
    experimental: z.boolean(),
  })
  .strict();

export type HarnessAdapterDescriptor = z.infer<typeof HarnessAdapterDescriptorSchema>;
