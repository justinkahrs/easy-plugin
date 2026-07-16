# Bridge Protocol

## Purpose

The bridge connects the SvelteKit editor to the JUCE runtime.

It carries control, state, lifecycle, transport, preset, error, meter, and analyzer messages.

It does not carry audio buffers or invoke frontend code from the audio thread.

## Protocol envelope

Every message uses a versioned envelope:

```ts
type BridgeMessage<T> = {
  protocolVersion: 1
  instanceId: string
  requestId?: string
  sequence?: number
  payload: T
}
```

### Fields

- `protocolVersion`: protocol compatibility version
- `instanceId`: unique identifier for one plugin instance
- `requestId`: optional request-response correlation identifier
- `sequence`: optional monotonic sequence for ordered streams
- `payload`: command or event payload

## Protocol initialization

The frontend must not assume the bridge is ready immediately.

Initialization sequence:

```text
Frontend loads
    |
Frontend subscribes to native events
    |
Frontend sends bridge.frontendReady
    |
Native sends bridge.ready
    |
Frontend validates protocol version
    |
Frontend requests state snapshot
    |
Native sends state.snapshot
    |
Frontend becomes interactive
```

The frontend must remain functional in mock mode without JUCE.

## Frontend-to-native commands

```ts
type FrontendCommand =
  | BridgeFrontendReadyCommand
  | ParameterBeginGestureCommand
  | ParameterSetNormalizedCommand
  | ParameterEndGestureCommand
  | StateRequestSnapshotCommand
  | StateSetFieldCommand
  | PresetListCommand
  | PresetLoadCommand
  | PresetSaveCommand
  | PresetDeleteCommand
  | EditorSetSizeCommand
  | EditorSetZoomCommand
  | TransportRequestSnapshotCommand
  | VisualizationSubscribeCommand
  | VisualizationUnsubscribeCommand
  | BridgePingCommand
```

### Announce frontend readiness

```ts
type BridgeFrontendReadyCommand = {
  type: "bridge.frontendReady"
}
```

The frontend sends this only after registering its native-event listener. Native
responds with `bridge.ready`, avoiding a race with the WebView page-load callback.

### Begin parameter gesture

```ts
type ParameterBeginGestureCommand = {
  type: "parameter.beginGesture"
  parameterId: string
}
```

### Set normalized parameter value

```ts
type ParameterSetNormalizedCommand = {
  type: "parameter.setNormalized"
  parameterId: string
  value: number
}
```

Validation:

- `value` must be finite
- `value` must be clamped or rejected outside `0..1`
- `parameterId` must exist
- The parameter must be writable

### End parameter gesture

```ts
type ParameterEndGestureCommand = {
  type: "parameter.endGesture"
  parameterId: string
}
```

### Request state snapshot

```ts
type StateRequestSnapshotCommand = {
  type: "state.requestSnapshot"
}
```

### Set persistent state field

```ts
type StateSetFieldCommand = {
  type: "state.setField"
  fieldId: string
  value: unknown
}
```

The native runtime validates field type and persistence rules.

### Request preset list

```ts
type PresetListCommand = {
  type: "preset.list"
}
```

### Load preset

```ts
type PresetLoadCommand = {
  type: "preset.load"
  presetId: string
}
```

### Save preset

```ts
type PresetSaveCommand = {
  type: "preset.save"
  name: string
  category?: string
  tags?: string[]
}
```

### Delete preset

```ts
type PresetDeleteCommand = {
  type: "preset.delete"
  presetId: string
}
```

Factory presets must not be deletable.

### Set editor size

```ts
type EditorSetSizeCommand = {
  type: "editor.setSize"
  width: number
  height: number
}
```

The native editor applies manifest constraints.

### Set editor zoom

```ts
type EditorSetZoomCommand = {
  type: "editor.setZoom"
  zoom: number
}
```

### Request transport snapshot

```ts
type TransportRequestSnapshotCommand = {
  type: "transport.requestSnapshot"
}
```

### Subscribe to visualization

```ts
type VisualizationSubscribeCommand = {
  type: "visualization.subscribe"
  stream: "meters" | "analyzer"
  rateHz?: number
}
```

### Unsubscribe from visualization

```ts
type VisualizationUnsubscribeCommand = {
  type: "visualization.unsubscribe"
  stream: "meters" | "analyzer"
}
```

### Ping

```ts
type BridgePingCommand = {
  type: "bridge.ping"
  timestamp: number
}
```

## Native-to-frontend events

```ts
type NativeEvent =
  | BridgeReadyEvent
  | BridgePongEvent
  | StateSnapshotEvent
  | StateFieldChangedEvent
  | ParameterChangedEvent
  | PresetListEvent
  | PresetLoadedEvent
  | PresetSavedEvent
  | PresetDeletedEvent
  | PresetDirtyChangedEvent
  | MeterFrameEvent
  | AnalyzerFrameEvent
  | TransportChangedEvent
  | EditorConstraintsEvent
  | ErrorEvent
```

### Bridge ready

```ts
type BridgeReadyEvent = {
  type: "bridge.ready"
  protocolVersion: 1
  capabilities: {
    presets: boolean
    transport: boolean
    meters: boolean
    analyzer: boolean
    midi: boolean
  }
}
```

### Bridge pong

```ts
type BridgePongEvent = {
  type: "bridge.pong"
  timestamp: number
}
```

### State snapshot

