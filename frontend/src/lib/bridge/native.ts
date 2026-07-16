import {
  parameterMetadata,
  stateFieldMetadata,
  type ParameterId,
  type PresetInfo,
  type StateFieldId
} from '$lib/generated';
import type { JuceBackend, JuceRuntime } from './juce-runtime';
import {
  protocolVersion,
  type AssetSource,
  type AnalyzerFrameEvent,
  type BridgeCapabilities,
  type BridgeEnvelope,
  type BridgeErrorEvent,
  type BridgePongEvent,
  type BridgeReadyEvent,
  type FrontendCommand,
  type MeterFrameEvent,
  type NativeEvent,
  type NativeEventListener,
  type ParameterChangedEvent,
  type RuntimeBridge,
  type RuntimeInfo,
  type RuntimeSession,
  type StateSnapshot,
  type StateSnapshotEvent,
  type TransportChangedEvent,
  type VisualizationStream
} from './types';

const commandEventId = 'easyPlugin.command';
const nativeEventId = 'easyPlugin.event';
const requestTimeoutMs = 2_000;
const parameterIds = new Set<string>(parameterMetadata.map((parameter) => parameter.id));
const stateFieldIds = new Set<string>(stateFieldMetadata.map((field) => field.id));

interface InitialisationData {
  protocolVersion: number;
  instanceId: string;
  assetSource: AssetSource;
}

interface PendingPing {
  kind: 'ping';
  startedAt: number;
  resolve: (latencyMs: number) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

interface PendingSnapshot {
  kind: 'snapshot';
  resolve: (snapshot: StateSnapshot) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

interface PendingTransport {
  kind: 'transport';
  resolve: (snapshot: TransportChangedEvent) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

type PendingRequest = PendingPing | PendingSnapshot | PendingTransport;

interface ReadyWaiter {
  resolve: (event: BridgeReadyEvent) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export class NativeBridge implements RuntimeBridge {
  readonly mode = 'native' as const;

  readonly #backend: JuceBackend;
  readonly #baseInfo: Omit<RuntimeInfo, 'capabilities'>;
  readonly #listenerToken: [string, number];
  readonly #pending = new Map<string, PendingRequest>();
  readonly #listeners = new Set<NativeEventListener>();
  #readyEvent: BridgeReadyEvent | undefined;
  #readyWaiter: ReadyWaiter | undefined;
  #protocolError: Error | undefined;
  #initializePromise: Promise<RuntimeSession> | undefined;
  #disposed = false;
  #nextRequestId = 1;

  constructor(runtime: JuceRuntime) {
    const backend = runtime.backend;
    const data = parseInitialisationData(runtime.initialisationData?.easyPlugin?.[0]);

    if (backend === undefined) {
      throw new Error('JUCE native integration is missing its backend object.');
    }
    if (data.protocolVersion !== protocolVersion) {
      throw new Error(
        `Unsupported native protocol ${data.protocolVersion}; this editor requires ${protocolVersion}.`
      );
    }

    this.#backend = backend;
    this.#baseInfo = {
      protocolVersion,
      instanceId: data.instanceId,
      mode: this.mode,
      assetSource: data.assetSource
    };
    this.#listenerToken = backend.addEventListener(nativeEventId, (value) => {
      this.#handleNativeEvent(value);
    });
    // The native page-load callback can run before application modules install their
    // event listeners. This explicit handshake makes bridge.ready replayable per load.
    this.#emit({ type: 'bridge.frontendReady' }, this.#nextId('ready'));
  }

  initialize(): Promise<RuntimeSession> {
    this.#assertActive();
    this.#initializePromise ??= this.#initializeSession();
    return this.#initializePromise;
  }

