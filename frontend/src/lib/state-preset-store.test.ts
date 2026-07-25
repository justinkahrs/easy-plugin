import { get } from 'svelte/store';
import { describe, expect, it } from 'vitest';
import { MockBridge } from '$lib/bridge/mock';
import { parameterMetadata, stateFieldMetadata, stateSchemaVersion } from '$lib/generated';
import { createStatePresetController } from '$lib/state-preset-store';

const firstParameter = parameterMetadata[0];
if (firstParameter === undefined) throw new Error('The template fixture requires one parameter.');

describe('state and preset stores', () => {
  it('hydrates generated state and follows preset lifecycle events', async () => {
    const bridge = new MockBridge();
    const controller = createStatePresetController(bridge);
    const session = await controller.initialize();

    expect(session.snapshot.schemaVersion).toBe(stateSchemaVersion);
    expect(get(controller.pluginState)).toEqual(generatedStateDefaults('plugin'));
    expect(get(controller.uiState)).toEqual(generatedStateDefaults('ui'));
    expect(get(controller.presets)).toHaveLength(1);

    controller.loadPreset('factory:default');
    expect(get(controller.currentPreset)).toMatchObject({
      id: 'factory:default',
      dirty: false
    });

    bridge.setParameterNormalized(firstParameter.id, 0.73);
    expect(get(controller.currentPreset).dirty).toBe(true);
    controller.savePreset('Stored State', 'Clean');
    expect(get(controller.currentPreset)).toMatchObject({ name: 'Stored State', dirty: false });
    expect(get(controller.presets)).toHaveLength(2);

    controller.dispose();
    bridge.dispose();
  });

  it('keeps presentation-only state independent from preset audio state', async () => {
    const bridge = new MockBridge();
    const controller = createStatePresetController(bridge);
    await controller.initialize();

    const uiField = stateFieldMetadata.find((field) => field.persistence === 'ui');
    if (uiField === undefined) {
      expect(get(controller.uiState)).toEqual({});
    } else {
      const original = structuredClone(uiField.default);
      const changed = differentValue(uiField.default);
      controller.setField(uiField.id, changed);
      controller.savePreset('No UI', 'Utility');
      controller.setField(uiField.id, original);
      const presetId = get(controller.currentPreset).id;
      expect(presetId).toBeDefined();
      controller.loadPreset(presetId ?? '');
      expect(get(controller.uiState)[uiField.id]).toEqual(original);
    }

    controller.dispose();
    bridge.dispose();
  });
});

function generatedStateDefaults(persistence: 'plugin' | 'ui'): Record<string, unknown> {
  return Object.fromEntries(
    stateFieldMetadata
      .filter((field) => field.persistence === persistence)
      .map((field) => [field.id, structuredClone(field.default)])
  );
}

function differentValue(value: unknown): unknown {
  if (typeof value === 'boolean') return !value;
  if (typeof value === 'number') return value + 1;
  if (typeof value === 'string') return `${value}-changed`;
  if (Array.isArray(value)) return [...value, 'changed'];
  return { changed: true };
}
