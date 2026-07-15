# Acceptance Tests

## Test philosophy

Acceptance tests verify that generated projects behave correctly in real plugin conditions.

A feature is not complete because it compiles. It must also work across editor lifecycle, host automation, state restoration, multiple instances, release asset loading, and validation tooling.

## Project creation

### AT-001 Create project

Given a valid project name, running:

```text
plugin create test-plugin
```

must create a complete project with no missing required files.

### AT-002 Invalid project name

Invalid project names must fail with an actionable error.

### AT-003 Existing directory protection

The create command must not overwrite an existing non-empty directory without an explicit override flag.

## Manifest validation

### AT-010 Valid manifest

A valid `plugin.yaml` must pass validation.

### AT-011 Duplicate parameter IDs

A manifest containing duplicate parameter IDs must fail.

### AT-012 Invalid parameter default

A default value outside the declared range must fail.

### AT-013 Invalid choice default

A choice default absent from the choice list must fail.

### AT-014 Invalid logarithmic range

A logarithmic float parameter with a non-positive minimum must fail.

### AT-015 Invalid smoothing

Smoothing applied to a boolean, integer, or choice parameter must fail.

### AT-016 Invalid identity codes

Manufacturer and plugin codes that are not exactly four ASCII characters must fail.

### AT-017 Invalid format platform combination

Audio Unit format with macOS disabled must fail.

### AT-018 Invalid bus definition

A sidechain output or non-optional sidechain input must fail.

### AT-019 State collision

A state field ID matching a parameter ID must fail.

## Code generation

### AT-020 Deterministic generation

Running:

```text
plugin generate
```

twice without changing inputs must produce byte-identical generated files.

### AT-021 Stable ordering

Generated parameters, groups, buses, and state fields must use deterministic ordering.

### AT-022 Generated file ownership

Generated files must contain an edit warning and reside only in generated directories.

### AT-023 User file preservation

Generation must not modify user-owned DSP or Svelte files.

### AT-024 C++ and TypeScript ID parity

Generated C++ and TypeScript parameter IDs must match exactly.

### AT-025 Compatibility detection

Changing a released parameter ID must fail compatibility checks.

### AT-026 Type compatibility detection

Changing a released parameter type must fail compatibility checks.

### AT-027 Explicit migration allowance

An otherwise incompatible state change with a valid migration declaration must pass.

## Build and frontend integration

### AT-030 Clean checkout build

A clean checkout with documented dependencies must build without manual file edits.

### AT-031 Standalone target

The standalone target must launch successfully.

### AT-032 Development frontend

In development mode, the standalone target must load the Vite development server.

### AT-033 Embedded release frontend

In release mode, the standalone target and plugin editor must load embedded frontend assets.

### AT-034 Offline release

Release mode must work with networking disabled.

### AT-035 No localhost in release

Release binaries and generated release resources must not contain the configured development server URL.

### AT-036 Browser mock mode

The Svelte frontend must run in a normal browser using the mock bridge.

## Bridge lifecycle

### AT-040 Bridge initialization

The frontend must wait for `bridge.ready`, validate the protocol version, request a state snapshot, and become interactive.

### AT-041 Unsupported protocol

An unsupported protocol version must produce a clear error.

### AT-042 Instance isolation

Messages for another instance ID must be rejected or ignored.

### AT-043 Editor recreation

Closing and reopening the editor must restore all visible parameter and plugin state from native state.

### AT-044 Processing without editor

Audio processing must continue while the editor is closed.

### AT-045 Multiple editor cycles

Repeated editor open-close cycles must not leak editor, WebView, listener, or bridge instances.

## Parameters and automation

### AT-050 Parameter enumeration

All manifest parameters must appear as host-visible parameters.

### AT-051 UI to native parameter update

Changing a generated Svelte control must update the corresponding host parameter.

### AT-052 Native to UI parameter update

Changing a parameter from the host must update the Svelte control.

### AT-053 Gesture boundaries

Dragging a continuous control must send one begin gesture, one or more updates, and one end gesture.

### AT-054 Discrete control gesture

A boolean or choice update must produce a valid host automation gesture.

### AT-055 Normalized value handling

Normalized values must map correctly to native parameter values.

### AT-056 Parameter smoothing

Parameters configured for smoothing must not produce abrupt unsmoothed transitions in the generated DSP example.

### AT-057 Parameter formatting

Generated formatting and parsing must round-trip supported values within tolerance.

## State and presets

### AT-060 State round trip

Saving and restoring plugin state must restore all host parameters and persistent plugin state.

### AT-061 UI state separation

Presentation-only UI state must not be required for correct DSP restoration.

### AT-062 State schema version

Serialized state must include the current schema version.

### AT-063 Sequential migration

A version-one state must migrate sequentially to the current version.

### AT-064 Newer state rejection

Unsupported newer state must fail safely without corrupting current state.

### AT-065 Preset round trip

Saving and loading a user preset must restore the same underlying plugin state.

### AT-066 Factory preset protection

Factory presets must not be deletable.

### AT-067 Preset migration

Old preset state must use the same migration path as host state.

### AT-068 Dirty state

Changing a parameter after preset load must mark the preset state dirty.

