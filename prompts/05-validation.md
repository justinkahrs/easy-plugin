# Milestone Prompt: Transport, MIDI, Visualization, and Validation

Implement Milestones 9 and 11 from `IMPLEMENTATION_PLAN.md`.

## Scope

Implement:

- Optional host transport snapshots
- MIDI sample-offset preservation
- Meter accumulation
- Analyzer buffering
- Visualization subscriptions
- Visualization throttling
- Visualization cleanup on editor destruction
- VST3 validator integration
- Audio Unit validation on macOS
- Plugin loading smoke tests
- Editor lifecycle smoke tests
- State validation
- Automation validation
- Bus-layout validation
- Offline-render validation
- Sample-rate and block-size validation

## Constraints

- Host transport fields are optional.
- JavaScript timers must not drive DSP or MIDI.
- Visualization updates may be dropped.
- Parameter and state updates must remain reliable.
- No WebView calls may originate from the audio thread.
- Large analyzer data must avoid unbounded object graphs.

## Completion criteria

- MIDI offsets are preserved.
- Missing transport fields are safe.
- Meter events are throttled.
- Analyzer events can be dropped safely.
- Editor destruction stops visualization delivery.
- Release VST3 passes the configured validator.
- AU passes validation on macOS.
- Validation reports actionable failures.

## Final report

Report transport fields supported, visualization transport, validators run, host smoke tests, acceptance tests passed, and unresolved host-specific issues.
