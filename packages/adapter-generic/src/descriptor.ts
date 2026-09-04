import type { HarnessAdapterDescriptor } from '@thenexus/contracts';

/**
 * The Generic Adapter is a first-class integration (arch/03): provider
 * neutral, observation-only, control structurally disabled.
 */
export const GENERIC_ADAPTER_DESCRIPTOR: HarnessAdapterDescriptor = {
  id: 'generic',
  displayName: 'Generic Adapter',
  capabilities: {
    observeSessions: true,
    observeAgents: true,
    observeToolCalls: true,
    observeFilesystemActivity: false,
    observeTokens: false,
    observeTasks: true,
    sendTask: false,
    sendMessage: false,
    cancelTask: false,
  },
  experimental: false,
};
