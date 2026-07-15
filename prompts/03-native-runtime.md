# Milestone Prompt: Native Plugin Runtime and Bridge

Implement Milestones 4 and 5 from `IMPLEMENTATION_PLAN.md`.

## Scope

Implement:

- JUCE VST3 target
- JUCE Audio Unit target on macOS
- Standalone target integration
- Generated metadata integration
- Generated bus layouts
- APVTS parameter runtime
- JUCE WebView bridge
- Svelte bridge client
- Parameter stores
- Generated controls
- Begin, update, and end parameter gestures
- Host-to-frontend parameter synchronization
- State snapshot request and response
- Plugin instance isolation
- Editor lifecycle handling

## Constraints

- APVTS is authoritative.
- The frontend must not update DSP state directly.
- No bridge work may occur on the audio thread.
- The editor must be disposable.
- Audio processing must continue while the editor is closed.
- Every message must include protocol and instance identity.
- Multiple plugin instances must not share mutable state.
- Do not transfer audio buffers through the bridge.

## Required tests

- Plugin loading
- Editor creation
- Editor destruction and recreation
- Parameter enumeration
- UI-to-native parameter update
- Native-to-UI parameter update
- Gesture boundaries
- State snapshot initialization
- Unsupported protocol handling
- Multiple-instance isolation

## Completion criteria

- VST3 builds.
- AU builds on macOS.
- Standalone builds.
- The editor opens.
- Generated Svelte controls operate host-visible parameters.
- Host automation updates the Svelte controls.
- Closing and reopening the editor restores current state.
- Two plugin instances remain isolated.

## Final report

Report formats built, bridge messages implemented, lifecycle tests, acceptance tests passed, and remaining limitations.
