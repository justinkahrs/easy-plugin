import { MockBridge } from './mock';
import { NativeBridge } from './native';
import type { RuntimeBridge } from './types';

export function createRuntimeBridge(): RuntimeBridge {
  const runtime = window.__JUCE__;
  return runtime?.backend === undefined ? new MockBridge() : new NativeBridge(runtime);
}

export type {
  NativeEvent,
  PresetInfo,
  RuntimeBridge,
  RuntimeInfo,
  RuntimeSession,
  StateFieldId,
  StateSnapshot,
  TransportChangedEvent,
  VisualizationStream
} from './types';
