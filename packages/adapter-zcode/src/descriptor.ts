import type { HarnessAdapterDescriptor } from '@thenexus/contracts';

/**
 * Synthetic capability declaration for the ZCode Adapter. The parser
 * targets a documented SYNTHETIC fixture shape pending real-format
 * research; real-provider validation is a manual, human-only step and is
 * never executed autonomously. Observation-only: control capabilities are
 * structurally false.
 */
export const ZCODE_ADAPTER_DESCRIPTOR: HarnessAdapterDescriptor = {
  id: 'zcode',
  displayName: 'ZCode Adapter',
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
  experimental: true,
};
