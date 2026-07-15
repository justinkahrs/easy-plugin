import { get } from 'svelte/store';
import { describe, expect, it } from 'vitest';
import { createParameterController } from '$lib/parameter-store';
import { MockBridge } from './mock';
import type { NativeEvent, PresetListEvent, PresetSavedEvent } from '$lib/generated';

describe('MockBridge parameter runtime', () => {
  it('initializes with a complete state snapshot and answers ping', async () => {
    const bridge = new MockBridge('test-instance');
    const session = await bridge.initialize();

    expect(session).toMatchObject({
      protocolVersion: 1,
      instanceId: 'test-instance',
      mode: 'mock',
      assetSource: 'browser',
      snapshot: { schemaVersion: 3, pluginState: { analyzerEnabled: true } }
    });
    expect(Object.keys(session.snapshot.parameters)).toEqual([
      'cutoff',
      'mode',
      'outputGain',
      'resonance'
    ]);
    await expect(bridge.ping()).resolves.toBeGreaterThan(0);

    bridge.dispose();
    await expect(bridge.ping()).rejects.toThrow('disposed');
  });

  it('records continuous and discrete gesture boundaries', () => {
    const bridge = new MockBridge();
    bridge.beginParameterGesture('cutoff');
    bridge.setParameterNormalized('cutoff', 0.25);
    bridge.setParameterNormalized('cutoff', 0.5);
    bridge.endParameterGesture('cutoff');

    expect(bridge.getGestureLog()).toEqual([
      { type: 'begin', parameterId: 'cutoff' },
      { type: 'update', parameterId: 'cutoff', value: 0.25 },
      { type: 'update', parameterId: 'cutoff', value: 0.5 },
      { type: 'end', parameterId: 'cutoff' }
    ]);
  });

  it('updates parameter stores for UI and host changes', async () => {
    const bridge = new MockBridge();
    const controller = createParameterController(bridge);
    await controller.initialize();

    controller.setDiscrete('mode', 0.5);
    expect(get(controller.values).mode).toBe(0.5);
    expect(bridge.getGestureLog().slice(-3)).toEqual([
      { type: 'begin', parameterId: 'mode' },
      { type: 'update', parameterId: 'mode', value: 0.5 },
      { type: 'end', parameterId: 'mode' }
    ]);

    bridge.simulateHostParameterChange('cutoff', 0.75);
    expect(get(controller.values).cutoff).toBe(0.75);

    controller.dispose();
    bridge.dispose();
  });

  it('keeps simultaneous mock instances isolated', async () => {
    const first = new MockBridge('first');
    const second = new MockBridge('second');
    first.setParameterNormalized('resonance', 0.1);

    expect((await first.requestStateSnapshot()).parameters.resonance).toBe(0.1);
    expect((await second.requestStateSnapshot()).parameters.resonance).not.toBe(0.1);
  });

  it('round-trips presets, protects factory presets, and tracks dirty state', async () => {
    const bridge = new MockBridge();
    const events: NativeEvent[] = [];
    bridge.subscribe((event) => events.push(event));

    bridge.listPresets();
    const list = events.find((event): event is PresetListEvent => event.type === 'preset.list');
    expect(list?.presets).toHaveLength(2);

    bridge.loadPreset('factory:legacy-resonator');
    expect((await bridge.requestStateSnapshot())).toMatchObject({
      parameters: { cutoff: 0.43 },
      pluginState: { analyzerEnabled: false },
      preset: { id: 'factory:legacy-resonator', dirty: false }
    });

    bridge.setParameterNormalized('cutoff', 0.7);
    expect((await bridge.requestStateSnapshot()).preset?.dirty).toBe(true);

    bridge.deletePreset('factory:legacy-resonator');
    expect(events.at(-1)).toMatchObject({ type: 'error', code: 'factory-preset-protected' });

    bridge.setStateField('analyzerEnabled', true);
    bridge.savePreset('My Preset', 'Clean', ['test']);
    const saved = events.findLast((event): event is PresetSavedEvent => event.type === 'preset.saved');
    expect(saved?.presetId).toMatch(/^user:/);
    bridge.setStateField('analyzerEnabled', false);
    bridge.loadPreset(String(saved?.presetId));
    expect((await bridge.requestStateSnapshot()).pluginState).toEqual({ analyzerEnabled: true });
  });
});
