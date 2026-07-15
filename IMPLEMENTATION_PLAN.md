# Implementation Plan

## Strategy

Implement the system as a sequence of vertical milestones.

Each milestone must produce a working, testable result rather than isolated scaffolding.

Do not begin packaging, signing, or broad format support until the core vertical slice works end to end.

## Milestone 0: Repository foundation

### Goals

- Establish repository layout
- Pin toolchain versions
- Add JUCE
- Add SvelteKit
- Add CMake
- Add pnpm workspace
- Add initial CI skeleton
- Add documentation commands

### Deliverables

```text
audio-plugin-builder/
├── CMakeLists.txt
├── package.json
├── pnpm-workspace.yaml
├── builder/
├── runtime/
├── template/
├── examples/
├── tests/
└── .github/workflows/
```

### Required outcomes

- CMake configures
- Frontend dependencies install
- Native smoke target builds
- Frontend test runs
- CI executes a placeholder build on at least one platform

## Milestone 1: Standalone WebView vertical slice

### Goals

- Create a JUCE standalone target
- Add `WebBrowserComponent`
- Load Vite development server in debug mode
- Load embedded static assets in release mode
- Add browser mock mode

### Deliverables

- Minimal SvelteKit screen
- Native editor window
- Development URL switching
- Embedded resource provider
- Frontend mock bridge

### Required outcomes

- Standalone target launches
- Development hot reload works
- Release mode works offline
- Release binary contains no development URL dependency

## Milestone 2: Manifest schema and validation

### Goals

- Define the manifest schema
- Parse YAML
- Validate identity, formats, buses, parameters, state, UI, and build fields
- Produce actionable errors

### Deliverables

- Schema model
- Validation pipeline
- Error formatter
- Compatibility snapshot format
- Unit tests

### Required outcomes

- Valid example manifest passes
- Invalid manifests fail with field-specific errors
- Validation is deterministic

## Milestone 3: Deterministic code generation

### Goals

- Generate plugin metadata
- Generate parameter IDs
- Generate APVTS layout
- Generate TypeScript parameter metadata
- Generate bus layout code
- Generate default Svelte controls
- Generate CMake metadata

### Deliverables

```text
generated/
├── PluginMetadata.generated.h
├── Parameters.generated.h
├── Parameters.generated.cpp
├── ParameterMetadata.generated.ts
├── BridgeTypes.generated.ts
├── BusLayouts.generated.cpp
└── PluginMetadata.generated.cmake
```

### Required outcomes

- Repeated generation is byte-identical
- C++ and TypeScript IDs match
- User-owned files are untouched
- Generated files compile

## Milestone 4: JUCE plugin target

### Goals

- Add `juce_add_plugin`
- Build VST3 and standalone formats
- Add Audio Unit on macOS
- Wire generated metadata
- Wire bus layouts
- Add empty user-owned DSP class

### Deliverables

- `PluginProcessor`
- `PluginEditor`
- `DspProcessor`
- CMake plugin target
- Basic format validation configuration

### Required outcomes

- VST3 builds
- Standalone builds
- AU builds on macOS
- Plugin loads in validator or test host
- Editor opens

## Milestone 5: Parameter runtime and bridge

### Goals

- Use APVTS as authoritative parameter layer
- Add generated parameter layout
- Add begin, update, and end gestures
- Synchronize host changes to frontend
- Request and deliver state snapshots
- Enforce instance isolation

### Deliverables

- Native parameter service
- Native bridge dispatcher
- Frontend bridge client
- Svelte parameter stores
- Generated controls

### Required outcomes

- UI changes host-visible parameters
- Host automation updates UI
- Gesture boundaries are correct
- Editor recreation restores values
- Multiple instances remain isolated

## Milestone 6: DSP example and smoothing

### Goals

- Add user-owned DSP interface
- Generate smoothing helpers
- Add deterministic gain or filter example
- Add DSP tests
- Add real-time safety checks where practical

### Deliverables

- `DspProcessor`
- Parameter snapshot
- Smoothed parameter utilities
- Native DSP test target
- Randomized safety tests

### Required outcomes

- DSP produces expected output
- Smoothing works
- No NaNs or infinities
- Zero-sample blocks work
- Sample-rate and buffer-size changes work
- No normal-path allocations after preparation

