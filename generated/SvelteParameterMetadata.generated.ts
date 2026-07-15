// GENERATED FILE. DO NOT EDIT.
// Generated from the plugin manifest.

import type { ParameterId } from './ParameterMetadata.generated.js';

export type SvelteControlKind = 'slider' | 'toggle' | 'select';

export interface SvelteParameterGroupMetadata {
  readonly id: string;
  readonly name: string;
  readonly parentId: string | null;
}

export interface SvelteParameterMetadata {
  readonly id: ParameterId;
  readonly control: SvelteControlKind;
  readonly label: string;
  readonly groupId: string | null;
  readonly unit: string | null;
  readonly precision: number | null;
  readonly hidden: boolean;
  readonly advanced: boolean;
}

export const svelteParameterGroups = [
  {
    "id": "filter",
    "name": "Filter",
    "parentId": null
  },
  {
    "id": "output",
    "name": "Output",
    "parentId": null
  }
] as const satisfies readonly SvelteParameterGroupMetadata[];

export const svelteParameterMetadata = [
  {
    "id": "cutoff",
    "control": "slider",
    "label": "Cutoff",
    "groupId": "filter",
    "unit": "Hz",
    "precision": 1,
    "hidden": false,
    "advanced": false
  },
  {
    "id": "mode",
    "control": "select",
    "label": "Mode",
    "groupId": "filter",
    "unit": null,
    "precision": null,
    "hidden": false,
    "advanced": false
  },
  {
    "id": "outputGain",
    "control": "slider",
    "label": "Output",
    "groupId": "output",
    "unit": "dB",
    "precision": 1,
    "hidden": false,
    "advanced": false
  },
  {
    "id": "resonance",
    "control": "slider",
    "label": "Resonance",
    "groupId": "filter",
    "unit": null,
    "precision": 2,
    "hidden": false,
    "advanced": false
  }
] as const satisfies readonly SvelteParameterMetadata[];
