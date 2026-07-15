import { describe, expect, test } from 'vitest';

import {
  assertCompatible,
  createCompatibilitySnapshot
} from '../src/compatibility/snapshot.js';
import { CompatibilityError } from '../src/schema/errors.js';
import { validateManifest } from '../src/schema/parse.js';
import { mutableExampleManifest } from './fixtures.js';

describe('released manifest compatibility', () => {
  test('AT-025 rejects a released parameter ID change', () => {
    const previous = createCompatibilitySnapshot(validateManifest(mutableExampleManifest()));
    const changed = mutableExampleManifest();
    changed.parameters[0]!.id = 'frequency';
    const current = validateManifest(changed);

    expect(() => assertCompatible(current, previous)).toThrowError(CompatibilityError);
    try {
      assertCompatible(current, previous);
    } catch (error) {
      expect((error as CompatibilityError).issues).toContainEqual(
        expect.objectContaining({ path: 'parameters', code: 'parameter_removed_or_renamed' })
      );
    }
  });

  test('AT-026 rejects a released parameter type change', () => {
    const previous = createCompatibilitySnapshot(validateManifest(mutableExampleManifest()));
    const changed = mutableExampleManifest();
    Object.assign(changed.parameters[0]!, {
      type: 'integer',
      min: 20,
      max: 20_000,
      default: 1_000,
      step: 1
    });
    delete changed.parameters[0]!.scale;
    delete changed.parameters[0]!.smoothing;
    const current = validateManifest(changed);

    try {
      assertCompatible(current, previous);
      throw new Error('Expected a compatibility failure.');
    } catch (error) {
      expect(error).toBeInstanceOf(CompatibilityError);
      expect((error as CompatibilityError).issues).toContainEqual(
        expect.objectContaining({ path: 'parameters[0].type', code: 'parameter_type_changed' })
      );
    }
  });

  test('allows display and grouping changes while preserving IDs and types', () => {
    const previous = createCompatibilitySnapshot(validateManifest(mutableExampleManifest()));
    const changed = mutableExampleManifest();
    changed.parameters[0]!.name = 'Frequency';
    changed.parameters[0]!.group = 'output';
    expect(() => assertCompatible(validateManifest(changed), previous)).not.toThrow();
  });

  test('rejects plugin identity changes and malformed snapshots', async () => {
    const { parseCompatibilitySnapshot } = await import('../src/compatibility/snapshot.js');
    const previous = createCompatibilitySnapshot(validateManifest(mutableExampleManifest()));
    const changed = mutableExampleManifest();
    changed.plugin.pluginCode = 'Diff';
    expect(() => assertCompatible(validateManifest(changed), previous)).toThrowError(
      /plugin\.pluginCode/
    );
    expect(() => parseCompatibilitySnapshot('{bad')).toThrowError(CompatibilityError);
  });
});