```ts
type StateSnapshotEvent = {
  type: "state.snapshot"
  schemaVersion: number
  parameters: Record<string, number>
  pluginState: Record<string, unknown>
  uiState?: Record<string, unknown>
  preset?: {
    id?: string
    name?: string
    dirty: boolean
  }
}
```

Parameter values are normalized to `0..1`.

### State field changed

```ts
type StateFieldChangedEvent = {
  type: "state.fieldChanged"
  fieldId: string
  value: unknown
  source: "ui" | "preset" | "state" | "native"
}
```

### Parameter changed

```ts
type ParameterChangedEvent = {
  type: "parameter.changed"
  parameterId: string
  normalizedValue: number
  source: "host" | "ui" | "preset" | "state"
}
```

### Preset list

```ts
type PresetListEvent = {
  type: "preset.list"
  presets: Array<{
    id: string
    name: string
    category?: string
    tags?: string[]
    factory: boolean
  }>
}
```

### Preset loaded

```ts
type PresetLoadedEvent = {
  type: "preset.loaded"
  presetId: string
  name: string
}
```

### Preset saved

```ts
type PresetSavedEvent = {
  type: "preset.saved"
  presetId: string
  name: string
}
```

### Preset deleted

```ts
type PresetDeletedEvent = {
  type: "preset.deleted"
  presetId: string
}
```

### Preset dirty state

```ts
type PresetDirtyChangedEvent = {
  type: "preset.dirtyChanged"
  dirty: boolean
}
```

### Meter frame

```ts
type MeterFrameEvent = {
  type: "meter.frame"
  sequence: number
  timestamp: number
  peaks: number[]
  rms: number[]
}
```

Meter values use linear amplitude unless otherwise specified.

Meter events may be dropped.

### Analyzer frame

```ts
type AnalyzerFrameEvent = {
  type: "analyzer.frame"
  sequence: number
  timestamp: number
  sampleRate: number
  minFrequency: number
  maxFrequency: number
  encoding: "f32-base64"
  binCount: number
  data: string
}
```

Analyzer events may be dropped. `data` contains exactly `binCount` little-endian
IEEE-754 float32 magnitudes encoded as base64. The runtime caps frames at 128 bins;
the bridge never emits an unbounded analyzer object graph.

### Transport changed

```ts
type TransportChangedEvent = {
  type: "transport.changed"
  playing: boolean
  recording: boolean
  looping?: boolean
  bpm?: number
  ppqPosition?: number
  samplePosition?: number
  timeSignature?: {
    numerator: number
    denominator: number
  }
  loop?: {
    startPpq: number
    endPpq: number
  }
}
```

All host-dependent fields are optional.

### Editor constraints

```ts
type EditorConstraintsEvent = {
  type: "editor.constraints"
  width: number
  height: number
  minWidth: number
  minHeight: number
  maxWidth?: number
  maxHeight?: number
  resizable: boolean
  aspectRatio?: number
  zoom: number
}
```

### Error event

```ts
type ErrorEvent = {
  type: "error"
  category:
    | "bridge"
    | "parameter"
    | "state"
    | "preset"
    | "editor"
    | "transport"
    | "visualization"
    | "native"
  code: string
  message: string
  recoverable: boolean
  requestId?: string
}
```

## Message delivery classes

### Reliable messages

These must not be intentionally dropped:

- Parameter changes
- Parameter gestures
- State snapshots
- State field updates
- Preset commands
- Preset events
- Errors
- Editor constraints
- Bridge lifecycle messages

### Lossy messages

These may be dropped or coalesced:

- Meter frames
- Analyzer frames
- Frequent transport position updates

## Ordering

- Reliable messages from one instance must preserve logical order
- Visualization frames use monotonic sequence values
- Older visualization frames may be discarded
- Parameter events should be coalesced only when doing so does not break gesture semantics
- State snapshots supersede earlier snapshots

## Multiple-instance isolation

Every bridge message must include the current plugin instance ID.

The runtime must not use global mutable bridge state.

The frontend must reject messages for other instances.

## Reconnection and editor recreation

When the editor is recreated:

1. A new frontend instance initializes.
2. Native sends `bridge.ready`.
3. Frontend requests `state.snapshot`.
4. Native sends current parameter, plugin, UI, and preset state.
5. Frontend resumes visualization subscriptions.

No DSP state may depend on frontend continuity.

## Validation

Native command handlers must validate:

- Protocol version
- Instance ID
- Command type
- Parameter and field IDs
- Numeric finiteness
- Numeric ranges
- String lengths
- Array lengths
- Preset identifiers
- Editor dimensions
- Visualization rates

Unknown commands must return a structured error.

Unknown native events may be ignored by older frontends with diagnostics.

## Real-time boundary

Bridge handlers must never execute on the audio thread.

Audio-thread data reaches the bridge only through real-time-safe queues, accumulators, or snapshots consumed outside the audio callback.

## Mock bridge

The frontend package must include a mock implementation with:

- Generated parameter metadata
- Parameter gesture tracking
- State snapshot support
- Preset list and load behavior
- Simulated transport
- Simulated meters
- Simulated analyzer data
- Error injection
- Editor constraints

The same frontend components must work against both native and mock bridges.

## Protocol versioning

Protocol changes follow these rules:

- Additive optional fields may remain within the same protocol version
- Removing fields requires a new version
- Changing field meaning requires a new version
- Changing command or event semantics requires a new version
- The native runtime and frontend must fail clearly when no compatible version exists
