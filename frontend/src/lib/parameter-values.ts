import type { ParameterMetadata } from '$lib/generated';

export function getDefaultNormalizedValue(parameter: ParameterMetadata): number {
  if (parameter.type === 'boolean') return parameter.default ? 1 : 0;
  if (parameter.type === 'choice') {
    const choices = parameter.choices ?? [];
    const index = choices.indexOf(String(parameter.default));
    return choices.length <= 1 ? 0 : Math.max(0, index) / (choices.length - 1);
  }
  return normalizeNumericValue(parameter, Number(parameter.default));
}

export function normalizeNumericValue(parameter: ParameterMetadata, value: number): number {
  if (parameter.min === null || parameter.max === null || parameter.max <= parameter.min) return 0;
  const proportion = clamp((value - parameter.min) / (parameter.max - parameter.min));
  const skew = getSkew(parameter);
  return skew === 1 ? proportion : Math.pow(proportion, skew);
}

export function denormalizeParameterValue(
  parameter: ParameterMetadata,
  normalizedValue: number
): number | boolean | string {
  const normalized = clamp(normalizedValue);
  if (parameter.type === 'boolean') return normalized >= 0.5;
  if (parameter.type === 'choice') {
    const choices = parameter.choices ?? [];
    if (choices.length === 0) return '';
    const index = Math.round(normalized * Math.max(0, choices.length - 1));
    return choices[index] ?? choices[0] ?? '';
  }
  if (parameter.min === null || parameter.max === null) return normalized;
  const skew = getSkew(parameter);
  const proportion = skew === 1 || normalized === 0 ? normalized : Math.exp(Math.log(normalized) / skew);
  const raw = parameter.min + (parameter.max - parameter.min) * proportion;
  if (parameter.type === 'integer') return Math.round(raw);
  if (parameter.step !== null && parameter.step > 0) {
    return parameter.min + Math.round((raw - parameter.min) / parameter.step) * parameter.step;
  }
  return raw;
}

export function formatParameterValue(parameter: ParameterMetadata, normalizedValue: number): string {
  const value = denormalizeParameterValue(parameter, normalizedValue);
  if (typeof value === 'boolean') return value ? 'On' : 'Off';
  if (typeof value === 'string') return value;
  const precision = parameter.precision ?? (parameter.type === 'integer' ? 0 : 2);
  const rendered = value.toFixed(precision);
  return parameter.unit === null || parameter.unit.length === 0
    ? rendered
    : `${rendered} ${parameter.unit}`;
}

function getSkew(parameter: ParameterMetadata): number {
  if (parameter.type !== 'float' || parameter.min === null || parameter.max === null) return 1;
  if (parameter.scale === 'skewed') return parameter.skew ?? 1;
  if (parameter.scale !== 'logarithmic') return 1;

  const centre = Math.sqrt(parameter.min * parameter.max);
  const centreProportion = (centre - parameter.min) / (parameter.max - parameter.min);
  return Math.log(0.5) / Math.log(centreProportion);
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}
