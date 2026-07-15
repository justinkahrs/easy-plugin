# Plugin Manifest Schema

## Purpose

`plugin.yaml` is the source of truth for generated plugin identity, build formats, buses, parameters, state, UI configuration, presets, and build behavior.

The builder must validate the manifest before generating or building code.

## Top-level structure

```yaml
schemaVersion: 1
builder: {}
plugin: {}
platforms: {}
formats: []
buses: {}
parameterGroups: []
parameters: []
state: {}
ui: {}
presets: {}
build: {}
features: {}
```

## `schemaVersion`

Required integer.

```yaml
schemaVersion: 1
```

The builder must reject unsupported schema versions.

## `builder`

```yaml
builder:
  minimumVersion: 0.1.0
  projectVersion: 0.1.0
  templateCommit: optional-at-project-creation
```

### Fields

- `minimumVersion`: minimum compatible builder version
- `projectVersion`: version of the generated project structure
- `templateCommit`: template revision recorded by the builder

## `plugin`

```yaml
plugin:
  id: com.example.superfilter
  name: Super Filter
  description: Stereo multimode filter
  manufacturer:
    name: Example Audio
    code: ExAu
  pluginCode: SpFl
  version: 0.1.0
  type: effect
  category: Fx
  midiInput: false
  midiOutput: false
  midiEffect: false
  synth: false
```

### Required fields

- `id`
- `name`
- `manufacturer.name`
- `manufacturer.code`
- `pluginCode`
- `version`
- `type`

### `plugin.type`

Supported values:

- `effect`
- `instrument`
- `midi-instrument`
- `analyzer`
- `sidechain-effect`

### Identity constraints

- `plugin.id` must use reverse-domain notation
- `manufacturer.code` must be exactly four ASCII characters
- `pluginCode` must be exactly four ASCII characters
- Identity values must remain stable after release
- The compatibility checker must reject accidental identity changes

## `platforms`

```yaml
platforms:
  windows:
    enabled: true
    architectures:
      - x86_64
  macos:
    enabled: true
    architectures:
      - arm64
      - x86_64
    universalBinary: true
  linux:
    enabled: false
```

The first release supports Windows and macOS builds.

Linux may be represented but must fail validation when enabled unless support is implemented.

## `formats`

```yaml
formats:
  - vst3
  - au
  - standalone
```

Supported values:

- `vst3`
- `au`
- `standalone`

Validation rules:

- `au` is valid only when macOS is enabled
- At least one format is required
- `standalone` is strongly recommended for development

## `buses`

```yaml
buses:
  inputs:
    - id: main
      name: Input
      role: main
      optional: false
      layouts:
        - mono
        - stereo
    - id: sidechain
      name: Sidechain
      role: sidechain
      optional: true
      layouts:
        - mono
        - stereo
  outputs:
    - id: main
      name: Output
      role: main
      optional: false
      layouts:
        - mono
        - stereo
```

### Bus fields

- `id`
- `name`
- `role`
- `optional`
- `layouts`

### Supported roles

- `main`
- `sidechain`
- `auxiliary`

### Supported layouts

- `none`
- `mono`
- `stereo`

Future versions may add surround and ambisonic layouts.

### Validation rules

- Bus IDs must be unique within their direction
- One main output bus is required
- Effects require at least one input unless explicitly declared as generators
- Instruments may have no input bus
- Sidechain buses must be optional inputs
- Unsupported layout combinations must be rejected

## `parameterGroups`

```yaml
parameterGroups:
  - id: filter
    name: Filter
  - id: output
    name: Output
```

Fields:

- `id`
- `name`
- `parentId`, optional

Group IDs must be unique.

## `parameters`

### Float parameter

```yaml
parameters:
  - id: cutoff
    version: 1
    name: Cutoff
    group: filter
    type: float
    min: 20
    max: 20000
    default: 1000
    step: 0
    unit: Hz
    scale: logarithmic
    automatable: true
    hidden: false
    precision: 1
    smoothing:
      type: multiplicative
      milliseconds: 30
```

### Integer parameter

```yaml
  - id: voices
    version: 1
    name: Voices
    type: integer
    min: 1
    max: 16
    default: 8
    step: 1
    automatable: true
```

### Boolean parameter

```yaml
  - id: enabled
    version: 1
    name: Enabled
    type: boolean
    default: true
    automatable: true
```

### Choice parameter

```yaml
  - id: mode
    version: 1
    name: Mode
    type: choice
    choices:
      - Low-pass
      - High-pass
      - Band-pass
    default: Low-pass
    automatable: true
```

### Common parameter fields

- `id`
- `version`
- `name`
- `type`
- `group`
- `default`
- `automatable`
- `hidden`
- `advanced`
- `unit`
- `precision`
- `formatter`
- `parser`

### Float fields

- `min`
- `max`
- `step`
- `scale`
- `skew`
- `smoothing`

### Integer fields

- `min`
- `max`
- `step`

### Choice fields

- `choices`

### Supported scales

- `linear`
- `logarithmic`
- `skewed`

### Smoothing

```yaml
smoothing:
  type: linear
  milliseconds: 20
```

Supported types:

- `none`
- `linear`
- `multiplicative`

Validation rules:

- Smoothing is valid only for float parameters
- `multiplicative` smoothing requires positive values
- Smoothing time must be non-negative

### Parameter validation rules

The builder must reject:

- Duplicate parameter IDs
- Empty IDs
- IDs containing unsupported characters
- Missing versions
- Defaults outside ranges
- Invalid ranges
- Invalid integer steps
- Choice defaults absent from choices
- Empty choice lists
- Smoothing on unsupported types
- Logarithmic scales with non-positive minimums
- References to unknown parameter groups
- Incompatible changes without migrations

