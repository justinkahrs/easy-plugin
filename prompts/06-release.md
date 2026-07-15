# Milestone Prompt: CLI, Packaging, CI, and Upgrades

Implement Milestones 10, 12, 13, and 14 from `IMPLEMENTATION_PLAN.md`.

## Scope

Implement:

```text
plugin create
plugin generate
plugin dev
plugin build
plugin test
plugin validate
plugin package
plugin doctor
plugin upgrade
```

Also implement:

- Windows x86_64 CI
- macOS arm64 CI
- macOS x86_64 CI
- Optional universal macOS build
- Artifact checksums
- Windows signing hooks
- macOS signing hooks
- macOS notarization hooks
- Installer extension points
- Builder and template version metadata
- Project upgrade planner
- User-file preservation
- Conflict reports
- Gain example
- Filter example
- Instrument example
- Development, architecture, validation, and release documentation

## Constraints

- Credentials must come only from CI secrets.
- User-owned files must never be overwritten.
- Generated and runtime files may be updated.
- Upgrade migrations must run sequentially.
- Packages must include only declared formats and required assets.
- Release builds must remain offline-capable.

## Completion criteria

- Every CLI command is implemented and documented.
- CI builds all declared targets.
- Local unsigned packaging succeeds.
- Signing and notarization hooks can be configured through secrets.
- Checksums are generated.
- `plugin doctor` reports actionable environment status.
- `plugin upgrade` preserves user code and reports conflicts.
- All three examples build and validate.

## Final report

Report commands implemented, CI matrix, packaging outputs, upgrade behavior, examples, tests, acceptance tests passed, and remaining release limitations.
