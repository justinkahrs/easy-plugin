import { writable, type Readable } from 'svelte/store';
import type {
  MeterFrameEvent,
  RuntimeBridge,
  RuntimeSession,
  TransportChangedEvent
} from '$lib/bridge/types';

export interface AnalyzerSnapshot {
  readonly sequence: number;
  readonly sampleRate: number;
  readonly minFrequency: number;
  readonly maxFrequency: number;
  readonly magnitudes: readonly number[];
}

export interface VisualizationController {
  readonly transport: Readable<TransportChangedEvent | undefined>;
  readonly meters: Readable<MeterFrameEvent | undefined>;
  readonly analyzer: Readable<AnalyzerSnapshot | undefined>;
  initialize(): Promise<RuntimeSession>;
  dispose(): void;
}

export function createVisualizationController(bridge: RuntimeBridge): VisualizationController {
  const transport = writable<TransportChangedEvent | undefined>(undefined);
  const meters = writable<MeterFrameEvent | undefined>(undefined);
  const analyzer = writable<AnalyzerSnapshot | undefined>(undefined);
  let lastMeterSequence = -1;
  let lastAnalyzerSequence = -1;
  let subscribedMeters = false;
  let subscribedAnalyzer = false;

  const unsubscribe = bridge.subscribe((event) => {
    if (event.type === 'transport.changed') {
      transport.set(event);
    } else if (event.type === 'meter.frame' && event.sequence > lastMeterSequence) {
      lastMeterSequence = event.sequence;
      meters.set(event);
    } else if (event.type === 'analyzer.frame' && event.sequence > lastAnalyzerSequence) {
      const magnitudes = decodeFloat32(event.data, event.binCount);
      if (magnitudes === undefined) return;
      lastAnalyzerSequence = event.sequence;
      analyzer.set({
        sequence: event.sequence,
        sampleRate: event.sampleRate,
        minFrequency: event.minFrequency,
        maxFrequency: event.maxFrequency,
        magnitudes
      });
    }
  });

  return {
    transport: { subscribe: transport.subscribe },
    meters: { subscribe: meters.subscribe },
    analyzer: { subscribe: analyzer.subscribe },

    async initialize(): Promise<RuntimeSession> {
      const session = await bridge.initialize();
      if (session.capabilities.transport) transport.set(await bridge.requestTransportSnapshot());
      if (session.capabilities.meters) {
        bridge.subscribeVisualization('meters', 30);
        subscribedMeters = true;
      }
      if (session.capabilities.analyzer) {
        bridge.subscribeVisualization('analyzer', 15);
        subscribedAnalyzer = true;
      }
      return session;
    },

    dispose(): void {
      if (subscribedMeters) bridge.unsubscribeVisualization('meters');
      if (subscribedAnalyzer) bridge.unsubscribeVisualization('analyzer');
      subscribedMeters = false;
      subscribedAnalyzer = false;
      unsubscribe();
    }
  };
}

export function decodeFloat32(encoded: string, expectedCount: number): readonly number[] | undefined {
  try {
    const binary = atob(encoded);
    if (binary.length !== expectedCount * Float32Array.BYTES_PER_ELEMENT) return undefined;
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    const view = new DataView(bytes.buffer);
    const result = new Array<number>(expectedCount);
    for (let index = 0; index < expectedCount; index += 1) {
      const value = view.getFloat32(index * Float32Array.BYTES_PER_ELEMENT, true);
      if (!Number.isFinite(value)) return undefined;
      result[index] = value;
    }
    return result;
  } catch {
    return undefined;
  }
}
