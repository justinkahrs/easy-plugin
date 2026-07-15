// GENERATED FILE. DO NOT EDIT.
// Generated from the plugin manifest.

export const parameterIds = {
  "cutoff": "cutoff",
  "mode": "mode",
  "outputGain": "outputGain",
  "resonance": "resonance"
} as const;

export type ParameterId = (typeof parameterIds)[keyof typeof parameterIds];
export type ParameterType = 'float' | 'integer' | 'boolean' | 'choice';
export type ParameterScale = 'linear' | 'logarithmic' | 'skewed';
export type SmoothingType = 'none' | 'linear' | 'multiplicative';

export interface ParameterMetadata {
  readonly id: ParameterId;
  readonly version: number;
  readonly name: string;
  readonly type: ParameterType;
  readonly groupId: string | null;
  readonly default: number | boolean | string;
  readonly min: number | null;
  readonly max: number | null;
  readonly step: number | null;
  readonly choices: readonly string[] | null;
  readonly unit: string | null;
  readonly precision: number | null;
  readonly scale: ParameterScale | null;
  readonly skew: number | null;
  readonly smoothing: Readonly<{ type: SmoothingType; milliseconds: number }> | null;
  readonly automatable: boolean;
  readonly hidden: boolean;
  readonly advanced: boolean;
  readonly formatter: string | null;
  readonly parser: string | null;
}

export const parameterMetadata = [
  {
    "id": "cutoff",
    "version": 1,
    "name": "Cutoff",
    "type": "float",
    "groupId": "filter",
    "default": 1000,
    "min": 20,
    "max": 20000,
    "step": 0,
    "choices": null,
    "unit": "Hz",
    "precision": 1,
    "scale": "logarithmic",
    "skew": null,
    "smoothing": {
      "type": "multiplicative",
      "milliseconds": 30
    },
    "automatable": true,
    "hidden": false,
    "advanced": false,
    "formatter": null,
    "parser": null
  },
  {
    "id": "mode",
    "version": 1,
    "name": "Mode",
    "type": "choice",
    "groupId": "filter",
    "default": "Low-pass",
    "min": null,
    "max": null,
    "step": null,
    "choices": [
      "Low-pass",
      "High-pass",
      "Band-pass"
    ],
    "unit": null,
    "precision": null,
    "scale": null,
    "skew": null,
    "smoothing": null,
    "automatable": true,
    "hidden": false,
    "advanced": false,
    "formatter": null,
    "parser": null
  },
  {
    "id": "outputGain",
    "version": 1,
    "name": "Output",
    "type": "float",
    "groupId": "output",
    "default": 0,
    "min": -24,
    "max": 12,
    "step": 0.1,
    "choices": null,
    "unit": "dB",
    "precision": 1,
    "scale": "linear",
    "skew": null,
    "smoothing": {
      "type": "linear",
      "milliseconds": 20
    },
    "automatable": true,
    "hidden": false,
    "advanced": false,
    "formatter": null,
    "parser": null
  },
  {
    "id": "resonance",
    "version": 1,
    "name": "Resonance",
    "type": "float",
    "groupId": "filter",
    "default": 0.7,
    "min": 0.1,
    "max": 10,
    "step": 0,
    "choices": null,
    "unit": null,
    "precision": 2,
    "scale": "linear",
    "skew": null,
    "smoothing": {
      "type": "linear",
      "milliseconds": 20
    },
    "automatable": true,
    "hidden": false,
    "advanced": false,
    "formatter": null,
    "parser": null
  }
] as const satisfies readonly ParameterMetadata[];

export function getParameterMetadata(id: ParameterId): ParameterMetadata {
  const result = parameterMetadata.find((parameter) => parameter.id === id);
  if (result === undefined) throw new Error(`Unknown generated parameter ID: ${id}`);
  return result;
}
