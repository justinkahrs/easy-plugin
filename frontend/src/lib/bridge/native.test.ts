import { describe, expect, it } from 'vitest';
import {
  bridgeCapabilities,
  parameterMetadata,
  stateFieldMetadata,
  stateSchemaVersion
} from '$lib/generated';
import { getDefaultNormalizedValue } from '$lib/parameter-values';
import type { JuceBackend, JuceRuntime } from './juce-runtime';
import { NativeBridge } from './native';

class FakeBackend implements JuceBackend {
  readonly commands: unknown[] = [];
  #listener: ((payload: unknown) => void) | undefined;

  constructor(private readonly announceReadyImmediately = false) {}

  addEventListener(_: string, listener: (payload: unknown) => void): [string, number] {
    this.#listener = listener;
    return ['easyPlugin.event', 1];
  }

  removeEventListener(): void {
    this.#listener = undefined;
  }

  emitEvent(_: string, payload: unknown): void {
    this.commands.push(payload);
    if (!isRecord(payload) || !isRecord(payload['payload'])) return;
    if (payload['payload']['type'] === 'bridge.frontendReady' && this.announceReadyImmediately) {
      this.fire(readyEnvelope());
      return;
    }
    if (payload['payload']['type'] !== 'state.requestSnapshot') return;
    this.fire({
      protocolVersion: 1,
      instanceId: 'instance',
      requestId: payload['requestId'],
      payload: {
        type: 'state.snapshot',
        schemaVersion: stateSchemaVersion,
        parameters: Object.fromEntries(
          parameterMetadata.map((parameter) => [
            parameter.id,
            getDefaultNormalizedValue(parameter)
          ])
        ),
        pluginState: generatedStateDefaults('plugin'),
        uiState: generatedStateDefaults('ui')
      }
    });
  }

  fire(payload: unknown): void {
    this.#listener?.(payload);
  }
}