### Compatibility rules

After a parameter is released:

- Its ID must not change
- Its type must not change
- Its meaning must not be reused
- Its group may change
- Its display name may change
- Its unit may change only when semantic compatibility is preserved
- Its range may change only with an explicit compatibility declaration
- Removal requires a migration or tombstone declaration

## `state`

```yaml
state:
  schemaVersion: 1
  fields:
    - id: analyzerEnabled
      type: boolean
      default: true
      persistence: plugin
    - id: selectedTab
      type: string
      default: main
      persistence: ui
```

### Supported state types

- `boolean`
- `integer`
- `float`
- `string`
- `string-array`
- `number-array`
- `object`

### Persistence values

- `plugin`
- `ui`

### Validation rules

- State IDs must be unique
- State IDs must not collide with parameter IDs
- `schemaVersion` is required
- Object defaults must be valid structured values
- Plugin state must be serializable
- UI state must not be required for DSP restoration

## `ui`

```yaml
ui:
  framework: sveltekit
  width: 720
  height: 480
  minWidth: 480
  minHeight: 320
  maxWidth: 1440
  maxHeight: 960
  resizable: true
  aspectRatio: 1.5
  defaultZoom: 1
  minZoom: 0.75
  maxZoom: 2
  renderer: dom
```

### Supported renderer values

- `dom`
- `canvas`
- `webgl`
- `mixed`

Validation rules:

- Dimensions must be positive
- Minimum dimensions must not exceed defaults
- Maximum dimensions must not be less than defaults
- Zoom values must be positive
- `aspectRatio` must be positive when present

## `presets`

```yaml
presets:
  extension: superfilterpreset
  factoryDirectory: presets/factory
  userDirectoryName: Super Filter
  includeUiState: false
  categories:
    - Bass
    - Leads
    - Effects
```

Validation rules:

- Extension must not include a leading period
- Factory directory must be project-relative
- Preset categories must be unique
- Plugin state migrations must also apply to presets

## `build`

```yaml
build:
  cppStandard: 20
  embedFrontend: true
  developmentServer: http://localhost:5173
  juce:
    version: 8.0.0
  node:
    version: 22
  pnpm:
    version: 10
  warningsAsErrors: true
  enableLtoInRelease: true
```

Validation rules:

- C++ standard must be at least 20
- Production embedding must be enabled for release builds
- Development server URLs are valid only for development configuration
- Toolchain versions must use supported syntax

## `features`

```yaml
features:
  transport: true
  presets: true
  meters: true
  analyzer: false
  midi: false
  sidechain: false
```

Feature flags allow runtime modules and generated UI to be included conditionally.

## Complete example

```yaml
schemaVersion: 1

builder:
  minimumVersion: 0.1.0
  projectVersion: 0.1.0

plugin:
  id: com.example.superfilter
  name: Super Filter
  description: Stereo multimode filter
  manufacturer:
    name: Example Audio
    code: ExAu
  pluginCode: SpFl
  version: 0.1.0
  type: effect
  category: Fx
  midiInput: false
  midiOutput: false
  midiEffect: false
  synth: false

platforms:
  windows:
    enabled: true
    architectures:
      - x86_64
  macos:
    enabled: true
    architectures:
      - arm64
      - x86_64
    universalBinary: true
  linux:
    enabled: false

formats:
  - vst3
  - au
  - standalone

buses:
  inputs:
    - id: main
      name: Input
      role: main
      optional: false
      layouts:
        - mono
        - stereo
  outputs:
    - id: main
      name: Output
      role: main
      optional: false
      layouts:
        - mono
        - stereo

parameterGroups:
  - id: filter
    name: Filter
  - id: output
    name: Output

parameters:
  - id: cutoff
    version: 1
    name: Cutoff
    group: filter
    type: float
    min: 20
    max: 20000
    default: 1000
    step: 0
    unit: Hz
    scale: logarithmic
    automatable: true
    precision: 1
    smoothing:
      type: multiplicative
      milliseconds: 30

  - id: resonance
    version: 1
    name: Resonance
    group: filter
    type: float
    min: 0.1
    max: 10
    default: 0.7
    step: 0
    automatable: true
    precision: 2
    smoothing:
      type: linear
      milliseconds: 20

  - id: mode
    version: 1
    name: Mode
    group: filter
    type: choice
    choices:
      - Low-pass
      - High-pass
      - Band-pass
    default: Low-pass
    automatable: true

  - id: outputGain
    version: 1
    name: Output
    group: output
    type: float
    min: -24
    max: 12
    default: 0
    step: 0.1
    unit: dB
    scale: linear
    automatable: true
    precision: 1
    smoothing:
      type: linear
      milliseconds: 20

state:
  schemaVersion: 1
  fields:
    - id: analyzerEnabled
      type: boolean
      default: true
      persistence: plugin
    - id: selectedTab
      type: string
      default: main
      persistence: ui

ui:
  framework: sveltekit
  width: 720
  height: 480
  minWidth: 480
  minHeight: 320
  maxWidth: 1440
  maxHeight: 960
  resizable: true
  aspectRatio: 1.5
  defaultZoom: 1
  minZoom: 0.75
  maxZoom: 2
  renderer: mixed

presets:
  extension: superfilterpreset
  factoryDirectory: presets/factory
  userDirectoryName: Super Filter
  includeUiState: false
  categories:
    - Clean
    - Creative
    - Utility

build:
  cppStandard: 20
  embedFrontend: true
  developmentServer: http://localhost:5173
  juce:
    version: 8.0.0
  node:
    version: 22
  pnpm:
    version: 10
  warningsAsErrors: true
  enableLtoInRelease: true

features:
  transport: true
  presets: true
  meters: true
  analyzer: true
  midi: false
  sidechain: false
```
