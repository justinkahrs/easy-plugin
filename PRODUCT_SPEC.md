# Product Specification

## Product

A command-line tool and reusable project template for generating production-ready JUCE audio plugins with a SvelteKit user interface from a declarative manifest.

The builder must generate working native plugin projects rather than code snippets or partial examples.

## Primary use case

A developer creates a plugin project, edits `plugin.yaml`, implements DSP in a user-owned source file, customizes the Svelte frontend, and runs:

```text
plugin build
```

The resulting project can produce:

- VST3 plugins on Windows and macOS
- Audio Unit plugins on macOS
- Standalone desktop applications
- Embedded SvelteKit user interfaces
- Host-visible parameters and automation
- Persistent plugin state and presets
- Automated validation and packaging

## Target users

- TypeScript developers entering audio plugin development
- Audio developers who prefer web UI technologies
- Teams building multiple plugins with shared infrastructure
- Commercial plugin developers who need reproducible builds
- Internal product teams that need fast prototyping without sacrificing host compatibility

## Product principles

1. The plugin manifest is the source of truth for generated metadata, parameters, buses, state, and build targets.
2. Generated code and user-authored code must remain clearly separated.
3. The editor must be optional at runtime. Audio processing must continue when the editor is closed.
4. Native code owns all audio-affecting state.
5. The web frontend must not process audio or own timing-critical MIDI.
6. Production plugins must run without an internet connection.
7. Parameter IDs and plugin identity values must remain stable after release.
8. Generated projects must be testable, validatable, upgradeable, and reproducible.
9. The template must expose escape hatches for custom DSP, bridge methods, UI components, state, packaging, and CMake configuration.
10. The first generated project should be useful without requiring edits to framework runtime code.

## First release scope

### Supported plugin types

- Audio effect
- Software instrument
- MIDI-capable instrument
- Analyzer
- Sidechain effect

### Supported build formats

#### Windows

- VST3
- Standalone executable

#### macOS

- VST3
- Audio Unit
- Standalone application

### Supported architectures

#### Windows

- x86_64

#### macOS

- arm64
- x86_64
- Universal binary when configured

### Frontend stack

- SvelteKit
- TypeScript strict mode
- Vite
- `@sveltejs/adapter-static`
- pnpm
- Embedded production assets
- Development server support in debug mode
- Mock bridge support for browser-only development

### Native stack

- JUCE 8
- C++20
- CMake
- Ninja where available
- `AudioProcessorValueTreeState` for host-visible parameter management
- `WebBrowserComponent` for the editor
- JUCE audio, MIDI, state, transport, plugin, and file APIs

## Non-goals for the first release

- AAX support
- CLAP support
- LV2 support
- AUv3 support
- Arbitrary third-party plugin hosting
- Full DAW functionality
- Remote frontend hosting
- Browser-based audio processing
- Web Audio for plugin operation
- Web MIDI for plugin operation
- Raw audio transport through the WebView bridge
- Automatic DSP generation from natural language
- Arbitrary modular routing graphs
- Sandboxed plugin processing
- Cloud project storage
- User account systems or licensing servers

## User workflow

### Create a project

```text
plugin create super-filter
```

The command creates a complete project from the current template.

### Configure the plugin

The developer edits:

```text
plugin.yaml
```

The manifest defines plugin identity, formats, buses, parameters, state, UI, presets, and build options.

### Generate source files

```text
plugin generate
```

The command validates the manifest and generates deterministic native and TypeScript bindings.

### Develop the plugin

```text
plugin dev
```

The command starts the SvelteKit development server, builds the native standalone target, and launches the standalone application against the development frontend.

### Run tests

```text
plugin test
```

The command runs:

- Manifest validation tests
- Generator tests
- Native unit tests
- DSP tests
- State migration tests
- Frontend tests
- Bridge contract tests

### Validate plugin formats

```text
plugin validate
```

The command builds release plugin formats and runs platform-specific validators and smoke tests.

### Package distributable artifacts

```text
plugin package
```

The command produces platform-appropriate distributable artifacts, checksums, and release metadata.

### Diagnose the environment

```text
plugin doctor
```

The command checks toolchains, SDKs, JUCE availability, Node, pnpm, CMake, compilers, validators, and signing prerequisites.

### Upgrade a generated project

```text
plugin upgrade
```

The command updates framework and generated files without overwriting user-owned source files.

## Manifest-driven features

The manifest must define:

