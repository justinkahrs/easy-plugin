# Architecture

## System overview

The builder consists of four conceptual layers:

```text
plugin.yaml
    |
schema validator and compatibility checker
    |
deterministic code generator
    |
generated plugin project
    |
JUCE runtime + SvelteKit editor + user DSP
```

The generated project must keep framework runtime code, generated code, and user-owned code separate.

## Repository ownership boundaries

### Generated files

Generated files live under:

```text
generated/
```

The generator may replace these files at any time.

Generated files must include a header indicating that they are generated and should not be edited manually.

### User-owned files

User-authored code lives under:

```text
native/src/
frontend/src/
```

The generator must never overwrite these files during generation or upgrade.

### Runtime files

Shared framework runtime code lives under:

```text
runtime/
```

Runtime files may be updated by the builder during an upgrade, but changes must be versioned and migration-aware.

## Runtime responsibilities

### JUCE owns

- Audio processing
- MIDI processing
- Host-visible parameters
- Parameter automation
- Parameter gestures
- Transport state
- Plugin state
- Preset serialization
- File access
- Plugin lifecycle
- Bus layout negotiation
- Sample-rate and block-size handling
- Native plugin windows
- Native worker threads
- Real-time visualization data production

### Svelte owns

- Layout
- Controls
- Navigation
- Visual editing
- Temporary selections
- Preset browsing UI
- Non-authoritative display state
- User interaction
- Visualization rendering
- Browser-only mock development state

### The bridge carries

- Parameter gestures
- Parameter values
- State snapshots
- Preset commands
- Transport snapshots
- Meter frames
- Analyzer frames
- Errors
- Editor resize requests
- Capability negotiation
- Lifecycle events

### The bridge never carries

- Audio buffers
- Audio-thread callbacks
- Unbounded messages
- Per-sample events
- Large object graphs at animation-frame rates
- File contents on every frame
- Node-specific objects
- Native pointers

## Process model

The first release uses one process per plugin instance as controlled by the host.

The standalone build uses one native process containing the JUCE application, audio engine, and WebView.

The architecture must not depend on a separate helper process, but must leave room for one in future versions.

## Threading model

### Audio thread

Responsibilities:

- DSP
- MIDI block processing
- Parameter reads
- Parameter smoothing
- Transport snapshot consumption
- Meter accumulation
- Analyzer sample accumulation
- Sample-accurate event handling where available

Forbidden operations:

- Allocation
- Locks
- Logging
- File access
- Network access
- JSON parsing
- WebView calls
- UI calls
- Blocking queues

### JUCE message thread

Responsibilities:

- Editor lifecycle
- WebView creation and destruction
- WebView bridge calls
- Host UI interaction
- Parameter listeners
- Editor resizing
- Native error presentation
- Preset and state command dispatch

### Worker threads

Responsibilities:

- File loading
- Preset indexing
- Sample decoding
- Asset analysis
- Expensive FFT preparation
- Background migration work
- Packaging and non-runtime tasks
- Optional licensing or network work

Worker tasks must support cancellation where practical.

### Frontend thread

Responsibilities:

- Svelte rendering
- User input
- Parameter control interaction
- Visualization
- Browser-side state
- Development mock bridge

## Plugin lifecycle

The `AudioProcessor` may live for the entire host session.

The editor and WebView are temporary.

```text
AudioProcessor created
    |
prepareToPlay
    |
processBlock repeated
    |
editor created
    |
editor destroyed
    |
processing continues
    |
editor recreated
    |
releaseResources
    |
AudioProcessor destroyed
```

The frontend must reconstruct itself from native state after every editor creation.

No audio state may depend on the editor being alive.

## Parameter architecture

The host parameter system is authoritative.

The default implementation uses `AudioProcessorValueTreeState`.

```text
Svelte control
    |
begin gesture
    |
set normalized parameter value
    |
end gesture
    |
host parameter
    |
APVTS
    |
DSP reads or receives smoothed value
```

Host automation changes follow the reverse path:

```text
Host automation
    |
APVTS
    |
native parameter listener
    |
bridge event
    |
Svelte store update
```

The frontend must never update DSP state directly.

## Parameter gesture model

Continuous controls must support:

1. Begin gesture
2. Zero or more value updates
3. End gesture

Discrete controls may use one gesture around one update.

The runtime must prevent unmatched or duplicate gesture state where possible.

## State architecture

State is separated into:

### Host parameters

Automatable values exposed to the host.

### Persistent plugin state

State restored with the host session but not necessarily automatable.

Examples:

- Modulation routing
- Sequencer data
- Selected sample references
- Wavetable configuration
- Analyzer options that affect processing

### Presentation state

State that only affects the UI.

Examples:

- Selected tab
- Panel visibility
- Browser search query
- Zoom
- Scroll position

Presentation state may be persisted separately, but it must not be required for correct audio restoration.

## State serialization

Serialized state uses an explicit version:

```json
{
  "schemaVersion": 1,
  "parameters": {},
  "pluginState": {}
}
```

State migration runs sequentially:

```text
v1 -> v2 -> v3
```

Skipping migration steps is not allowed unless the migration registry explicitly supports it.

