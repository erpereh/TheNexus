# Event Model and Activity Mapping

## Purpose

The normalized event model is the contract that decouples external harnesses from the game world. Provider-specific adapters translate observations into this schema. The rest of TheNexus must not depend on raw provider event shapes.

## Event envelope

A normalized event should carry enough identity and ordering information to be replayed and projected deterministically.

Illustrative shape:

```ts
type NexusEvent = {
  schemaVersion: number;
  eventId: string;
  timestamp: string;
  sequence?: number;
  source: {
    adapterId: string;
    harness: string;
    sourceInstanceId?: string;
  };
  workspaceId?: string;
  sessionId?: string;
  agentId?: string;
  parentAgentId?: string;
  taskId?: string;
  type: NexusEventType;
  payload: unknown;
  privacy: {
    containsRawContent: boolean;
    redacted: boolean;
  };
};
```

Exact TypeScript types are an implementation-plan concern, but the identities and versioning are design requirements.

## Minimum normalized event families

- session discovered/started/ended;
- agent created/started/ended;
- subagent spawned;
- task created/started/updated/completed/failed;
- activity changed;
- tool invocation started/finished/failed;
- file activity observed;
- command/build/test activity observed;
- research/documentation activity observed;
- message/delegation observed;
- waiting for user;
- error/warning;
- token/usage metadata when actually exposed;
- git/version-control activity;
- capability changed;
- adapter health changed.

Adapters may have richer provider-specific observations internally, but unsupported concepts should not be invented during normalization.

## Semantic activities

The world maps events into a smaller activity vocabulary. The canonical,
implemented taxonomy lives in `packages/contracts/src/activity.ts`
(`SemanticActivitySchema`):

```text
idle
planning
coding
reading
researching
testing
building
reviewing
version-control
communicating
delegating
waiting-user
error
completed
spawning-subagent
```

Activities may carry intensity/metadata without multiplying the core vocabulary unnecessarily.

## Mapping pipeline

```text
NexusEvent
  -> activity classifier/projector
  -> semantic ActivityState
  -> ordered mapping rules
  -> room semantic type
  -> compatible station type
  -> animation intent
  -> theme-resolved visual asset/effect
```

Provider name must not determine the room directly.

## Default semantic room types

Suggested baseline semantics:

- `command` — planning, orchestration, waiting for user;
- `engineering` — coding/editing/build work;
- `laboratory` — tests, diagnostics, verification;
- `library` — file/document reading;
- `observatory` — web/research/discovery;
- `communications` — messaging/delegation;
- `archive` — git/history/replay-related representations;
- `lounge` — idle/social behaviors;
- `generic_workstation` — universal fallback.

Themes resolve these semantics into names/art, e.g. `laboratory` -> Astral Laboratory in the default theme.

## Rule model

A user-editable rule should support:

- stable rule ID;
- enabled flag;
- priority;
- match predicates;
- semantic activity target/override;
- preferred room semantic type;
- preferred station semantic type;
- animation intent;
- effect intent;
- status-display preference;
- fallback behavior.

Rules are evaluated deterministically. Tie-breaking must be documented and tested.

## Fallback hierarchy

A mapping failure must never strand a character.

Recommended fallback:

1. exact preferred compatible station in preferred room;
2. any compatible station in preferred room;
3. nearest compatible semantic room;
4. nearest generic workstation;
5. safe idle marker/location while emitting a mapping diagnostic.

The world must remain valid even if the user deletes a room used by a mapping.

## Mapping Debugger

For every mapped activity, the debugger must expose:

- source adapter and event ID;
- normalized type;
- relevant safe metadata;
- classifier result;
- matched rule(s) and priority;
- selected semantic room;
- selected concrete room instance;
- selected station;
- selected animation/effect;
- fallback steps taken;
- unavailable capability/source data.

The debugger should support copying a sanitized diagnostic report for bug reports.

## Event ordering and concurrency

Events may arrive late, duplicate or out of order. The projection layer must define behavior for:

- duplicated event IDs;
- equal timestamps;
- optional sequence numbers;
- session restart/reconnect;
- child agent appearing before parent metadata;
- completion arriving after adapter disconnect;
- corrections/update events.

Recordings should preserve observed order plus enough metadata to reproduce the normalized projection deterministically.

## Privacy

The normalized model should favor categorical metadata over raw content. For example, a file-read activity can often be represented without persisting the file's contents.

Raw payloads, prompts or terminal text must be separable from the normalized event so retention/privacy policy can discard raw content without destroying replay of world activity.

## Testing requirements

Contract tests must cover:

- schema validation;
- malformed events;
- unknown future event types/version behavior;
- deterministic classification;
- rule priority;
- fallback selection;
- duplicate/out-of-order events;
- parent/subagent relationships;
- redaction flags;
- record/replay parity.
