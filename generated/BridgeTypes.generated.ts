// GENERATED FILE. DO NOT EDIT.
// Generated from the plugin manifest.

import type { ParameterId } from './ParameterMetadata.generated.js';
import type { StateFieldId } from './StateMetadata.generated.js';

export const bridgeProtocolVersion = 1 as const;
export type PluginInstanceId = string;

export interface BridgeMessage<TPayload> {
  readonly protocolVersion: typeof bridgeProtocolVersion;
  readonly instanceId: PluginInstanceId;
  readonly requestId?: string;
  readonly sequence?: number;
  readonly payload: TPayload;
}

export type ParameterCommand =
  | { readonly type: 'parameter.beginGesture'; readonly parameterId: ParameterId }
  | { readonly type: 'parameter.setNormalized'; readonly parameterId: ParameterId; readonly value: number }
  | { readonly type: 'parameter.endGesture'; readonly parameterId: ParameterId };

export type FrontendCommand =
  | ParameterCommand
  | { readonly type: 'bridge.frontendReady' }
  | { readonly type: 'state.requestSnapshot' }
  | { readonly type: 'state.setField'; readonly fieldId: StateFieldId; readonly value: unknown }
  | { readonly type: 'preset.list' }
  | { readonly type: 'preset.load'; readonly presetId: string }
  | { readonly type: 'preset.save'; readonly name: string; readonly category?: string; readonly tags?: readonly string[] }
  | { readonly type: 'preset.delete'; readonly presetId: string }
  | { readonly type: 'transport.requestSnapshot' }
  | { readonly type: 'visualization.subscribe'; readonly stream: VisualizationStream; readonly rateHz?: number }
  | { readonly type: 'visualization.unsubscribe'; readonly stream: VisualizationStream }
  | { readonly type: 'bridge.ping'; readonly timestamp: number };

export type VisualizationStream = 'meters' | 'analyzer';

export interface BridgeCapabilities {
  readonly presets: boolean;
  readonly transport: boolean;
  readonly meters: boolean;
  readonly analyzer: boolean;
  readonly midi: boolean;
}

export interface BridgeReadyEvent {
  readonly type: 'bridge.ready';
  readonly protocolVersion: typeof bridgeProtocolVersion;
  readonly capabilities: BridgeCapabilities;
}

export interface BridgePongEvent {
  readonly type: 'bridge.pong';
  readonly timestamp: number;
}

export interface StateSnapshotEvent {
  readonly type: 'state.snapshot';
  readonly schemaVersion: number;
  readonly parameters: Readonly<Record<ParameterId, number>>;
  readonly pluginState: Readonly<Record<string, unknown>>;
  readonly uiState?: Readonly<Record<string, unknown>>;
  readonly preset?: Readonly<{ readonly id?: string; readonly name?: string; readonly dirty: boolean }>;
}

export interface StateFieldChangedEvent {
  readonly type: 'state.fieldChanged';
  readonly fieldId: StateFieldId;
  readonly value: unknown;
  readonly source: 'ui' | 'preset' | 'state' | 'native';
}

export interface ParameterChangedEvent {
  readonly type: 'parameter.changed';
  readonly parameterId: ParameterId;
  readonly normalizedValue: number;
  readonly source: 'host' | 'ui' | 'preset' | 'state';
}

export interface TransportChangedEvent {
  readonly type: 'transport.changed';
  readonly playing: boolean;
  readonly recording: boolean;
  readonly looping: boolean;
  readonly bpm?: number;
  readonly ppqPosition?: number;
  readonly samplePosition?: number;
  readonly timeSignature?: Readonly<{ readonly numerator: number; readonly denominator: number }>;
  readonly loop?: Readonly<{ readonly startPpq: number; readonly endPpq: number }>;
}

export interface MeterFrameEvent {
  readonly type: 'meter.frame';
  readonly sequence: number;
  readonly timestamp: number;
  readonly peaks: readonly number[];
  readonly rms: readonly number[];
}

export interface AnalyzerFrameEvent {
  readonly type: 'analyzer.frame';
  readonly sequence: number;
  readonly timestamp: number;
  readonly sampleRate: number;
  readonly minFrequency: number;
  readonly maxFrequency: number;
  readonly encoding: 'f32-base64';
  readonly binCount: number;
  readonly data: string;
}

export interface BridgeErrorEvent {
  readonly type: 'error';
  readonly category: 'bridge' | 'parameter' | 'state' | 'preset' | 'editor' | 'transport' | 'visualization' | 'native';
  readonly code: string;
  readonly message: string;
  readonly recoverable: boolean;
  readonly requestId?: string;
}

export interface PresetInfo {
  readonly id: string;
  readonly name: string;
  readonly category?: string;
  readonly tags?: readonly string[];
  readonly factory: boolean;
}

export interface PresetListEvent {
  readonly type: 'preset.list';
  readonly presets: readonly PresetInfo[];
}

export interface PresetLoadedEvent {
  readonly type: 'preset.loaded';
  readonly presetId: string;
  readonly name: string;
}

export interface PresetSavedEvent {
  readonly type: 'preset.saved';
  readonly presetId: string;
  readonly name: string;
}

export interface PresetDeletedEvent {
  readonly type: 'preset.deleted';
  readonly presetId: string;
}

export interface PresetDirtyChangedEvent {
  readonly type: 'preset.dirtyChanged';
  readonly dirty: boolean;
}

export type NativeEvent =
  | BridgeReadyEvent
  | BridgePongEvent
  | StateSnapshotEvent
  | StateFieldChangedEvent
  | ParameterChangedEvent
  | TransportChangedEvent
  | MeterFrameEvent
  | AnalyzerFrameEvent
  | PresetListEvent
  | PresetLoadedEvent
  | PresetSavedEvent
  | PresetDeletedEvent
  | PresetDirtyChangedEvent
  | BridgeErrorEvent;

export const bridgeCapabilities = {
  "presets": true,
  "transport": true,
  "meters": true,
  "analyzer": true,
  "midi": false
} as const satisfies BridgeCapabilities;