  ping(): Promise<number> {
    this.#assertActive();
    const requestId = this.#nextId('ping');
    const command: FrontendCommand = { type: 'bridge.ping', timestamp: Date.now() };

    return new Promise<number>((resolve, reject) => {
      const timeout = this.#requestTimeout(requestId, reject, 'The native bridge did not answer the ping.');
      this.#pending.set(requestId, {
        kind: 'ping',
        startedAt: performance.now(),
        resolve,
        reject,
        timeout
      });
      this.#emit(command, requestId);
    });
  }

  requestStateSnapshot(): Promise<StateSnapshot> {
    this.#assertActive();
    const requestId = this.#nextId('snapshot');

    return new Promise<StateSnapshot>((resolve, reject) => {
      const timeout = this.#requestTimeout(
        requestId,
        reject,
        'The native bridge did not deliver a state snapshot.'
      );
      this.#pending.set(requestId, { kind: 'snapshot', resolve, reject, timeout });
      this.#emit({ type: 'state.requestSnapshot' }, requestId);
    });
  }

  requestTransportSnapshot(): Promise<TransportChangedEvent> {
    this.#assertActive();
    const requestId = this.#nextId('transport');
    return new Promise<TransportChangedEvent>((resolve, reject) => {
      const timeout = this.#requestTimeout(
        requestId,
        reject,
        'The native bridge did not deliver a transport snapshot.'
      );
      this.#pending.set(requestId, { kind: 'transport', resolve, reject, timeout });
      this.#emit({ type: 'transport.requestSnapshot' }, requestId);
    });
  }

  beginParameterGesture(parameterId: ParameterId): void {
    this.#assertActive();
    this.#emit({ type: 'parameter.beginGesture', parameterId }, this.#nextId('gesture'));
  }

  setParameterNormalized(parameterId: ParameterId, value: number): void {
    this.#assertActive();
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error('Normalized parameter values must be finite and within 0..1.');
    }
    this.#emit(
      { type: 'parameter.setNormalized', parameterId, value },
      this.#nextId('parameter')
    );
  }

  endParameterGesture(parameterId: ParameterId): void {
    this.#assertActive();
    this.#emit({ type: 'parameter.endGesture', parameterId }, this.#nextId('gesture'));
  }

  setStateField(fieldId: StateFieldId, value: unknown): void {
    this.#assertActive();
    this.#emit({ type: 'state.setField', fieldId, value }, this.#nextId('state'));
  }

  listPresets(): void {
    this.#assertActive();
    this.#emit({ type: 'preset.list' }, this.#nextId('presets'));
  }

  loadPreset(presetId: string): void {
    this.#assertActive();
    this.#emit({ type: 'preset.load', presetId }, this.#nextId('preset'));
  }

  savePreset(name: string, category?: string, tags?: readonly string[]): void {
    this.#assertActive();
    this.#emit(
      {
        type: 'preset.save',
        name,
        ...(category === undefined ? {} : { category }),
        ...(tags === undefined ? {} : { tags })
      },
      this.#nextId('preset')
    );
  }

  deletePreset(presetId: string): void {
    this.#assertActive();
    this.#emit({ type: 'preset.delete', presetId }, this.#nextId('preset'));
  }

  subscribeVisualization(stream: VisualizationStream, rateHz?: number): void {
    this.#assertActive();
    this.#emit(
      {
        type: 'visualization.subscribe',
        stream,
        ...(rateHz === undefined ? {} : { rateHz })
      },
      this.#nextId('visualization')
    );
  }

  unsubscribeVisualization(stream: VisualizationStream): void {
    this.#assertActive();
    this.#emit({ type: 'visualization.unsubscribe', stream }, this.#nextId('visualization'));
  }

  subscribe(listener: NativeEventListener): () => void {
    this.#assertActive();
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  dispose(): void {
    if (this.#disposed) return;

    this.#disposed = true;
    this.#backend.removeEventListener(this.#listenerToken);
    this.#rejectReady(new Error('The native bridge was disposed during initialization.'));
    for (const request of this.#pending.values()) {
      clearTimeout(request.timeout);
      request.reject(new Error('The native bridge was disposed before the request completed.'));
    }
    this.#pending.clear();
    this.#listeners.clear();
  }

  async #initializeSession(): Promise<RuntimeSession> {
    const ready = await this.#waitForReady();
    const snapshot = await this.requestStateSnapshot();
    return { ...this.#baseInfo, capabilities: ready.capabilities, snapshot };
  }

  #waitForReady(): Promise<BridgeReadyEvent> {
    if (this.#readyEvent !== undefined) return Promise.resolve(this.#readyEvent);
    if (this.#protocolError !== undefined) return Promise.reject(this.#protocolError);

    return new Promise<BridgeReadyEvent>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.#readyWaiter = undefined;
        reject(new Error('The native bridge did not announce bridge.ready within two seconds.'));
      }, requestTimeoutMs);
      this.#readyWaiter = { resolve, reject, timeout };
    });
  }

  #handleNativeEvent(value: unknown): void {
    if (!isRecord(value) || value['instanceId'] !== this.#baseInfo.instanceId) return;
    if (value['protocolVersion'] !== protocolVersion) {
      const received = value['protocolVersion'];
      this.#protocolError = new Error(
        `Unsupported native event protocol ${String(received)}; expected ${protocolVersion}.`
      );
      this.#rejectReady(this.#protocolError);
      return;
    }

    const payload = value['payload'];
    if (!isRecord(payload) || typeof payload['type'] !== 'string') return;
    const requestId = typeof value['requestId'] === 'string' ? value['requestId'] : undefined;
    const event = parseNativeEvent(payload);
    if (event === undefined) return;

    if (event.type === 'bridge.ready') this.#resolveReady(event);
    if (requestId !== undefined && event.type === 'bridge.pong') this.#resolvePing(requestId, event);
    if (requestId !== undefined && event.type === 'state.snapshot') {
      this.#resolveSnapshot(requestId, event);
    }
    if (requestId !== undefined && event.type === 'transport.changed') {
      this.#resolveTransport(requestId, event);
    }
    if (event.type === 'error' && requestId !== undefined) this.#rejectRequest(requestId, event);

    for (const listener of this.#listeners) listener(event);
  }

  #resolveReady(event: BridgeReadyEvent): void {
    this.#readyEvent = event;
    const waiter = this.#readyWaiter;
    if (waiter === undefined) return;
    clearTimeout(waiter.timeout);
    this.#readyWaiter = undefined;
    waiter.resolve(event);
  }

  #rejectReady(error: Error): void {
    const waiter = this.#readyWaiter;
    if (waiter === undefined) return;
    clearTimeout(waiter.timeout);
    this.#readyWaiter = undefined;
    waiter.reject(error);
  }

  #resolvePing(requestId: string, event: BridgePongEvent): void {
    const request = this.#pending.get(requestId);
    if (request?.kind !== 'ping') return;
    clearTimeout(request.timeout);
    this.#pending.delete(requestId);
    request.resolve(Math.max(0, performance.now() - request.startedAt));
  }

  #resolveSnapshot(requestId: string, event: StateSnapshotEvent): void {
    const request = this.#pending.get(requestId);
    if (request?.kind !== 'snapshot') return;
    clearTimeout(request.timeout);
    this.#pending.delete(requestId);
    request.resolve({
      schemaVersion: event.schemaVersion,
      parameters: event.parameters,
      pluginState: event.pluginState,
      ...(event.uiState === undefined ? {} : { uiState: event.uiState }),
      ...(event.preset === undefined ? {} : { preset: event.preset })
    });
  }

  #resolveTransport(requestId: string, event: TransportChangedEvent): void {
    const request = this.#pending.get(requestId);
    if (request?.kind !== 'transport') return;
    clearTimeout(request.timeout);
    this.#pending.delete(requestId);
    request.resolve(event);
  }

  #rejectRequest(requestId: string, event: BridgeErrorEvent): void {
    const request = this.#pending.get(requestId);
    if (request === undefined) return;
    clearTimeout(request.timeout);
    this.#pending.delete(requestId);
    request.reject(new Error(`${event.code}: ${event.message}`));
  }

  #emit(command: FrontendCommand, requestId?: string): void {
    const envelope: BridgeEnvelope<FrontendCommand> = {
      protocolVersion,
      instanceId: this.#baseInfo.instanceId,
      ...(requestId === undefined ? {} : { requestId }),
      payload: command
    };
    this.#backend.emitEvent(commandEventId, envelope);
  }

  #requestTimeout(
    requestId: string,
    reject: (error: Error) => void,
    message: string
  ): ReturnType<typeof setTimeout> {
    return setTimeout(() => {
      this.#pending.delete(requestId);
      reject(new Error(message));
    }, requestTimeoutMs);
  }

  #nextId(prefix: string): string {
    return `${prefix}-${this.#nextRequestId++}`;
  }

  #assertActive(): void {
    if (this.#disposed) throw new Error('The native bridge has been disposed.');
  }
}
function parseInitialisationData(value: unknown): InitialisationData {
  if (!isRecord(value)) throw new Error('JUCE did not provide Easy Plugin initialisation data.');

  const version = value['protocolVersion'];
  const instanceId = value['instanceId'];
  const assetSource = value['assetSource'];
  if (typeof version !== 'number' || typeof instanceId !== 'string' || !isAssetSource(assetSource)) {
    throw new Error('JUCE provided malformed Easy Plugin initialisation data.');
  }
  return { protocolVersion: version, instanceId, assetSource };
}

