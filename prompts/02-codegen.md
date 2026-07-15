# Milestone Prompt: Schema and Code Generation

Implement Milestones 2 and 3 from `IMPLEMENTATION_PLAN.md`.

Read all specification files before changing code.

## Scope

Implement:

- YAML parsing
- Manifest schema model
- Field validation
- Compatibility checks
- Deterministic code generation
- Generated plugin metadata
- Generated C++ parameter identifiers
- Generated APVTS parameter layout
- Generated TypeScript parameter metadata
- Generated Svelte parameter metadata
- Generated bus-layout declarations
- Generated CMake metadata
- Generated-file ownership headers

## Required validation

Add tests for:

- Duplicate parameter IDs
- Invalid defaults
- Invalid choice defaults
- Invalid logarithmic ranges
- Invalid smoothing
- Invalid plugin identity codes
- Invalid format and platform combinations
- Invalid bus definitions
- State and parameter ID collisions
- Incompatible parameter ID changes
- Incompatible parameter type changes
- Deterministic generated output

## Constraints

- Generated files must be reproducible.
- Generated files must not contain user-authored code.
- User-owned files must not be modified.
- Parameter IDs must remain stable.
- C++ and TypeScript identifiers must match.
- Error messages must identify the relevant manifest path.
- Do not implement DSP or parameter bridge behavior yet.

## Completion criteria

- `plugin generate` succeeds for `plugin.example.yaml`.
- Running generation twice produces byte-identical files.
- All schema and generator tests pass.
- Generated C++ compiles in the existing native target.
- Generated TypeScript type-checks in the frontend.
- Compatibility checks reject breaking parameter changes.

## Final report

Report generated files, validation coverage, commands run, test results, acceptance tests passed, and known limitations.