## Milestone 7: State and migration

### Goals

- Serialize host parameters and plugin state
- Add explicit state schema version
- Add sequential migration registry
- Add preset-compatible state format
- Separate UI state

### Deliverables

- State serializer
- State parser
- Migration registry
- Migration test fixtures
- State snapshot bridge events

### Required outcomes

- State round trip works
- Old state migrates
- Newer unsupported state fails safely
- Editor state rehydrates
- UI-only state is not required for DSP restoration

## Milestone 8: Presets

### Goals

- Add factory and user presets
- Add list, load, save, and delete commands
- Add dirty-state tracking
- Reuse state migration
- Add preset browser example

### Deliverables

- Native preset service
- Preset bridge commands
- Svelte preset store and browser
- Example factory presets

### Required outcomes

- Presets round-trip
- Factory presets are protected
- Old presets migrate
- Dirty state updates correctly

## Milestone 9: Transport, MIDI, and visualization

### Goals

- Add optional host transport snapshot
- Preserve MIDI sample offsets
- Add meter pipeline
- Add analyzer pipeline
- Throttle bridge updates
- Add subscription control

### Deliverables

- Transport service
- MIDI test helpers
- Meter accumulator
- Analyzer buffer
- Svelte visualization components

### Required outcomes

- Missing host fields are safe
- MIDI offsets are preserved
- Meter updates are throttled
- Visualization frames may be dropped safely
- Editor destruction stops visualization delivery

## Milestone 10: CLI commands

### Goals

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

### Deliverables

- CLI entry point
- Command implementations
- Environment detection
- Error reporting
- Version reporting

### Required outcomes

- Commands work from a clean generated project
- Failures are actionable
- Commands compose correctly

## Milestone 11: Validation

### Goals

- Integrate VST3 validator
- Integrate Audio Unit validation on macOS
- Add plugin loading smoke tests
- Add editor lifecycle tests
- Add state and automation tests
- Add bus-layout tests

### Deliverables

- Validator adapters
- Validation report format
- CI integration
- Local validation command

### Required outcomes

- Release VST3 passes validator
- AU passes validation on macOS
- Editor open-close-reopen works
- State and automation checks pass

## Milestone 12: Packaging and signing hooks

### Goals

- Package VST3, AU, and standalone artifacts
- Add checksums
- Add platform installer hooks
- Add signing hooks
- Add notarization hooks

### Deliverables

- Packaging scripts
- Artifact manifest
- Signing configuration schema
- CI release workflows

### Required outcomes

- Unsigned local packages build
- CI can inject signing credentials
- Secrets remain outside source control
- Checksums are generated

## Milestone 13: Upgrade system

### Goals

- Record builder and template versions
- Compare project structure versions
- Update runtime and generated files
- Preserve user files
- Report conflicts

### Deliverables

- Upgrade planner
- Migration registry
- Conflict report
- Template diff command

### Required outcomes

- Compatible upgrades complete automatically
- User files remain untouched
- Conflicts are explicit
- Project migrations run sequentially

## Milestone 14: Examples and documentation

### Goals

Create complete example plugins:

- Gain effect
- Filter effect
- Instrument

### Deliverables

- Example manifests
- Example DSP
- Example Svelte controls
- Build instructions
- Development guide
- Architecture guide
- Release guide

### Required outcomes

- Each example builds
- Each example validates
- Each example demonstrates a different plugin archetype

## Work rules

1. Finish assigned acceptance tests before starting the next milestone.
2. Keep generated and user-owned code separate.
3. Prefer small stable interfaces over broad abstractions.
4. Do not introduce plugin hosting or DAW functionality.
5. Do not send audio through the bridge.
6. Do not add production network dependencies.
7. Do not weaken real-time safety for development convenience.
8. Keep all generated output deterministic.
9. Add migration infrastructure before releasing state formats.
10. Test editor destruction and multiple instances continuously.

## First implementation assignment

The first agent assignment should complete Milestones 0 through 1 only.

The second assignment should complete Milestones 2 through 3.

The third assignment should complete Milestones 4 through 5.

This keeps reviews focused and prevents hidden architectural shortcuts.
