# Manual Real-Harness Validation Checklist

**Status: NEVER EXECUTED by autonomous agents.** Autonomous development and testing in
TheNexus uses only the Harness Simulator, synthetic fixtures, mocks, contract tests and
replay (see `AGENTS.md` section 3 and `docs/architecture/03-harness-adapters.md`).

Real-provider validation is a human decision, performed outside autonomous runs, on a
machine and account the human owns. Each checklist below is a suggestion of what the
human owner may want to verify when they choose to connect a real harness. The adapter
parsers currently target documented synthetic fixture shapes; a human validating against
a real harness should first compare real captured (sanitized) samples against these
shapes and adjust the adapter mapping if they differ.

## Common safety rules for any manual validation

- Use only local, authorized project folders; never whole-disk sources.
- Do not paste secrets into any TheNexus diagnostic surface.
- Keep experimental control disabled during first validation.
- Record adapter health transitions observed during the session.

## Generic Adapter

- [ ] Feed a real JSONL event file from the user's harness (if it emits comparable
      events) and confirm lines map to normalized events; unknown activities are
      rejected per-line without breaking the stream.

## ZCode Adapter

- [ ] Compare real ZCode session/agent/tool observations against the synthetic fixture
      shape in `packages/adapter-zcode/src/zcode-adapter.ts`; adjust mapping if needed.
- [ ] Verify subagent parent links appear correctly in the world.
- [ ] Confirm no ZCode task is started, prompted or cancelled by TheNexus.

## OpenCode Adapter

- [ ] Compare real OpenCode session state transitions against the synthetic
      running/waiting/error/done fixture shape; adjust mapping if needed.
- [ ] Confirm waiting-for-user is surfaced as Needs Input in the UI.

## Codex Adapter

- [ ] Compare real Codex task lifecycle events against the synthetic started/completed/
      failed fixture shape; adjust mapping if needed.
- [ ] Confirm task ids survive into the Mapping Debugger metadata.

## Cursor Adapter

- [ ] Compare real Cursor session/agent observations against the synthetic fixture
      shape; adjust mapping if needed.
- [ ] Confirm session ids are treated as opaque and never logged raw.

## All adapters

- [ ] Capability declarations match what the real source actually provides; the UI
      shows unsupported capabilities as unavailable (never fabricated).
- [ ] Disconnecting/reconnecting the source shows health transitions.
- [ ] Performance is acceptable with the user's real session volume.