function parseNativeEvent(value: Record<string, unknown>): NativeEvent | undefined {
  switch (value['type']) {
    case 'bridge.ready':
      return parseReady(value);
    case 'bridge.pong':
      return typeof value['timestamp'] === 'number'
        ? { type: 'bridge.pong', timestamp: value['timestamp'] }
        : undefined;
    case 'state.snapshot':
      return parseSnapshot(value);
    case 'parameter.changed':
      return parseParameterChanged(value);
    case 'transport.changed':
      return parseTransport(value);
    case 'meter.frame':
      return parseMeterFrame(value);
    case 'analyzer.frame':
      return parseAnalyzerFrame(value);
    case 'state.fieldChanged':
      return parseStateFieldChanged(value);
    case 'preset.list':
      return parsePresetList(value);
    case 'preset.loaded':
    case 'preset.saved':
      return parsePresetNamedEvent(value);
    case 'preset.deleted':
      return typeof value['presetId'] === 'string'
        ? { type: 'preset.deleted', presetId: value['presetId'] }
        : undefined;
    case 'preset.dirtyChanged':
      return typeof value['dirty'] === 'boolean'
        ? { type: 'preset.dirtyChanged', dirty: value['dirty'] }
        : undefined;
    case 'error':
      return parseError(value);
    default:
      return undefined;
  }
}

