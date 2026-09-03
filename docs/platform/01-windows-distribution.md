# Windows Platform and Distribution

## Platform priority

TheNexus is Windows-first for v1. Architecture should remain portable, but implementation and QA decisions prioritize a high-quality Windows experience before macOS/Linux parity.

## Desktop shell

Tauri is the desktop shell. React + TypeScript owns application UI and PixiJS owns the world canvas.

Native capabilities likely needed:

- application data paths;
- tray/background behavior;
- file/folder pickers;
- notifications;
- launch-at-startup setting;
- filesystem watching/permissions;
- safe local bridge/process integrations where required;
- installer/update plumbing;
- logging/crash diagnostics.

## Background mode

The application may remain active in the system tray to observe authorized events/recordings.

Rules:

- hidden/minimized-to-tray world rendering should stop or heavily throttle;
- bridge/observation can remain active if the user enables background behavior;
- notifications may continue according to settings;
- exit must clearly stop bridge/background work;
- resource use while hidden should be measured.

## Launch at startup

Offer as a preference but keep disabled by default. Starting TheNexus must not automatically start or control external AI harnesses.

## Windows paths

Use platform APIs for app data/cache/documents rather than assuming drive letters or user folder names.

Workspace source paths remain external references. TheNexus should not move/copy source repositories unless the user explicitly uses an export/backup feature that says so.

## DPI and display testing

Validate representative combinations of:

- 100%, 125%, 150%, 200% scaling;
- 1080p;
- 1440p;
- 4K where available/automatable;
- windowed/full-screen/maximized states;
- multiple-monitor transitions where practical.

HUD scale and PixiJS resolution handling must remain consistent. Text should not become blurry because the world canvas and React UI use incompatible scaling assumptions.

## Installer

v1 should produce a normal Windows installer suitable for a public release path later.

Acceptance concerns:

- clean install;
- launch;
- app data creation;
- upgrade over previous development build;
- uninstall behavior documented;
- user-created local data not accidentally destroyed by routine uninstall/upgrade unless explicitly chosen.

## Portable build

Produce a portable artifact for developer/power-user use.

Portable behavior should still use a documented storage strategy. Do not silently assume that “portable executable” necessarily means all user data lives beside the executable unless explicitly implemented as a portable-data mode.

## Release automation

CI should eventually automate:

- dependency install;
- lint/typecheck;
- tests;
- desktop build;
- installer artifact;
- portable artifact;
- checksums/version metadata;
- artifact upload to CI.

Do not automatically publish a public release without an explicit release workflow decision.

## Auto-update

The architecture may prepare for a future updater. A mandatory functional auto-updater is not required in v1.

If later implemented, update signing/integrity and rollback/recovery deserve a dedicated design.

## Signing

Code signing may not be available during early development. Build tooling should keep signing configuration isolated so production signing can be introduced without redesigning packaging.

## Logging and diagnostics

Provide local structured logs with:

- levels;
- subsystem identifiers;
- adapter health/errors;
- renderer/runtime failures;
- migration/import failures;
- privacy-aware redaction.

A future “export diagnostics” action should produce a sanitized bundle without source code/raw secrets by default.

## Cross-platform readiness

Avoid Windows-specific assumptions in core packages. Windows-specific behavior belongs behind platform/native interfaces.

Portable packages such as event schema, mapping, crew simulation, replay, asset manifests and most world-engine logic should remain OS-agnostic.