## DSP and real-time behavior

### AT-070 No dynamic allocation

The normal processing path must perform no dynamic allocation after preparation.

### AT-071 No locks

The normal processing path must acquire no locks.

### AT-072 No logging

The audio callback must not log directly.

### AT-073 No file or bridge access

The audio callback must not access files or the WebView bridge.

### AT-074 Zero-sample block

The processor must handle a zero-sample block without error.

### AT-075 Silence handling

A plugin expected to preserve silence must produce silence for silent input.

### AT-076 NaN and infinity safety

Randomized input and parameter tests must produce no NaN or infinite samples.

### AT-077 Reset behavior

Resetting the processor must clear transient DSP state predictably.

### AT-078 Sample-rate change

Changing sample rate must reinitialize DSP correctly.

### AT-079 Buffer-size change

Changing maximum block size must reinitialize DSP correctly.

### AT-080 Offline processing

The processor must support non-real-time or offline rendering.

## Bus layouts

### AT-090 Supported mono layout

A declared mono layout must initialize and process successfully.

### AT-091 Supported stereo layout

A declared stereo layout must initialize and process successfully.

### AT-092 Unsupported layout rejection

An undeclared layout must be rejected cleanly.

### AT-093 Sidechain layout

A declared sidechain layout must expose the sidechain bus and process safely when disconnected.

### AT-094 Instrument layout

An instrument with no input bus and a stereo output must initialize correctly.

## MIDI and transport

### AT-100 MIDI sample offsets

MIDI event sample offsets must be preserved within each processing block.

### AT-101 Instrument MIDI output

A generated instrument example must produce audio for valid note input.

### AT-102 Missing transport fields

The processor must operate when host tempo, PPQ, loop, or time signature fields are absent.

### AT-103 Transport update

Available host transport state must reach subscribed frontend components outside the audio thread.

## Visualization

### AT-110 Meter throttling

Meter events must be emitted at the configured rate rather than once per audio block.

### AT-111 Meter dropping

Dropping old meter frames must not affect audio or parameter updates.

### AT-112 Analyzer isolation

Analyzer rendering must not trigger full application-state updates at audio-block frequency.

### AT-113 Visualization unsubscribe

Destroying the editor or unsubscribing must stop visualization delivery.

## Multiple instances

### AT-120 Parameter isolation

Two plugin instances must not share parameter state.

### AT-121 Preset isolation

Loading a preset in one instance must not alter another.

### AT-122 Visualization isolation

Meter and analyzer data must be routed to the correct instance.

### AT-123 Editor isolation

Each editor must connect only to its own processor instance.

## Plugin validation

### AT-130 VST3 validator

A release VST3 must pass the configured Steinberg VST3 validator.

### AT-131 Audio Unit validation

A release Audio Unit must pass platform validation on macOS.

### AT-132 Plugin loading smoke test

Each declared plugin format must load in an automated or scripted host test where supported.

### AT-133 Editor smoke test

Each declared plugin format must create and destroy its editor successfully.

### AT-134 State validation

Validation must include state save and restore.

### AT-135 Automation validation

Validation must include host parameter changes and automation gestures.

## Packaging

### AT-140 Package command

Running:

```text
plugin package
```

must produce distributable artifacts for the current platform.

### AT-141 Artifact checksums

Packaging must produce checksums for release artifacts.

### AT-142 Signing extension points

Packaging must expose signing hooks without requiring credentials in source control.

### AT-143 macOS notarization extension

macOS packaging must expose notarization configuration through CI secrets.

### AT-144 Windows signing extension

Windows packaging must expose Authenticode configuration through CI secrets.

## CLI diagnostics

### AT-150 Doctor command

Running:

```text
plugin doctor
```

must report the status of required toolchains and validators.

### AT-151 Actionable failures

Missing dependencies must produce actionable installation or configuration guidance.

### AT-152 Version reporting

The CLI must report builder, schema, template, JUCE, Node, pnpm, CMake, and compiler versions.

## CI

### AT-160 Windows build

CI must build Windows x86_64 VST3 and standalone targets.

### AT-161 macOS arm64 build

CI must build macOS arm64 VST3, AU, and standalone targets.

### AT-162 macOS x86_64 build

CI must build macOS x86_64 VST3, AU, and standalone targets.

### AT-163 Universal binary

When enabled, CI must produce and validate universal macOS binaries.

### AT-164 Test execution

CI must run schema, generator, native, frontend, bridge, and DSP tests.

### AT-165 Validation execution

CI must run available plugin validators.

## Upgrade behavior

### AT-170 Upgrade metadata

Generated projects must record builder, project schema, and template versions.

### AT-171 User file preservation

Running:

```text
plugin upgrade
```

must not overwrite user-owned files.

### AT-172 Generated file refresh

Upgrade must refresh generated and runtime files when compatible.

### AT-173 Conflict reporting

Upgrade conflicts must produce a report describing required manual action.

### AT-174 Migration execution

Project structure migrations must run sequentially.

## Completion criteria

A milestone is complete only when all acceptance tests assigned to that milestone pass in CI or are explicitly marked as blocked with a reproducible reason.
