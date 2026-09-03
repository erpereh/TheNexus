# Harness Adapters

## Goal

Support multiple AI coding harnesses without coupling TheNexus to any one vendor or execution model.

Initial targets:

- ZCode
- OpenCode
- Codex
- Cursor
- Generic Adapter

## Adapter responsibilities

An adapter may:

- detect an explicitly supported local installation/source;
- read authorized logs/session metadata/events;
- translate provider-specific observations into `NexusEvent` objects;
- declare its capability set;
- report adapter health/degradation;
- expose optional control operations only when supported and enabled.

An adapter must not:

- render world/UI state directly;
- invent unsupported metadata;
- autonomously submit real prompts;
- assume provider credentials may be used;
- mutate provider configuration merely because it was detected;
- scan unrelated project/user data.

## Capability negotiation

Each adapter declares a capability object. Exact naming can evolve, but the semantic shape should cover:

```ts
type AdapterCapabilities = {
  observeSessions: boolean;
  observeAgents: boolean;
  observeTasks: boolean;
  observeToolCalls: boolean;
  observeFilesystemActivity: boolean;
  observeGitActivity: boolean;
  observeUsage: boolean;
  sendTask: boolean;
  sendMessage: boolean;
  cancelTask: boolean;
};
```

Capabilities may be static or change at runtime if an integration source becomes available/unavailable.

The UI must use the declared capabilities. If an adapter cannot observe tokens, there is no fake token meter.

## Passive-first hierarchy

Prefer, in order, the safest and least invasive source that provides the needed fidelity:

1. documented local event/API source that can be read without submitting work;
2. documented session/log format;
3. explicit user-enabled hooks/plugins;
4. authorized filesystem/git observation;
5. coarse process/session detection;
6. Generic Adapter/manual event bridge.

Never escalate to more invasive observation automatically.

## Generic Adapter

The Generic Adapter is a first-class integration, not a fallback hack. It should make TheNexus useful with unknown/future harnesses.

Potential ingestion modes:

- local JSONL event file;
- stdin/stdout bridge;
- localhost WebSocket;
- localhost HTTP endpoint;
- user-supplied command/hook producing normalized events.

Generic inputs must still pass schema validation, authorization and rate/backpressure controls.

## Control path

Control interfaces can exist in the SDK from v1, but are disabled by default.

Requirements:

- per-adapter capability declaration;
- global experimental-control toggle;
- clear user-visible action before dispatch;
- audit log of requested control operations;
- safe timeout/error handling;
- no autonomous calls from personality/world simulation;
- no autonomous provider calls in tests.

## Development and test policy

Real provider/model execution is prohibited for autonomous implementation and testing.

Adapters are developed against:

- documentation/source-code research where legally/publicly accessible;
- synthetic fixtures;
- captured/sanitized examples explicitly supplied later by the user;
- mocks;
- Harness Simulator;
- contract-test suites.

A manual-validation checklist is produced for each adapter, but the user chooses if/when to run it against a real harness.

## Adapter contract tests

Every adapter must pass a shared conformance suite covering:

- lifecycle start/stop;
- authorization boundaries;
- capability reporting;
- event validation;
- stable IDs where possible;
- duplicate handling;
- missing/partial metadata;
- reconnect/restart behavior;
- malformed input;
- source disappearance;
- backpressure;
- sanitization/redaction interface;
- no accidental control dispatch.

## Adapter health states

Suggested states:

- `not_configured`
- `available`
- `observing`
- `degraded`
- `permission_required`
- `unsupported_version`
- `disconnected`
- `error`

These states are surfaced in Communications/Settings without making the entire application unhealthy.

## Version compatibility

Provider formats may change. Keep parser/version logic contained inside each adapter. The SDK should expose a diagnostic reason when the adapter does not understand a detected version.

Avoid brittle UI scraping when a more stable observable source exists. If UI scraping is ever introduced, it must be explicitly documented as fragile and isolated behind adapter tests.

## Security boundary

Adapters operate with least privilege. Authorization is per source/folder where practical. Do not send provider data over the network in v1. Treat logs and terminal output as potentially sensitive.
