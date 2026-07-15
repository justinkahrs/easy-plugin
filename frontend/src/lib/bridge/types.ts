import type {
  BridgeCapabilities as GeneratedBridgeCapabilities,
  BridgeErrorEvent as GeneratedBridgeErrorEvent,
  BridgePongEvent as GeneratedBridgePongEvent,
  BridgeReadyEvent as GeneratedBridgeReadyEvent,
  AnalyzerFrameEvent as GeneratedAnalyzerFrameEvent,
  FrontendCommand as GeneratedFrontendCommand,
  NativeEvent as GeneratedNativeEvent,
  ParameterId,
  ParameterChangedEvent as GeneratedParameterChangedEvent,
  MeterFrameEvent as GeneratedMeterFrameEvent,
  PresetInfo,
  StateFieldChangedEvent as GeneratedStateFieldChangedEvent,
  StateFieldId,
  StateSnapshotEvent as GeneratedStateSnapshotEvent,
  TransportChangedEvent as GeneratedTransportChangedEvent,
  VisualizationStream
} from '$lib/generated';

export const protocolVersion = 1 as const;

export type RuntimeMode = 'native' | 'mock';
export type AssetSource = 'embedded' | 'development-server' | 'browser';

export type BridgeCapabilities = GeneratedBridgeCapabilities;

export interface RuntimeInfo {
  readonly protocolVersion: typeof protocolVersion;
  readonly instanceId: string;
  readonly mode: RuntimeMode;
  readonly assetSource: AssetSource;
  readonly capabilities: BridgeCapabilities;
}

export interface StateSnapshot {
  readonly schemaVersion: number;
  readonly parameters: Readonly<Record<ParameterId, number>>;
  readonly pluginState: Readonly<Record<string, unknown>>;
  readonly uiState?: Readonly<Record<string, unknown>>;
  readonly preset?: Readonly<{ readonly id?: string; readonly name?: string; readonly dirty: boolean }>;
}

export interface RuntimeSession extends RuntimeInfo {
  readonly snapshot: StateSnapshot;
}

export type ParameterChangeSource = 'host' | 'ui' | 'preset' | 'state';

export type ParameterChangedEvent = GeneratedParameterChangedEvent;

export type StateSnapshotEvent = GeneratedStateSnapshotEvent;

export type StateFieldChangedEvent = GeneratedStateFieldChangedEvent;

export type BridgeReadyEvent = GeneratedBridgeReadyEvent;

export type BridgePongEvent = GeneratedBridgePongEvent;

export type BridgeErrorEvent = GeneratedBridgeErrorEvent;

export type TransportChangedEvent = GeneratedTransportChangedEvent;

export type MeterFrameEvent = GeneratedMeterFrameEvent;

export type AnalyzerFrameEvent = GeneratedAnalyzerFrameEvent;

export type NativeEvent = GeneratedNativeEvent;

export type NativeEventListener = (event: NativeEvent) => void;

export interface RuntimeBridge {
  readonly mode: RuntimeMode;
  initialize(): Promise<RuntimeSession>;
  ping(): Promise<number>;
  requestStateSnapshot(): Promise<StateSnapshot>;
  requestTransportSnapshot(): Promise<TransportChangedEvent>;
  beginParameterGesture(parameterId: ParameterId): void;
  setParameterNormalized(parameterId: ParameterId, value: number): void;
  endParameterGesture(parameterId: ParameterId): void;
  setStateField(fieldId: StateFieldId, value: unknown): void;
  listPresets(): void;
  loadPreset(presetId: string): void;
  savePreset(name: string, category?: string, tags?: readonly string[]): void;
  deletePreset(presetId: string): void;
  subscribeVisualization(stream: VisualizationStream, rateHz?: number): void;
  unsubscribeVisualization(stream: VisualizationStream): void;
  subscribe(listener: NativeEventListener): () => void;
  dispose(): void;
}

export interface BridgeEnvelope<TPayload> {
  readonly protocolVersion: typeof protocolVersion;
  readonly instanceId: string;
  readonly requestId?: string;
  readonly sequence?: number;
  readonly payload: TPayload;
}

export type FrontendCommand = GeneratedFrontendCommand;
export type { PresetInfo, StateFieldId, VisualizationStream };