describe('NativeBridge protocol validation', () => {
  it('fails clearly when native initialisation uses an unsupported protocol', () => {
    const runtime = createRuntime(new FakeBackend(), 99);
    expect(() => new NativeBridge(runtime)).toThrow('Unsupported native protocol 99');
  });

  it('handles bridge.ready synchronously after installing the event listener', async () => {
    const backend = new FakeBackend(true);
    const bridge = new NativeBridge(createRuntime(backend));
    const firstParameter = parameterMetadata[0];
    if (firstParameter === undefined) throw new Error('The template fixture requires one parameter.');
    expect(backend.commands.map(commandType)).toEqual(['bridge.frontendReady']);
    const initialization = bridge.initialize();

    await expect(initialization).resolves.toMatchObject({
      instanceId: 'instance',
      capabilities: bridgeCapabilities,
      snapshot: {
        schemaVersion: stateSchemaVersion,
        parameters: {
          [firstParameter.id]: getDefaultNormalizedValue(firstParameter)
        }
      }
    });
    expect(backend.commands.map(commandType)).toEqual([
      'bridge.frontendReady',
      'state.requestSnapshot'
    ]);
  });

  it('rejects unsupported native event envelopes immediately', async () => {
    const backend = new FakeBackend();
    const bridge = new NativeBridge(createRuntime(backend));
    const initialization = bridge.initialize();
    backend.fire({ ...readyEnvelope(), protocolVersion: 2 });
    await expect(initialization).rejects.toThrow('Unsupported native event protocol 2');
  });

  it('ignores events routed to a different plugin instance', () => {
    const backend = new FakeBackend();
    const bridge = new NativeBridge(createRuntime(backend));
    const received: unknown[] = [];
    bridge.subscribe((event) => received.push(event));
    backend.fire({ ...readyEnvelope(), instanceId: 'someone-else' });
    expect(received).toEqual([]);
  });

  it('sends typed state and preset commands and parses their events', () => {
    const backend = new FakeBackend();
    const bridge = new NativeBridge(createRuntime(backend));
    const received: unknown[] = [];
    bridge.subscribe((event) => received.push(event));
    backend.commands.length = 0;

    const stateField = stateFieldMetadata[0];
    if (stateField !== undefined) bridge.setStateField(stateField.id, stateField.default);
    bridge.listPresets();
    bridge.loadPreset('factory:default');
    bridge.savePreset('Saved', 'Clean', ['test']);
    bridge.deletePreset('user:one');
    expect(backend.commands.map(commandType)).toEqual([
      ...(stateField === undefined ? [] : ['state.setField']),
      'preset.list',
      'preset.load',
      'preset.save',
      'preset.delete'
    ]);

    if (stateField !== undefined) {
      backend.fire(eventEnvelope({
        type: 'state.fieldChanged',
        fieldId: stateField.id,
        value: stateField.default,
        source: 'state'
      }));
    }
    backend.fire(eventEnvelope({
      type: 'preset.list',
      presets: [{ id: 'factory:default', name: 'Default', factory: true }]
    }));
    backend.fire(eventEnvelope({ type: 'preset.dirtyChanged', dirty: true }));
    expect(received).toEqual([
      ...(stateField === undefined
        ? []
        : [expect.objectContaining({
            type: 'state.fieldChanged',
            fieldId: stateField.id,
            value: stateField.default
          })]),
      expect.objectContaining({ type: 'preset.list', presets: [expect.objectContaining({ factory: true })] }),
      { type: 'preset.dirtyChanged', dirty: true }
    ]);
  });

  it('correlates transport snapshots and validates bounded visualization events', async () => {
    const backend = new FakeBackend();
    const bridge = new NativeBridge(createRuntime(backend));
    const received: unknown[] = [];
    bridge.subscribe((event) => received.push(event));

    const transportPromise = bridge.requestTransportSnapshot();
    const command = backend.commands.at(-1);
    const requestId = isRecord(command) ? command['requestId'] : undefined;
    backend.fire({
      protocolVersion: 1,
      instanceId: 'instance',
      requestId,
      payload: {
        type: 'transport.changed',
        playing: true,
        recording: false,
        looping: true,
        bpm: 123,
        timeSignature: { numerator: 7, denominator: 8 }
      }
    });
    await expect(transportPromise).resolves.toMatchObject({ playing: true, bpm: 123 });

    bridge.subscribeVisualization('meters', 30);
    bridge.subscribeVisualization('analyzer', 15);
    bridge.unsubscribeVisualization('analyzer');
    expect(backend.commands.slice(-3).map(commandType)).toEqual([
      'visualization.subscribe',
      'visualization.subscribe',
      'visualization.unsubscribe'
    ]);

    backend.fire(eventEnvelope({
      type: 'meter.frame',
      sequence: 1,
      timestamp: 10,
      peaks: [0.5, 0.25],
      rms: [0.3, 0.15]
    }));
    backend.fire(eventEnvelope({
      type: 'analyzer.frame',
      sequence: 2,
      timestamp: 20,
      sampleRate: 48_000,
      minFrequency: 93.75,
      maxFrequency: 12_000,
      encoding: 'f32-base64',
      binCount: 128,
      data: 'A'.repeat(684)
    }));
    backend.fire(eventEnvelope({
      type: 'analyzer.frame',
      sequence: 3,
      timestamp: 30,
      sampleRate: 48_000,
      minFrequency: 93.75,
      maxFrequency: 12_000,
      encoding: 'f32-base64',
      binCount: 129,
      data: ''
    }));
    expect(received.filter((event) => isRecord(event) && event['type'] === 'meter.frame')).toHaveLength(1);
    expect(received.filter((event) => isRecord(event) && event['type'] === 'analyzer.frame')).toHaveLength(1);
    bridge.dispose();
  });
});

function createRuntime(backend: JuceBackend, version = 1): JuceRuntime {
  return {
    backend,
    initialisationData: {
      easyPlugin: [{ protocolVersion: version, instanceId: 'instance', assetSource: 'embedded' }]
    }
  };
}

function readyEnvelope(): Record<string, unknown> {
  return {
    protocolVersion: 1,
    instanceId: 'instance',
    payload: {
      type: 'bridge.ready',
      protocolVersion: 1,
      capabilities: {
        ...bridgeCapabilities
      }
    }
  };
}

function generatedStateDefaults(persistence: 'plugin' | 'ui'): Record<string, unknown> {
  return Object.fromEntries(
    stateFieldMetadata
      .filter((field) => field.persistence === persistence)
      .map((field) => [field.id, structuredClone(field.default)])
  );
}

function eventEnvelope(payload: Record<string, unknown>): Record<string, unknown> {
  return { protocolVersion: 1, instanceId: 'instance', payload };
}

function commandType(value: unknown): unknown {
  return isRecord(value) && isRecord(value['payload']) ? value['payload']['type'] : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