function parseReady(value: Record<string, unknown>): BridgeReadyEvent | undefined {
  const capabilities = value['capabilities'];
  if (value['protocolVersion'] !== protocolVersion || !isCapabilities(capabilities)) return undefined;
  return { type: 'bridge.ready', protocolVersion, capabilities };
}

function parseSnapshot(value: Record<string, unknown>): StateSnapshotEvent | undefined {
  const parameters = value['parameters'];
  const pluginState = value['pluginState'];
  const uiState = value['uiState'];
  const preset = value['preset'];
  if (
    typeof value['schemaVersion'] !== 'number' ||
    !Number.isInteger(value['schemaVersion']) ||
    !isRecord(parameters) ||
    !isRecord(pluginState) ||
    (uiState !== undefined && !isRecord(uiState)) ||
    (preset !== undefined && !isPresetSnapshot(preset))
  ) {
    return undefined;
  }

  const normalizedParameters = {} as Record<ParameterId, number>;
  for (const metadata of parameterMetadata) {
    const normalizedValue = parameters[metadata.id];
    if (typeof normalizedValue !== 'number' || !Number.isFinite(normalizedValue)) return undefined;
    normalizedParameters[metadata.id] = clampNormalized(normalizedValue);
  }

  return {
    type: 'state.snapshot',
    schemaVersion: value['schemaVersion'],
    parameters: normalizedParameters,
    pluginState,
    ...(uiState === undefined ? {} : { uiState }),
    ...(preset === undefined ? {} : { preset })
  };
}

function parseStateFieldChanged(value: Record<string, unknown>): NativeEvent | undefined {
  const fieldId = value['fieldId'];
  const source = value['source'];
  if (!isStateFieldId(fieldId) || !isStateSource(source)) return undefined;
  return { type: 'state.fieldChanged', fieldId, value: value['value'], source };
}

