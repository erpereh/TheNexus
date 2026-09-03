# Storage, Privacy and Security

## Local-first posture

TheNexus v1 must be fully useful without an account, server or cloud backend. Structured application data is stored locally in SQLite; larger assets and recordings may live in application-managed directories.

Use the operating system's standard per-user application data location rather than hard-coding a literal path.

## Data classes

Suggested storage classes:

### Core structured data

- workspaces/projects;
- authorized folder references;
- ships/rooms/stations;
- crew/characters;
- assignments/history;
- mapping rules;
- adapter configuration/capabilities;
- settings;
- achievements/statistics;
- schema metadata.

### File-backed data

- character packs;
- portraits/sprite sheets/atlases;
- themes;
- blueprints;
- audio;
- recordings when too large for SQLite;
- exports/backups.

## Stable IDs

Use stable opaque IDs for entities such as workspace, ship, room, character, recording and mapping rule. Do not rely on mutable names or absolute filesystem paths as identity.

This is required for future cloud sync and portable exports.

## SQLite migrations

- Every schema change must be versioned.
- Migrations must be forward-tested from representative old schemas.
- Failed migrations must not silently destroy the previous database.
- Backups/recovery points should exist before risky migration steps.
- Migration logic must be covered by automated tests.

## Retention model

Normalized metadata/history may be retained long-term because it powers progression and replay metadata.

Raw/heavy data should have configurable retention. A reasonable default may be time-based, while users can pin important recordings permanently.

Retention must distinguish:

- normalized semantic event;
- raw provider payload;
- terminal/prompt/file content;
- rendered replay state/cache.

Deleting raw content should not unnecessarily destroy safe normalized history.

## Authorization

The default model is explicit authorization.

- Do not scan all user disks/projects.
- A workspace grants access only to selected folders/repos needed for that workspace.
- Harness detection and harness data authorization are distinct permissions.
- Optional hooks/control require separate explicit actions.
- Permission changes must be visible/revocable in settings.

## Sensitive content

Treat the following as potentially sensitive:

- prompts;
- source files;
- terminal output;
- environment variables;
- git remotes;
- paths/usernames;
- API keys/tokens/secrets;
- provider logs;
- private repository data.

Prefer categorical metadata such as `file_read`, `test_started` or `command_failed` when raw content is not required.

## Raw Event Data mode

Raw content visibility/persistence is opt-in.

When disabled:

- do not persist unnecessary raw prompts or file contents;
- minimize terminal text retained;
- store normalized activities and safe metadata;
- keep Mapping Debugger useful through IDs/categories rather than full sensitive payloads.

When enabled, the UI must explain what additional data may be stored locally.

## Redaction

Implement best-effort secret redaction before display/persistence of optional raw data. Candidate patterns include common API tokens, authorization headers, private-key blocks and environment-secret forms.

Redaction is a safety layer, not a guarantee. The UI/documentation must not claim it can identify every secret.

## No autonomous provider access

During autonomous development/testing:

- no real model calls;
- no provider login;
- no use of provider credentials;
- no real harness command dispatch;
- no modifications to provider settings.

Mocks, fixtures, simulator and replay are mandatory substitutes.

## Experimental harness control

If future control is enabled:

- global experimental control is off by default;
- adapter declares exact supported actions;
- user enables control explicitly;
- every control action originates from a direct user action or future separately approved automation feature;
- actions are auditable;
- failures/timeouts are visible;
- disabling control immediately prevents new dispatches.

## Import/export security

Imported packs/blueprints/themes/recordings are untrusted data.

Validation should cover:

- archive/path traversal;
- file-size/decompression limits;
- manifest/schema validation;
- unsupported executable content;
- unexpected symlinks;
- malformed images/audio;
- version compatibility.

Asset packages should be declarative. Do not execute scripts bundled inside community asset packs.

## Backups

Provide export/backup mechanisms for local worlds and user-created assets. Backup formats should avoid machine-specific absolute paths where possible and include format versions/checksums.

## Future cloud readiness

Future synchronization may be built around stable IDs and versioned records, but v1 architecture must not include hidden network upload behavior. Any cloud feature later added requires explicit user sign-in/consent and a separate privacy design review.
