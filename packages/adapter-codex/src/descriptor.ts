import type { HarnessAdapterDescriptor } from '@thenexus/contracts';

/**
 * Synthetic capability declaration for the Codex Adapter. The parser
 * targets a documented SYNTHETIC fixture shape pending real-format
 * research; real-provider validation is a manual, human-only step.
 * Observation-only: control capabilities are structurally false.
 */
export const CODEX_ADAPTER_DESCRIPTOR: HarnessAdapterDescriptor = {
  id: 'codex',
  displayName: 'Codex Adapter',
  capabilities: {
    observeSessions: true,
    observeAgents: true,
    observeToolCalls: false,
    observeFilesystemActivity: false,
    observeTokens: false,
    observeTasks: true,
    sendTask: false,
    sendMessage: false,
    cancelTask: false,
  },
  experimental: true,
};
