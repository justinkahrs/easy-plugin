import {
  bridgeCapabilities,
  parameterMetadata,
  presetConfiguration,
  stateFieldMetadata,
  stateSchemaVersion,
  type ParameterId,
  type PresetInfo,
  type StateFieldId
} from '$lib/generated';
import { getDefaultNormalizedValue } from '$lib/parameter-values';
import {
  protocolVersion,
  type BridgeErrorEvent,
  type NativeEventListener,
  type RuntimeBridge,
  type RuntimeSession,
  type StateSnapshot,
  type TransportChangedEvent,
  type VisualizationStream
} from './types';

export interface MockGestureEvent {
  readonly type: 'begin' | 'update' | 'end';
  readonly parameterId: ParameterId;
  readonly value?: number;
}

export class MockBridge implements RuntimeBridge {
  readonly mode = 'mock' as const;

  readonly #instanceId: string;
  readonly #values = createDefaultValues();
  readonly #pluginState = createDefaultState('plugin');
  readonly #uiState = createDefaultState('ui');
  readonly #presets = new Map<string, MockPreset>();
  readonly #activeGestures = new Set<ParameterId>();
  readonly #gestureLog: MockGestureEvent[] = [];
  readonly #listeners = new Set<NativeEventListener>();
  readonly #visualizationTimers = new Map<VisualizationStream, ReturnType<typeof setInterval>>();
  #disposed = false;
  #currentPreset: { id: string; name: string; dirty: boolean } | undefined;
  #nextUserPreset = 1;
  #meterSequence = 0;
  #analyzerSequence = 0;

  constructor(instanceId = 'browser-mock-001') {
    this.#instanceId = instanceId;
    for (const preset of createFactoryPresets()) this.#presets.set(preset.info.id, preset);
  }

  async initialize(): Promise<RuntimeSession> {
    this.#assertActive();
    return {
      protocolVersion,
      instanceId: this.#instanceId,
      mode: this.mode,
      assetSource: 'browser',
      capabilities: bridgeCapabilities,
      snapshot: await this.requestStateSnapshot()
    };
  }

  async ping(): Promise<number> {
    this.#assertActive();
    const startedAt = performance.now();
    await new Promise<void>((resolve) => setTimeout(resolve, 12));
    this.#assertActive();
    return Math.max(1, Math.round(performance.now() - startedAt));
  }

  async requestStateSnapshot(): Promise<StateSnapshot> {
    this.#assertActive();
    return {
      schemaVersion: stateSchemaVersion,
      parameters: { ...this.#values },
      pluginState: { ...this.#pluginState },
      uiState: { ...this.#uiState },
      preset: this.#currentPreset === undefined ? { dirty: false } : { ...this.#currentPreset }
    };
  }

  async requestTransportSnapshot(): Promise<TransportChangedEvent> {
    this.#assertActive();
    return {
      type: 'transport.changed',
      playing: true,
      recording: false,
      looping: true,
      bpm: 120,
      ppqPosition: 16,
      samplePosition: 352_800,
      timeSignature: { numerator: 4, denominator: 4 },
      loop: { startPpq: 0, endPpq: 32 }
    };
  }

  beginParameterGesture(parameterId: ParameterId): void {
    this.#assertActive();
    if (this.#activeGestures.has(parameterId)) {
      this.#emitError('gesture-already-active', `A gesture is already active for '${parameterId}'.`);
      return;
    }
    this.#activeGestures.add(parameterId);
    this.#gestureLog.push({ type: 'begin', parameterId });
  }

  setParameterNormalized(parameterId: ParameterId, value: number): void {
    this.#assertActive();
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error('Normalized parameter values must be finite and within 0..1.');
    }
    this.#values[parameterId] = value;
    this.#gestureLog.push({ type: 'update', parameterId, value });
    this.#emit({
      type: 'parameter.changed',
      parameterId,
      normalizedValue: value,
      source: 'ui'
    });
    this.#markDirty();
  }

  endParameterGesture(parameterId: ParameterId): void {
    this.#assertActive();
    if (!this.#activeGestures.delete(parameterId)) {
      this.#emitError('gesture-not-active', `No gesture is active for '${parameterId}'.`);
      return;
    }
    this.#gestureLog.push({ type: 'end', parameterId });
  }