function parsePresetList(value: Record<string, unknown>): NativeEvent | undefined {
  const presets = value['presets'];
  if (!Array.isArray(presets)) return undefined;
  const parsed: PresetInfo[] = [];
  for (const preset of presets) {
    if (!isRecord(preset) || typeof preset['id'] !== 'string' || typeof preset['name'] !== 'string'
      || typeof preset['factory'] !== 'boolean') return undefined;
    const category = preset['category'];
    const tags = preset['tags'];
    if ((category !== undefined && typeof category !== 'string')
      || (tags !== undefined && (!Array.isArray(tags) || !tags.every((tag) => typeof tag === 'string')))) {
      return undefined;
    }
    parsed.push({
      id: preset['id'],
      name: preset['name'],
      factory: preset['factory'],
      ...(category === undefined ? {} : { category }),
      ...(tags === undefined ? {} : { tags })
    });
  }
  return { type: 'preset.list', presets: parsed };
}

function parsePresetNamedEvent(value: Record<string, unknown>): NativeEvent | undefined {
  if (typeof value['presetId'] !== 'string' || typeof value['name'] !== 'string') return undefined;
  return value['type'] === 'preset.loaded'
    ? { type: 'preset.loaded', presetId: value['presetId'], name: value['name'] }
    : { type: 'preset.saved', presetId: value['presetId'], name: value['name'] };
}

function parseParameterChanged(value: Record<string, unknown>): ParameterChangedEvent | undefined {
  const parameterId = value['parameterId'];
  const normalizedValue = value['normalizedValue'];
  const source = value['source'];
  if (
    !isParameterId(parameterId) ||
    typeof normalizedValue !== 'number' ||
    !Number.isFinite(normalizedValue) ||
    !isParameterSource(source)
  ) {
    return undefined;
  }
  return {
    type: 'parameter.changed',
    parameterId,
    normalizedValue: clampNormalized(normalizedValue),
    source
  };
}

function parseTransport(value: Record<string, unknown>): TransportChangedEvent | undefined {
  if (
    typeof value['playing'] !== 'boolean' ||
    typeof value['recording'] !== 'boolean' ||
    typeof value['looping'] !== 'boolean'
  ) return undefined;

  const bpm = optionalFiniteNumber(value['bpm']);
  const ppqPosition = optionalFiniteNumber(value['ppqPosition']);
  const samplePosition = optionalFiniteNumber(value['samplePosition']);
  if (bpm === false || ppqPosition === false || samplePosition === false) return undefined;

  const timeSignature = value['timeSignature'];
  const loop = value['loop'];
  if (timeSignature !== undefined && !isTimeSignature(timeSignature)) return undefined;
  if (loop !== undefined && !isLoop(loop)) return undefined;

  return {
    type: 'transport.changed',
    playing: value['playing'],
    recording: value['recording'],
    looping: value['looping'],
    ...(bpm === undefined ? {} : { bpm }),
    ...(ppqPosition === undefined ? {} : { ppqPosition }),
    ...(samplePosition === undefined ? {} : { samplePosition }),
    ...(timeSignature === undefined ? {} : { timeSignature }),
    ...(loop === undefined ? {} : { loop })
  };
}

function parseMeterFrame(value: Record<string, unknown>): MeterFrameEvent | undefined {
  const sequence = finiteNumber(value['sequence']);
  const timestamp = finiteNumber(value['timestamp']);
  const peaks = value['peaks'];
  const rms = value['rms'];
  if (
    sequence === undefined || timestamp === undefined ||
    !isFiniteNumberArray(peaks, 64) || !isFiniteNumberArray(rms, 64) ||
    peaks.length !== rms.length
  ) return undefined;
  return { type: 'meter.frame', sequence, timestamp, peaks, rms };
}

