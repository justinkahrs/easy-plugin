import type {
  BridgeErrorEvent,
  PresetInfo,
  RuntimeBridge,
  RuntimeSession,
  StateFieldId
} from '$lib/bridge/types';
import { stateFieldMetadata } from '$lib/generated';
import { writable, type Readable } from 'svelte/store';

export interface PresetStatus {
  readonly id?: string;
  readonly name?: string;
  readonly dirty: boolean;
}

export interface StatePresetController {
  readonly pluginState: Readable<Readonly<Record<string, unknown>>>;
  readonly uiState: Readable<Readonly<Record<string, unknown>>>;
  readonly presets: Readable<readonly PresetInfo[]>;
  readonly currentPreset: Readable<PresetStatus>;
  readonly error: Readable<BridgeErrorEvent | undefined>;
  initialize(): Promise<RuntimeSession>;
  setField(fieldId: StateFieldId, value: unknown): void;
  loadPreset(presetId: string): void;
  savePreset(name: string, category?: string, tags?: readonly string[]): void;
  deletePreset(presetId: string): void;
  refreshPresets(): void;
  dispose(): void;
}

export function createStatePresetController(bridge: RuntimeBridge): StatePresetController {
  const pluginState = writable<Readonly<Record<string, unknown>>>(createDefaults('plugin'));
  const uiState = writable<Readonly<Record<string, unknown>>>(createDefaults('ui'));
  const presets = writable<readonly PresetInfo[]>([]);
  const currentPreset = writable<PresetStatus>({ dirty: false });
  const error = writable<BridgeErrorEvent | undefined>(undefined);

  const unsubscribe = bridge.subscribe((event) => {
    if (event.type === 'state.snapshot') {
      pluginState.set(event.pluginState);
      uiState.set(event.uiState ?? createDefaults('ui'));
      currentPreset.set(event.preset ?? { dirty: false });
    } else if (event.type === 'state.fieldChanged') {
      const metadata = stateFieldMetadata.find((field) => field.id === event.fieldId);
      const target = metadata?.persistence === 'ui' ? uiState : pluginState;
      target.update((current) => ({ ...current, [event.fieldId]: event.value }));
    } else if (event.type === 'preset.list') {
      presets.set(event.presets);
    } else if (event.type === 'preset.loaded' || event.type === 'preset.saved') {
      currentPreset.set({ id: event.presetId, name: event.name, dirty: false });
    } else if (event.type === 'preset.deleted') {
      currentPreset.update((current) => current.id === event.presetId ? { dirty: false } : current);
    } else if (event.type === 'preset.dirtyChanged') {
      currentPreset.update((current) => ({ ...current, dirty: event.dirty }));
    } else if (event.type === 'error') {
      error.set(event);
    }
  });

  return {
    pluginState: { subscribe: pluginState.subscribe },
    uiState: { subscribe: uiState.subscribe },
    presets: { subscribe: presets.subscribe },
    currentPreset: { subscribe: currentPreset.subscribe },
    error: { subscribe: error.subscribe },

    async initialize(): Promise<RuntimeSession> {
      const session = await bridge.initialize();
      pluginState.set(session.snapshot.pluginState);
      uiState.set(session.snapshot.uiState ?? createDefaults('ui'));
      currentPreset.set(session.snapshot.preset ?? { dirty: false });
      bridge.listPresets();
      return session;
    },

    setField(fieldId: StateFieldId, value: unknown): void {
      error.set(undefined);
      const metadata = stateFieldMetadata.find((field) => field.id === fieldId);
      const target = metadata?.persistence === 'ui' ? uiState : pluginState;
      target.update((current) => ({ ...current, [fieldId]: value }));
      bridge.setStateField(fieldId, value);
    },

    loadPreset(presetId: string): void {
      error.set(undefined);
      bridge.loadPreset(presetId);
    },

    savePreset(name: string, category?: string, tags?: readonly string[]): void {
      error.set(undefined);
      bridge.savePreset(name, category, tags);
    },

    deletePreset(presetId: string): void {
      error.set(undefined);
      bridge.deletePreset(presetId);
    },

    refreshPresets(): void {
      bridge.listPresets();
    },

    dispose(): void {
      unsubscribe();
    }
  };
}

function createDefaults(persistence: 'plugin' | 'ui'): Record<string, unknown> {
  return Object.fromEntries(
    stateFieldMetadata
      .filter((field) => field.persistence === persistence)
      .map((field) => [field.id, structuredClone(field.default)])
  );
}
