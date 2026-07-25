import { get } from 'svelte/store';
import { describe, expect, it } from 'vitest';
import {
  parameterMetadata,
  stateFieldMetadata,
  stateSchemaVersion,
  type NativeEvent,
  type PresetListEvent,
  type PresetSavedEvent
} from '$lib/generated';
import { createParameterController } from '$lib/parameter-store';
import { MockBridge } from './mock';

const firstParameter = parameterMetadata[0];
if (firstParameter === undefined) throw new Error('The template fixture requires one parameter.');

describe('MockBridge parameter runtime', () => {
  it('initializes with a complete generated state snapshot and answers ping', async () => {
    const bridge = new MockBridge('test-instance');
    const session = await bridge.initialize();

    expect(session).toMatchObject({
      protocolVersion: 1,
      instanceId: 'test-instance',
      mode: 'mock',
      assetSource: 'browser',
      snapshot: {
        schemaVersion: stateSchemaVersion,
        pluginState: generatedStateDefaults('plugin')
      }
    });
    expect(Object.keys(session.snapshot.parameters)).toEqual(
      parameterMetadata.map((parameter) => parameter.id)
    );
    await expect(bridge.ping()).resolves.toBeGreaterThan(0);

    bridge.dispose();
    await expect(bridge.ping()).rejects.toThrow('disposed');
  });

  it('records gesture boundaries for generated parameter IDs', () => {
    const bridge = new MockBridge();
    bridge.beginParameterGesture(firstParameter.id);
    bridge.setParameterNormalized(firstParameter.id, 0.25);
    bridge.setParameterNormalized(firstParameter.id, 0.5);
    bridge.endParameterGesture(firstParameter.id);

    expect(bridge.getGestureLog()).toEqual([
      { type: 'begin', parameterId: firstParameter.id },
      { type: 'update', parameterId: firstParameter.id, value: 0.25 },
      { type: 'update', parameterId: firstParameter.id, value: 0.5 },
      { type: 'end', parameterId: firstParameter.id }
    ]);
  });

  it('updates parameter stores for UI and host changes', async () => {
    const bridge = new MockBridge();
    const controller = createParameterController(bridge);
    await controller.initialize();

    controller.setDiscrete(firstParameter.id, 0.5);
    expect(get(controller.values)[firstParameter.id]).toBe(0.5);
    expect(bridge.getGestureLog().slice(-3)).toEqual([
      { type: 'begin', parameterId: firstParameter.id },
      { type: 'update', parameterId: firstParameter.id, value: 0.5 },
      { type: 'end', parameterId: firstParameter.id }
    ]);

    bridge.simulateHostParameterChange(firstParameter.id, 0.75);
    expect(get(controller.values)[firstParameter.id]).toBe(0.75);

    controller.dispose();
    bridge.dispose();
  });

  it('keeps simultaneous mock instances isolated', async () => {
    const first = new MockBridge('first');
    const second = new MockBridge('second');
    first.setParameterNormalized(firstParameter.id, 0.1);

    expect((await first.requestStateSnapshot()).parameters[firstParameter.id]).toBe(0.1);
    expect((await second.requestStateSnapshot()).parameters[firstParameter.id]).not.toBe(0.1);
  });

  it('round-trips presets, protects factory presets, and tracks dirty state', async () => {
    const bridge = new MockBridge();
    const events: NativeEvent[] = [];
    bridge.subscribe((event) => events.push(event));

    bridge.listPresets();
    const list = events.find((event): event is PresetListEvent => event.type === 'preset.list');
    expect(list?.presets).toHaveLength(1);

    bridge.loadPreset('factory:default');
    expect((await bridge.requestStateSnapshot()).preset).toMatchObject({
      id: 'factory:default',
      dirty: false
    });

    bridge.setParameterNormalized(firstParameter.id, 0.7);
    expect((await bridge.requestStateSnapshot()).preset?.dirty).toBe(true);

    bridge.deletePreset('factory:default');
    expect(events.at(-1)).toMatchObject({ type: 'error', code: 'factory-preset-protected' });

    bridge.savePreset('My Preset', 'Clean', ['test']);
    const saved = events.findLast((event): event is PresetSavedEvent => event.type === 'preset.saved');
    expect(saved?.presetId).toMatch(/^user:/);
    bridge.setParameterNormalized(firstParameter.id, 0.2);
    bridge.loadPreset(String(saved?.presetId));
    expect((await bridge.requestStateSnapshot()).parameters[firstParameter.id]).toBe(0.7);
  });
});

function generatedStateDefaults(persistence: 'plugin' | 'ui'): Record<string, unknown> {
  return Object.fromEntries(
    stateFieldMetadata
      .filter((field) => field.persistence === persistence)
      .map((field) => [field.id, structuredClone(field.default)])
  );
}