- Schema version
- Minimum builder version
- Plugin identifier
- Plugin name and description
- Manufacturer name and code
- Plugin code
- Plugin version
- Plugin type
- MIDI capabilities
- Build formats
- Supported platforms and architectures
- Input and output buses
- Supported channel layouts
- Sidechain configuration
- Parameters
- Parameter groups
- Parameter smoothing
- Persistent plugin state
- UI dimensions and resizing
- Preset metadata
- Development frontend URL
- Production asset embedding
- Optional feature flags

## Required generated artifacts

The builder must generate:

- Stable plugin identifiers
- JUCE CMake configuration
- Plugin metadata constants
- Parameter identifier constants
- APVTS parameter layout
- Parameter lookup helpers
- Parameter smoothing declarations
- TypeScript parameter definitions
- Svelte parameter bindings
- Default Svelte controls
- Native bridge message types
- Frontend bridge message types
- Bus-layout declarations
- Bus-layout validation
- State serialization declarations
- Migration registry skeleton
- Preset metadata
- Validation tests
- CI configuration
- Packaging metadata
- Builder version metadata

## Parameter requirements

Each parameter must support:

- Stable string ID
- Display name
- Type
- Default value
- Range
- Unit
- Automation eligibility
- Discrete or continuous behavior
- Optional skew or scale
- Optional smoothing
- Optional grouping
- Optional formatter
- Optional parser
- Optional display precision
- Optional value labels
- Optional hidden or advanced designation

Supported parameter types:

- Float
- Integer
- Boolean
- Choice

Parameter identifiers must never be regenerated after project creation.

The generator must reject incompatible changes unless an explicit migration is declared.

## State requirements

State must be divided into:

1. Host-automatable parameters
2. Persistent non-automatable plugin state
3. Presentation-only UI state

Serialized plugin state must contain:

```json
{
  "schemaVersion": 1,
  "parameters": {},
  "pluginState": {}
}
```

The runtime must support sequential state migrations.

Preset state and host project state must share the same underlying migration system.

## Frontend requirements

- SvelteKit with static output
- TypeScript strict mode
- No server runtime
- No Node runtime in the shipped plugin
- No remote production assets
- Mock native bridge for browser development
- Hot reload during development
- Rehydration from native state whenever the editor opens
- Parameter gesture support
- Host-driven parameter update support
- Editor resizing support
- High-frequency visualization isolated from ordinary application state
- Graceful failure when the native bridge is unavailable
- Accessible controls for generated parameter UI

## Native requirements

- JUCE 8
- C++20
- CMake
- Correct host parameter integration
- Correct parameter gesture handling
- Safe editor creation and destruction
- Correct multiple-instance isolation
- Correct zero-sample-block handling
- Correct sample-rate and block-size reinitialization
- MIDI sample-offset preservation
- Optional host transport data handling
- State serialization and migration
- No real-time-unsafe operations in processing callbacks
- Deterministic initialization and shutdown

## Real-time safety requirements

The normal audio processing path must not perform:

- Dynamic memory allocation
- Lock acquisition
- File access
- Network access
- JSON parsing
- Logging
- WebView calls
- UI callbacks
- Blocking inter-thread communication

Control updates from the UI must be transferred into the audio engine through lock-free or otherwise real-time-safe mechanisms.

## Validation requirements

Generated projects must test:

- Plugin loading
- Editor creation
- Editor destruction and recreation
- Parameter enumeration
- Parameter automation
- Parameter gesture behavior
- State save and restore
- State migration
- Multiple instances
- Supported bus layouts
- Unsupported bus-layout rejection
- Silence handling
- NaN and infinity detection
- MIDI processing for instruments
- Offline rendering
- Sample-rate changes
- Buffer-size changes
- Production asset embedding
- Absence of development URLs in release builds
- Deterministic generated output

## Packaging requirements

The builder must provide extension points for:

- Windows Authenticode signing
- macOS code signing
- macOS hardened runtime
- macOS notarization
- Installer creation
- Artifact checksums
- Release notes
- CI secret injection

Signing credentials must never be stored in generated source repositories.

## Success criteria

The first release is successful when a developer can:

1. Create a project.
2. Define plugin metadata and parameters in YAML.
3. Add DSP in a user-owned C++ file.
4. Build a working standalone application and VST3.
5. Use a SvelteKit editor with host automation.
6. Save and restore plugin state.
7. Run validation without manually wiring tools.
8. Package a distributable build.
9. Upgrade the template without losing custom code.