function parseAnalyzerFrame(value: Record<string, unknown>): AnalyzerFrameEvent | undefined {
  const sequence = finiteNumber(value['sequence']);
  const timestamp = finiteNumber(value['timestamp']);
  const sampleRate = finiteNumber(value['sampleRate']);
  const minFrequency = finiteNumber(value['minFrequency']);
  const maxFrequency = finiteNumber(value['maxFrequency']);
  const binCount = value['binCount'];
  const data = value['data'];
  if (
    sequence === undefined || timestamp === undefined || sampleRate === undefined ||
    minFrequency === undefined || maxFrequency === undefined ||
    value['encoding'] !== 'f32-base64' ||
    typeof binCount !== 'number' || !Number.isInteger(binCount) || binCount < 1 || binCount > 128 ||
    typeof data !== 'string' || data.length > 1_024
  ) return undefined;
  return {
    type: 'analyzer.frame',
    sequence,
    timestamp,
    sampleRate,
    minFrequency,
    maxFrequency,
    encoding: 'f32-base64',
    binCount,
    data
  };
}

function parseError(value: Record<string, unknown>): BridgeErrorEvent | undefined {
  const category = value['category'];
  if (
    !isErrorCategory(category) ||
    typeof value['code'] !== 'string' ||
    typeof value['message'] !== 'string' ||
    typeof value['recoverable'] !== 'boolean'
  ) {
    return undefined;
  }
  const requestId = value['requestId'];
  return {
    type: 'error',
    category,
    code: value['code'],
    message: value['message'],
    recoverable: value['recoverable'],
    ...(typeof requestId === 'string' ? { requestId } : {})
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function optionalFiniteNumber(value: unknown): number | undefined | false {
  return value === undefined ? undefined : (finiteNumber(value) ?? false);
}

function isFiniteNumberArray(value: unknown, maximumLength: number): value is number[] {
  return Array.isArray(value) && value.length <= maximumLength
    && value.every((item) => typeof item === 'number' && Number.isFinite(item));
}

function isTimeSignature(
  value: unknown
): value is { readonly numerator: number; readonly denominator: number } {
  return isRecord(value)
    && typeof value['numerator'] === 'number' && Number.isInteger(value['numerator']) && value['numerator'] > 0
    && typeof value['denominator'] === 'number' && Number.isInteger(value['denominator']) && value['denominator'] > 0;
}

function isLoop(value: unknown): value is { readonly startPpq: number; readonly endPpq: number } {
  return isRecord(value) && finiteNumber(value['startPpq']) !== undefined
    && finiteNumber(value['endPpq']) !== undefined;
}

function isAssetSource(value: unknown): value is AssetSource {
  return value === 'embedded' || value === 'development-server';
}

function isCapabilities(value: unknown): value is BridgeCapabilities {
  return (
    isRecord(value) &&
    typeof value['presets'] === 'boolean' &&
    typeof value['transport'] === 'boolean' &&
    typeof value['meters'] === 'boolean' &&
    typeof value['analyzer'] === 'boolean' &&
    typeof value['midi'] === 'boolean'
  );
}

function isParameterId(value: unknown): value is ParameterId {
  return typeof value === 'string' && parameterIds.has(value);
}

function isStateFieldId(value: unknown): value is StateFieldId {
  return typeof value === 'string' && stateFieldIds.has(value);
}

function isStateSource(value: unknown): value is 'ui' | 'preset' | 'state' | 'native' {
  return value === 'ui' || value === 'preset' || value === 'state' || value === 'native';
}

function isPresetSnapshot(
  value: unknown
): value is { readonly id?: string; readonly name?: string; readonly dirty: boolean } {
  return isRecord(value)
    && typeof value['dirty'] === 'boolean'
    && (value['id'] === undefined || typeof value['id'] === 'string')
    && (value['name'] === undefined || typeof value['name'] === 'string');
}

function isParameterSource(value: unknown): value is ParameterChangedEvent['source'] {
  return value === 'host' || value === 'ui' || value === 'preset' || value === 'state';
}

function isErrorCategory(value: unknown): value is BridgeErrorEvent['category'] {
  return (
    value === 'bridge' ||
    value === 'parameter' ||
    value === 'state' ||
    value === 'preset' ||
    value === 'editor' ||
    value === 'transport' ||
    value === 'visualization' ||
    value === 'native'
  );
}

function clampNormalized(value: number): number {
  return Math.min(1, Math.max(0, value));
}