  setStateField(fieldId: StateFieldId, value: unknown): void {
    this.#assertActive();
    const metadata = stateFieldMetadata.find((field) => field.id === fieldId);
    if (metadata === undefined || !isStateValue(metadata.type, value)) {
      this.#emitError('invalid-state-field', `Invalid value for '${fieldId}'.`, 'state');
      return;
    }
    const target = metadata.persistence === 'plugin' ? this.#pluginState : this.#uiState;
    target[fieldId] = structuredClone(value);
    this.#emit({ type: 'state.fieldChanged', fieldId, value, source: 'ui' });
    if (metadata.persistence === 'plugin' || presetConfiguration.includeUiState) this.#markDirty();
  }

  listPresets(): void {
    this.#assertActive();
    this.#emit({ type: 'preset.list', presets: [...this.#presets.values()].map((preset) => preset.info) });
  }

  loadPreset(presetId: string): void {
    this.#assertActive();
    const preset = this.#presets.get(presetId);
    if (preset === undefined) {
      this.#emitError('preset-not-found', `Preset '${presetId}' was not found.`, 'preset');
      return;
    }
    Object.assign(this.#values, preset.parameters);
    Object.assign(this.#pluginState, structuredClone(preset.pluginState));
    if (preset.uiState !== undefined) Object.assign(this.#uiState, structuredClone(preset.uiState));
    for (const parameter of parameterMetadata) {
      this.#emit({
        type: 'parameter.changed',
        parameterId: parameter.id,
        normalizedValue: this.#values[parameter.id],
        source: 'preset'
      });
    }
    for (const field of stateFieldMetadata) {
      const source = field.persistence === 'plugin' ? this.#pluginState : this.#uiState;
      this.#emit({ type: 'state.fieldChanged', fieldId: field.id, value: source[field.id], source: 'preset' });
    }
    this.#currentPreset = { id: preset.info.id, name: preset.info.name, dirty: false };
    this.#emit({ type: 'preset.dirtyChanged', dirty: false });
    this.#emit({ type: 'preset.loaded', presetId: preset.info.id, name: preset.info.name });
  }

  savePreset(name: string, category?: string, tags?: readonly string[]): void {
    this.#assertActive();
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed.length > 80) {
      this.#emitError('invalid-preset-name', 'Preset names must contain 1 to 80 characters.', 'preset');
      return;
    }
    const id = `user:mock-${this.#nextUserPreset++}`;
    const info: PresetInfo = {
      id,
      name: trimmed,
      factory: false,
      ...(category === undefined || category === '' ? {} : { category }),
      ...(tags === undefined ? {} : { tags: [...tags] })
    };
    this.#presets.set(id, {
      info,
      parameters: { ...this.#values },
      pluginState: structuredClone(this.#pluginState),
      ...(presetConfiguration.includeUiState ? { uiState: structuredClone(this.#uiState) } : {})
    });
    this.#currentPreset = { id, name: trimmed, dirty: false };
    this.#emit({ type: 'preset.dirtyChanged', dirty: false });
    this.#emit({ type: 'preset.saved', presetId: id, name: trimmed });
    this.listPresets();
  }

  deletePreset(presetId: string): void {
    this.#assertActive();
    const preset = this.#presets.get(presetId);
    if (preset?.info.factory === true) {
      this.#emitError('factory-preset-protected', 'Factory presets cannot be deleted.', 'preset');
      return;
    }
    if (preset === undefined) {
      this.#emitError('preset-not-found', `Preset '${presetId}' was not found.`, 'preset');
      return;
    }
    this.#presets.delete(presetId);
    if (this.#currentPreset?.id === presetId) this.#currentPreset = undefined;
    this.#emit({ type: 'preset.deleted', presetId });
    this.listPresets();
  }

  subscribeVisualization(stream: VisualizationStream, rateHz?: number): void {
    this.#assertActive();
    this.unsubscribeVisualization(stream);
    const maximumRate = stream === 'meters' ? 30 : 15;
    const rate = Math.min(maximumRate, Math.max(1, Math.round(rateHz ?? maximumRate)));
    const emit = () => stream === 'meters' ? this.#emitMeterFrame() : this.#emitAnalyzerFrame();
    emit();
    this.#visualizationTimers.set(stream, setInterval(emit, 1_000 / rate));
  }

  unsubscribeVisualization(stream: VisualizationStream): void {
    const timer = this.#visualizationTimers.get(stream);
    if (timer !== undefined) clearInterval(timer);
    this.#visualizationTimers.delete(stream);
  }

  subscribe(listener: NativeEventListener): () => void {
    this.#assertActive();
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  simulateHostParameterChange(parameterId: ParameterId, value: number): void {
    this.#assertActive();
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error('Normalized parameter values must be finite and within 0..1.');
    }
    this.#values[parameterId] = value;
    this.#emit({
      type: 'parameter.changed',
      parameterId,
      normalizedValue: value,
      source: 'host'
    });
    this.#markDirty();
  }

  getGestureLog(): readonly MockGestureEvent[] {
    return [...this.#gestureLog];
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    for (const timer of this.#visualizationTimers.values()) clearInterval(timer);
    this.#visualizationTimers.clear();
    this.#activeGestures.clear();
    this.#listeners.clear();
  }

  #emit(event: Parameters<NativeEventListener>[0]): void {
    for (const listener of this.#listeners) listener(event);
  }

  #emitError(code: string, message: string, category: BridgeErrorEvent['category'] = 'parameter'): void {
    const event: BridgeErrorEvent = {
      type: 'error',
      category,
      code,
      message,
      recoverable: true
    };
    this.#emit(event);
  }

  #emitMeterFrame(): void {
    if (this.#disposed) return;
    const phase = this.#meterSequence * 0.17;
    const left = 0.18 + 0.5 * Math.abs(Math.sin(phase));
    const right = 0.15 + 0.42 * Math.abs(Math.sin(phase + 0.8));
    this.#emit({
      type: 'meter.frame',
      sequence: ++this.#meterSequence,
      timestamp: performance.now(),
      peaks: [left, right],
      rms: [left * 0.7, right * 0.7]
    });
  }

  #emitAnalyzerFrame(): void {
    if (this.#disposed) return;
    const magnitudes = new Float32Array(128);
    const phase = this.#analyzerSequence * 0.04;
    for (let bin = 0; bin < magnitudes.length; bin += 1) {
      magnitudes[bin] = Math.max(
        0.0001,
        Math.exp(-bin / 34) * (0.45 + 0.35 * Math.sin(bin * 0.19 + phase) ** 2)
      );
    }
    this.#emit({
      type: 'analyzer.frame',
      sequence: ++this.#analyzerSequence,
      timestamp: performance.now(),
      sampleRate: 48_000,
      minFrequency: 93.75,
      maxFrequency: 12_000,
      encoding: 'f32-base64',
      binCount: magnitudes.length,
      data: encodeFloat32(magnitudes)
    });
  }

  #assertActive(): void {
    if (this.#disposed) throw new Error('The mock bridge has been disposed.');
  }

  #markDirty(): void {
    if (this.#currentPreset === undefined || this.#currentPreset.dirty) return;
    this.#currentPreset.dirty = true;
    this.#emit({ type: 'preset.dirtyChanged', dirty: true });
  }
}

