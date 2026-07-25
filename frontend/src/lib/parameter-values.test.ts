import { describe, expect, it } from 'vitest';
import { parameterMetadata, type ParameterMetadata } from '$lib/generated';
import {
  denormalizeParameterValue,
  getDefaultNormalizedValue,
  normalizeNumericValue
} from '$lib/parameter-values';

describe('generated parameter value conversion', () => {
  const generatedParameters: readonly ParameterMetadata[] = parameterMetadata;

  it('round-trips numeric values through normalized host space', () => {
    for (const parameter of generatedParameters.filter(
      (item) => item.type === 'float' || item.type === 'integer'
    )) {
      const defaultNormalized = getDefaultNormalizedValue(parameter);
      const restored = denormalizeParameterValue(parameter, defaultNormalized);
      expect(restored).toBeTypeOf('number');
      expect(Number(restored)).toBeCloseTo(Number(parameter.default), 4);
      expect(normalizeNumericValue(parameter, Number(restored))).toBeCloseTo(defaultNormalized, 6);
    }
  });

  it('maps generated choice defaults to their host-visible normalized index', () => {
    for (const parameter of generatedParameters.filter((item) => item.type === 'choice')) {
      const normalized = getDefaultNormalizedValue(parameter);
      expect(denormalizeParameterValue(parameter, normalized)).toBe(parameter.default);
    }
  });
});
