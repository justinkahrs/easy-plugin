import { describe, expect, it } from 'vitest';
import { getParameterMetadata } from '$lib/generated';
import {
  denormalizeParameterValue,
  getDefaultNormalizedValue,
  normalizeNumericValue
} from '$lib/parameter-values';

describe('generated parameter value conversion', () => {
  it('round-trips logarithmic and linear values through normalized host space', () => {
    for (const id of ['cutoff', 'outputGain', 'resonance'] as const) {
      const parameter = getParameterMetadata(id);
      const defaultNormalized = getDefaultNormalizedValue(parameter);
      const restored = denormalizeParameterValue(parameter, defaultNormalized);
      expect(restored).toBeTypeOf('number');
      expect(Number(restored)).toBeCloseTo(Number(parameter.default), 4);
      expect(normalizeNumericValue(parameter, Number(restored))).toBeCloseTo(defaultNormalized, 6);
    }
  });

  it('maps choice defaults to their host-visible normalized index', () => {
    expect(getDefaultNormalizedValue(getParameterMetadata('mode'))).toBe(0);
    expect(denormalizeParameterValue(getParameterMetadata('mode'), 0.5)).toBe('High-pass');
  });
});