Unknown newer schema versions must fail safely without corrupting state.

## DSP architecture

The generated JUCE processor owns host communication and delegates audio processing to a user-owned DSP class.

```cpp
class DspProcessor {
public:
    void prepare(const ProcessSpec& spec);
    void reset();
    void process(AudioBlock& audio, MidiBuffer& midi, const ParameterSnapshot& parameters);
};
```

The user-owned DSP class must not depend on the WebView.

The runtime may generate parameter snapshot and smoothing helpers, but the actual effect or instrument algorithm remains user-owned.

## Bus architecture

The manifest defines supported bus configurations.

The generator produces:

- Bus declarations
- Layout support checks
- Tests for supported layouts
- Tests for rejected layouts

The first release supports:

- Mono
- Stereo
- Mono-to-stereo where explicitly configured
- Sidechain buses
- Instrument outputs
- Optional multiple output buses

Unsupported layouts must be rejected cleanly.

## MIDI architecture

JUCE owns hardware and host MIDI.

The frontend may create or edit high-level note data, but native code schedules and processes MIDI.

Project-level MIDI notes use structured data:

```ts
type MidiNote = {
  id: string
  startBeat: number
  durationBeats: number
  pitch: number
  velocity: number
  channel: number
}
```

Raw MIDI bytes are used only at device and plugin boundaries.

MIDI sample offsets must be preserved through processing.

## Transport architecture

Native code owns transport timing.

The transport snapshot contains optional host data:

```cpp
struct TransportState {
    bool playing;
    bool recording;
    std::optional<double> bpm;
    std::optional<double> ppqPosition;
    std::optional<int64_t> samplePosition;
    std::optional<TimeSignature> timeSignature;
    std::optional<LoopRange> loop;
};
```

The DSP must not assume that any optional field is present.

JavaScript timers must never drive audio or MIDI scheduling.

## Visualization architecture

High-frequency visualization uses a decoupled pipeline:

```text
Audio thread
    |
lock-free accumulator or ring buffer
    |
message-thread timer or background reduction
    |
throttled bridge event
    |
Svelte Canvas or WebGL renderer
```

Meter updates may be dropped.

Parameter updates and state changes may not be dropped.

Large analyzer frames should use packed numeric structures where practical.

## Frontend architecture

The frontend uses:

- SvelteKit
- TypeScript
- Static production output
- SSR disabled
- Embedded release assets
- Development server in debug builds
- Browser mock bridge

The frontend bridge exposes one stable interface regardless of whether the frontend is connected to JUCE or the mock runtime.

```ts
interface PluginBridge {
  initialize(): Promise<void>
  beginParameterGesture(parameterId: string): void
  setNormalizedParameter(parameterId: string, value: number): void
  endParameterGesture(parameterId: string): void
  requestStateSnapshot(): void
  subscribe(listener: (event: NativeEvent) => void): () => void
}
```

## Development mode

```text
pnpm dev
    |
Vite development server
    |
JUCE WebBrowserComponent loads localhost
```

Development mode must be enabled only in debug builds or through an explicit development flag.

## Production mode

```text
pnpm build
    |
static frontend output
    |
embedded binary resources
    |
JUCE WebBrowserComponent serves local resources
```

Release binaries must not contain a dependency on localhost or remote assets.

## Build architecture

Use:

- CMake as the source of truth
- C++20
- JUCE pinned to a specific version or commit
- pnpm lockfile
- Explicit Node and pnpm versions
- Deterministic generator output

Projucer files may be generated for compatibility only if needed, but they are not authoritative.

## Builder architecture

The CLI contains:

```text
builder/
├── cli/
├── schema/
├── generator/
├── compatibility/
├── commands/
├── templates/
└── tests/
```

Primary commands:

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

## Upgrade architecture

Every generated project records:

```yaml
builder:
  version: 0.1.0
  schemaVersion: 1
  templateCommit: abc123
```

Upgrades may replace:

- Runtime files
- Generated files
- CI templates
- Packaging templates

Upgrades must not replace:

- User DSP
- Custom Svelte components
- User bridge extensions
- User state migrations
- Custom presets
- User assets

The upgrade process must report conflicts and required manual actions.

## Error architecture

Native errors use structured messages:

```ts
type AppError = {
  category: "audio" | "midi" | "state" | "preset" | "bridge" | "build" | "validation"
  code: string
  message: string
  recoverable: boolean
}
```

Unexpected bridge messages must produce diagnostics without crashing the processor.

The audio thread may record lightweight diagnostic counters in preallocated memory but may not log directly.

## Security and offline requirements

Production builds must:

- Embed all required frontend assets
- Avoid remote scripts and styles
- Avoid remote fonts
- Avoid development URLs
- Avoid Node runtime dependencies
- Avoid arbitrary file system access from the frontend
- Validate bridge input
- Validate manifest input
- Avoid exposing native pointers or unrestricted native commands

## Extension points

The template must support user-owned extensions for:

- DSP classes
- Parameter formatters
- Parameter parsers
- Custom bridge commands
- Custom Svelte controls
- Custom state fields
- Custom migrations
- Custom CMake additions
- Custom packaging hooks
- Custom validation scripts
- Custom factory presets
