import { describe, expect, it } from 'vitest';
import {
  ADAPTER_CAPABILITIES,
  AdapterCapabilitiesSchema,
  HarnessAdapterDescriptorSchema,
  type AdapterCapabilities,
} from './index';

const allCapabilities = (value: boolean): AdapterCapabilities => ({
  observeSessions: value,
  observeAgents: value,
  observeToolCalls: value,
  observeFilesystemActivity: value,
  observeTokens: value,
  observeTasks: value,
  sendTask: value,
  sendMessage: value,
  cancelTask: value,
});

describe('AdapterCapabilitiesSchema', () => {
  it('requires every baseline capability as an explicit boolean', () => {
    expect(ADAPTER_CAPABILITIES).toEqual([
      'observeSessions',
      'observeAgents',
      'observeToolCalls',
      'observeFilesystemActivity',
      'observeTokens',
      'observeTasks',
      'sendTask',
      'sendMessage',
      'cancelTask',
    ]);
    expect(AdapterCapabilitiesSchema.parse(allCapabilities(true))).toEqual(allCapabilities(true));
  });

  it('does not silently treat missing flags as supported', () => {
    // Missing keys must fail parsing rather than defaulting to true/false-ish.
    const partial = { observeSessions: true };
    expect(() => AdapterCapabilitiesSchema.parse(partial)).toThrow();
  });

  it('rejects non-boolean capability values', () => {
    const bogus = { ...allCapabilities(false), observeTokens: 'yes' };
    expect(() => AdapterCapabilitiesSchema.parse(bogus)).toThrow();
  });

  it('rejects unknown capability keys (strict schema)', () => {
    const extra = { ...allCapabilities(false), deployToProduction: true };
    expect(() => AdapterCapabilitiesSchema.parse(extra)).toThrow();
  });
});

describe('HarnessAdapterDescriptor', () => {
  it('accepts an observation-only descriptor with control disabled', () => {
    const descriptor = HarnessAdapterDescriptorSchema.parse({
      id: 'simulator',
      displayName: 'Harness Simulator',
      capabilities: allCapabilities(false),
      experimental: false,
    });
    expect(descriptor.capabilities.sendTask).toBe(false);
    expect(descriptor.experimental).toBe(false);
  });

  it('rejects descriptors with missing or unknown fields', () => {
    const valid = {
      id: 'simulator',
      displayName: 'Harness Simulator',
      capabilities: allCapabilities(false),
      experimental: false,
    };
    expect(() => HarnessAdapterDescriptorSchema.parse({ ...valid, id: '' })).toThrow();
    expect(() => HarnessAdapterDescriptorSchema.parse({ ...valid, experimental: 'no' })).toThrow();
    expect(() => HarnessAdapterDescriptorSchema.parse({ ...valid, extraField: true })).toThrow();
  });

  it('keeps control capabilities distinct from observation capabilities', () => {
    const observationOnly = AdapterCapabilitiesSchema.parse({
      observeSessions: true,
      observeAgents: true,
      observeToolCalls: true,
      observeFilesystemActivity: false,
      observeTokens: false,
      observeTasks: true,
      sendTask: false,
      sendMessage: false,
      cancelTask: false,
    });
    expect(observationOnly.sendTask).toBe(false);
    expect(observationOnly.sendMessage).toBe(false);
    expect(observationOnly.cancelTask).toBe(false);
  });
});
