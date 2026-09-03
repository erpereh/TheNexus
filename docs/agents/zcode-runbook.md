# ZCode / GLM-5.3-Flash Autonomous Runbook

This runbook is for the human owner preparing a long, unattended ZCode session for TheNexus.

## 1. Open the correct workspace

1. Clone/open `erpereh/TheNexus` as a **project workspace** in ZCode; do not use "Work outside a project".
2. Pull `main` and confirm `AGENTS.md` is visible at the workspace root. ZCode injects the workspace `AGENTS.md` into normal project tasks.
3. Create/select a dedicated implementation branch such as:

```text
agent/glm-autonomous-v1
```

Do not run the autonomous build directly on `main`.

## 2. Model and execution settings

Use the quota being intentionally consumed:

- Primary model: **GLM-5.3-Flash**.
- Built-in `general-purpose` subagent: set to **GLM-5.3-Flash** if ZCode exposes a dedicated model selector for it; otherwise let it inherit the primary model.
- Built-in `Explore`: set to **GLM-5.3-Flash** if configurable; otherwise inherit/default is acceptable.
- Do not select another paid/provider model for this run.

For unattended execution use **Full Access** only inside this dedicated project/branch and only after reviewing this repository's `AGENTS.md`. Full Access reduces confirmation interruptions; it does not override the project safety rules.

Do **not** use Plan execution mode for the long run because ZCode Goal Mode cannot run in Plan mode.

Keep ZCode's "Automatically continue questions" enabled if you want ordinary non-permission questions to time out and continue using the agent's judgment. Permission/security confirmations can still block; the master prompt tells the agent to avoid actions likely to require external/security approval.

## 3. Do not enable opaque extra state for this run

Project Memory is optional and not required. The durable source of truth is already versioned in the repo:

- `AGENTS.md`
- canonical design spec
- implementation plans
- `docs/execution/acceptance-checklist.md`
- `docs/execution/progress.md`

Using the progress ledger makes recovery after compaction/session interruption auditable.

## 4. Start Goal Mode

In a fresh ZCode task, first set this goal:

```text
/goal Implement TheNexus v1 until every autonomous-development requirement in docs/execution/acceptance-checklist.md is verified with fresh evidence, following AGENTS.md and the canonical design spec; continue through planning, implementation, testing, visual QA, review and hardening without using any real AI provider/harness execution.
```

Goal Mode automatically re-checks the objective after rounds and continues when the goal is not met. The acceptance checklist intentionally contains concrete evidence gates so "I implemented a lot" is not enough to finish.

## 5. Send the master prompt

Immediately after the goal is set, send the complete contents of:

```text
docs/agents/zcode-master-prompt.md
```

The prompt tells the primary ZCode Agent to act as coordinator, use built-in subagents, recover from the progress ledger, execute the bootstrap plan, create detailed plans for later phases, and keep iterating.

## 6. Recommended subagent usage

ZCode's built-in subagents are sufficient for the first run:

### `Explore`

Use heavily and in parallel for read-only tasks:

- inspect existing code before a phase;
- research official library/harness documentation;
- map package/API call chains;
- review likely risk areas;
- find untested paths.

### `general-purpose`

Use for bounded writable tasks and independent verification:

- implement one plan task;
- write focused tests;
- run verification;
- perform a fresh code review when instructed to remain read-only;
- perform a visual/UX review from screenshots/previews.

Subagents cannot recursively spawn other subagents; the **primary Agent is always the coordinator**.

Avoid parallel writable subagents touching the same files. Parallelize research/review freely; parallelize implementation only when package/file ownership is disjoint.

## 7. What the autonomous session is allowed to do

Allowed inside the project/worktree:

- create/edit code and documentation;
- install normal project dependencies from public package registries;
- run local tests/builds/linters/typecheckers;
- launch TheNexus local dev build and Harness Simulator;
- use local browser/preview inspection for visual QA;
- use public web documentation and public source repositories for research;
- create local Git branches/commits/worktrees needed for safe development;
- generate procedural/vector/local assets;
- use a ZCode-native image/asset-generation capability only if it is already included and requires no external account/key/credits beyond this ZCode run.

## 8. Absolute prohibitions for the unattended run

The primary agent and all subagents must not:

- launch a real task in ZCode as a provider being integrated;
- launch/run OpenCode, Codex or Cursor to test an adapter;
- send prompts/messages/tasks to those harnesses;
- call model/inference APIs directly;
- use or inspect API keys/provider credentials unnecessarily;
- sign into external services;
- purchase anything or consume external credits;
- modify ZCode/Cursor/Codex/OpenCode account/provider configuration;
- publish a release, merge to `main`, deploy publicly or push destructive changes without the human owner;
- scan unrelated user folders/drives;
- download/rip copyrighted game/anime sprite packs for redistribution.

Adapters are validated through simulator events, fixtures, parser/contract tests and public documentation only.

## 9. Expected autonomous rhythm

For each meaningful task:

```text
read exact task/spec
-> failing test
-> implement minimal correct behavior
-> focused tests
-> refactor
-> full relevant verification
-> fresh reviewer context
-> fix findings
-> re-verify
-> commit
-> ledger/checklist evidence
-> next task
```

For visual work:

```text
implement
-> run local preview
-> capture/inspect states at several viewport/zoom conditions
-> compare against art/UX docs
-> log concrete defects
-> fix
-> repeat screenshot/interaction inspection
```

After functional v1 completion:

```text
adversarial review
-> fuzz/property tests
-> stress 10/50/100/250 agents
-> performance profiling
-> visual regression
-> accessibility
-> import corruption tests
-> migration/replay determinism
-> refactor only when measurable
-> repeat
```

Do not add unrelated features merely to burn quota.

## 10. If the session is interrupted

Start/reopen the same project task and tell the agent:

```text
Resume from docs/execution/progress.md and docs/execution/acceptance-checklist.md. Trust git history and fresh verification over conversational memory. Continue the current incomplete plan/task; do not redo completed tasks unless verification shows a regression.
```

Goal Mode persists when a task is reopened; if it was paused, run `/goal resume`.

## 11. Human actions after the quota/run ends

Do not immediately merge the autonomous branch. First inspect:

1. `docs/execution/progress.md`;
2. remaining unchecked acceptance items;
3. Git history/diff;
4. final reviewer findings;
5. application screenshots/preview;
6. full local verification output.

Real ZCode/OpenCode/Codex/Cursor integration validation remains a separate manual step after code review.