function encodeFloat32(values: Float32Array): string {
  const bytes = new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

interface MockPreset {
  readonly info: PresetInfo;
  readonly parameters: Record<ParameterId, number>;
  readonly pluginState: Record<string, unknown>;
  readonly uiState?: Record<string, unknown>;
}

function createDefaultValues(): Record<ParameterId, number> {
  return Object.fromEntries(
    parameterMetadata.map((parameter) => [parameter.id, getDefaultNormalizedValue(parameter)])
  ) as Record<ParameterId, number>;
}

function createDefaultState(persistence: 'plugin' | 'ui'): Record<string, unknown> {
  return Object.fromEntries(
    stateFieldMetadata
      .filter((field) => field.persistence === persistence)
      .map((field) => [field.id, structuredClone(field.default)])
  );
}

function createFactoryPresets(): MockPreset[] {
  const defaults = createDefaultValues();
  return [
    {
      info: { id: 'factory:clean-low-pass', name: 'Clean Low-pass', category: 'Clean', factory: true },
      parameters: { ...defaults, cutoff: 0.62, mode: 0, outputGain: 0.6666667, resonance: 0.0606061 },
      pluginState: { analyzerEnabled: true }
    },
    {
      info: { id: 'factory:legacy-resonator', name: 'Legacy Resonator', category: 'Creative', factory: true },
      parameters: { ...defaults, cutoff: 0.43, mode: 1, outputGain: 0.5833333, resonance: 0.72 },
      pluginState: { analyzerEnabled: false }
    }
  ];
}

function isStateValue(type: string, value: unknown): boolean {
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'integer') return typeof value === 'number' && Number.isInteger(value);
  if (type === 'float') return typeof value === 'number' && Number.isFinite(value);
  if (type === 'string') return typeof value === 'string';
  if (type === 'string-array') return Array.isArray(value) && value.every((item) => typeof item === 'string');
  if (type === 'number-array') return Array.isArray(value) && value.every((item) => typeof item === 'number' && Number.isFinite(item));
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
