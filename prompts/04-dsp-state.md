# Milestone Prompt: DSP, State, and Presets

Implement Milestones 6 through 8 from `IMPLEMENTATION_PLAN.md`.

## Scope

Implement:

- User-owned DSP extension interface
- Parameter snapshot
- Generated smoothing helpers
- Deterministic gain or filter example
- State serialization
- Explicit state schema version
- Sequential state migrations
- UI-state separation
- Factory presets
- User presets
- Preset listing
- Preset loading
- Preset saving
- Preset deletion
- Preset dirty tracking
- Preset migration

## Real-time constraints

The normal audio processing path must not perform:

- Allocation
- Locking
- Logging
- File access
- JSON parsing
- WebView calls
- Blocking operations

## Required tests

- Deterministic DSP output
- Parameter smoothing
- Zero-sample blocks
- Sample-rate changes
- Buffer-size changes
- No NaNs or infinities under randomized input
- State round trip
- Sequential migration
- Newer-state rejection
- Preset round trip
- Factory preset protection
- Preset dirty state
- Editor rehydration after state restore

## Completion criteria

- The example DSP processes audio correctly.
- State restores parameters and plugin state.
- Old state migrates.
- Presets use the same state migration path.
- The editor reflects restored state.
- Real-time safety tests or instrumentation pass where implemented.

## Final report

Report DSP contract, serialization format, migrations, preset behavior, tests run, and acceptance tests passed.
