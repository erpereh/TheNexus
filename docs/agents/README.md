# Agent Execution Documentation

This directory contains the operational material for autonomous development of TheNexus.

## ZCode / GLM run

1. [`zcode-runbook.md`](zcode-runbook.md) — human setup checklist for the ZCode workspace, GLM-5.3-Flash, Goal Mode and execution safety.
2. [`zcode-master-prompt.md`](zcode-master-prompt.md) — paste/send this to the primary ZCode Agent after setting the Goal.
3. [`../execution/acceptance-checklist.md`](../execution/acceptance-checklist.md) — evidence-based product completion contract used by Goal Mode.
4. [`../execution/progress.md`](../execution/progress.md) — durable progress/recovery ledger maintained by the autonomous coordinator.
5. [`../superpowers/plans/2026-09-03-bootstrap-core.md`](../superpowers/plans/2026-09-03-bootstrap-core.md) — first detailed implementation plan.

## Core principle

The primary ZCode Agent coordinates the work. Built-in `Explore` provides read-only research contexts; `general-purpose` handles bounded implementation/review tasks. The primary agent continues from plan to plan until the acceptance checklist is proven or the platform usage budget ends.

No autonomous agent may use real ZCode/OpenCode/Codex/Cursor/model execution to validate integrations. Harness work is fixture/simulator/contract-test based until the human owner performs explicit manual validation later.
