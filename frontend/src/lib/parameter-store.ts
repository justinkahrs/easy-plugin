import { parameterMetadata, type ParameterId } from '$lib/generated';
import { getDefaultNormalizedValue } from '$lib/parameter-values';
import { writable, type Readable } from 'svelte/store';
import type {
  BridgeErrorEvent,
  RuntimeBridge,
  RuntimeSession
} from '$lib/bridge/types';

export type ParameterValues = Readonly<Record<ParameterId, number>>;

export interface ParameterController {
  readonly values: Readable<ParameterValues>;
  readonly error: Readable<BridgeErrorEvent | undefined>;
  initialize(): Promise<RuntimeSession>;
  beginGesture(parameterId: ParameterId): void;
  updateNormalized(parameterId: ParameterId, value: number): void;
  endGesture(parameterId: ParameterId): void;
  setDiscrete(parameterId: ParameterId, value: number): void;
  dispose(): void;
}

export function createParameterController(bridge: RuntimeBridge): ParameterController {
  const values = writable<ParameterValues>(createDefaultValues());
  const error = writable<BridgeErrorEvent | undefined>(undefined);
  const unsubscribe = bridge.subscribe((event) => {
    if (event.type === 'state.snapshot') {
      values.set(event.parameters);
    } else if (event.type === 'parameter.changed') {
      values.update((current) => ({
        ...current,
        [event.parameterId]: event.normalizedValue
      }));
    } else if (event.type === 'error') {
      error.set(event);
    }
  });

  return {
    values: { subscribe: values.subscribe },
    error: { subscribe: error.subscribe },

    async initialize(): Promise<RuntimeSession> {
      const session = await bridge.initialize();
      values.set(session.snapshot.parameters);
      return session;
    },

    beginGesture(parameterId: ParameterId): void {
      error.set(undefined);
      bridge.beginParameterGesture(parameterId);
    },

    updateNormalized(parameterId: ParameterId, normalizedValue: number): void {
      const value = clampNormalized(normalizedValue);
      values.update((current) => ({ ...current, [parameterId]: value }));
      bridge.setParameterNormalized(parameterId, value);
    },

    endGesture(parameterId: ParameterId): void {
      bridge.endParameterGesture(parameterId);
    },

    setDiscrete(parameterId: ParameterId, normalizedValue: number): void {
      error.set(undefined);
      bridge.beginParameterGesture(parameterId);
      try {
        const value = clampNormalized(normalizedValue);
        values.update((current) => ({ ...current, [parameterId]: value }));
        bridge.setParameterNormalized(parameterId, value);
      } finally {
        bridge.endParameterGesture(parameterId);
      }
    },

    dispose(): void {
      unsubscribe();
    }
  };
}

function createDefaultValues(): ParameterValues {
  return Object.fromEntries(
    parameterMetadata.map((parameter) => [parameter.id, getDefaultNormalizedValue(parameter)])
  ) as Record<ParameterId, number>;
}

function clampNormalized(value: number): number {
  if (!Number.isFinite(value)) throw new Error('Normalized parameter values must be finite.');
  return Math.min(1, Math.max(0, value));
}
