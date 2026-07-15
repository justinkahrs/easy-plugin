import { get } from 'svelte/store';
import { describe, expect, it } from 'vitest';
import { MockBridge } from '$lib/bridge/mock';
import { createStatePresetController } from '$lib/state-preset-store';

describe('state and preset stores', () => {
  it('hydrates plugin/UI state and follows preset lifecycle events', async () => {
    const bridge = new MockBridge();
    const controller = createStatePresetController(bridge);
    const session = await controller.initialize();

    expect(session.snapshot.schemaVersion).toBe(3);
    expect(get(controller.pluginState)).toEqual({ analyzerEnabled: true });
    expect(get(controller.uiState)).toEqual({ selectedTab: 'main' });
    expect(get(controller.presets)).toHaveLength(2);

    controller.loadPreset('factory:legacy-resonator');
    expect(get(controller.pluginState)).toEqual({ analyzerEnabled: false });
    expect(get(controller.currentPreset)).toMatchObject({
      id: 'factory:legacy-resonator',
      dirty: false
    });

    controller.setField('analyzerEnabled', true);
    expect(get(controller.currentPreset).dirty).toBe(true);
    controller.savePreset('Stored State', 'Clean');
    expect(get(controller.currentPreset)).toMatchObject({ name: 'Stored State', dirty: false });
    expect(get(controller.presets)).toHaveLength(3);

    controller.dispose();
    bridge.dispose();
  });

  it('keeps presentation-only state independent from preset audio state', async () => {
    const bridge = new MockBridge();
    const controller = createStatePresetController(bridge);
    await controller.initialize();

    controller.setField('selectedTab', 'output');
    controller.savePreset('No UI', 'Utility');
    controller.setField('selectedTab', 'main');
    const presetId = get(controller.currentPreset).id;
    expect(presetId).toBeDefined();
    controller.loadPreset(presetId ?? '');
    expect(get(controller.uiState)).toEqual({ selectedTab: 'main' });

    controller.dispose();
    bridge.dispose();
  });
});
