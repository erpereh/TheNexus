# TheNexus Autonomous Execution Ledger

This file is the durable recovery map for long-running autonomous work. Keep it concise and factual. Do not erase old entries; append new evidence and rulings.

## Current state

- Baseline spec: `docs/superpowers/specs/2026-09-03-the-nexus-design.md`
- Acceptance checklist: `docs/execution/acceptance-checklist.md`
- Current implementation plan: `docs/superpowers/plans/2026-09-03-bootstrap-core.md`
- Implementation status: not started
- Real-provider validation: forbidden for autonomous runs; manual only

## Rulings

Record decisions that resolve ambiguity without stopping the run:

```text
YYYY-MM-DD HH:MM — Ruling: <decision> — Reason: <why> — Cost if wrong: <rework/risk>
```

## Phase/task evidence

For every completed task append:

```text
### <phase/task>
Commit(s): <sha(s)>
Verification:
- `<command>` -> PASS/FAIL, key result
- `<command>` -> PASS/FAIL, key result
Visual QA: <what was inspected; screenshot/contact-sheet artifact if applicable>
Review: <reviewer role/context and findings>
Acceptance items checked: <IDs/headings>
Open concerns: <none or concrete items>
```

## Performance evidence

Append measured scenario, machine/context, FPS/frame-time, memory and event throughput. Never write `fast` or `good` without numbers.

## Final review

Do not populate until a fresh whole-repository reviewer has checked the completed branch against the canonical spec and acceptance checklist.
