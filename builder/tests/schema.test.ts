import { describe, expect, test } from 'vitest';

import { ManifestValidationError } from '../src/schema/errors.js';
import { parseManifest } from '../src/schema/parse.js';
import {
  exampleManifestSource,
  expectManifestIssue,
  mutableExampleManifest
} from './fixtures.js';

describe('manifest schema validation', () => {
  test('AT-010 parses and normalizes the valid YAML example', () => {
    const manifest = parseManifest(exampleManifestSource);
    expect(manifest.plugin.id).toBe('com.example.superfilter');
    expect(manifest.parameters.map((parameter) => parameter.id)).toEqual([
      'cutoff',
      'resonance',
      'mode',
      'outputGain'
    ]);
  });

  test('reports duplicate YAML keys at the manifest path', () => {
    expect(() => parseManifest('schemaVersion: 1\nschemaVersion: 1\n')).toThrowError(
      ManifestValidationError
    );
    try {
      parseManifest('schemaVersion: 1\nschemaVersion: 1\n');
    } catch (error) {
      expect(error).toBeInstanceOf(ManifestValidationError);
      expect((error as ManifestValidationError).issues[0]).toEqual(
        expect.objectContaining({ path: 'manifest', code: 'invalid_yaml' })
      );
    }
  });

  test('rejects manifests that require a newer builder', () => {
    expectManifestIssue(
      (manifest) => {
        const builder = manifest['builder'] as Record<string, unknown>;
        builder['minimumVersion'] = '99.0.0';
      },
      'builder.minimumVersion',
      'incompatible_builder_version'
    );
  });

  test('AT-011 rejects duplicate parameter IDs', () => {
    expectManifestIssue(
      (manifest) => manifest.parameters.push({ ...manifest.parameters[0] }),
      'parameters[4].id',
      'duplicate_parameter_id'
    );
  });

  test('AT-012 rejects numeric defaults outside the declared range', () => {
    expectManifestIssue(
      (manifest) => {
        manifest.parameters[0]!.default = 99_999;
      },
      'parameters[0].default',
      'default_out_of_range'
    );
  });

  test('AT-013 rejects choice defaults absent from the choice list', () => {
    expectManifestIssue(
      (manifest) => {
        manifest.parameters[2]!.default = 'Not a mode';
      },
      'parameters[2].default',
      'invalid_choice_default'
    );
  });

  test('AT-014 rejects logarithmic ranges with non-positive minima', () => {
    expectManifestIssue(
      (manifest) => {
        manifest.parameters[0]!.min = 0;
      },
      'parameters[0].min',
      'invalid_logarithmic_range'
    );
  });

  test('AT-015 rejects smoothing on a non-float parameter', () => {
    expectManifestIssue(
      (manifest) => {
        manifest.parameters[2]!.smoothing = { type: 'linear', milliseconds: 10 };
      },
      'parameters[2].smoothing',
      'invalid_smoothing'
    );
  });

  test('rejects negative and invalid multiplicative smoothing', () => {
    expectManifestIssue(
      (manifest) => {
        manifest.parameters[0]!.smoothing = { type: 'linear', milliseconds: -1 };
      },
      'parameters[0].smoothing.milliseconds',
      'invalid_smoothing_time'
    );
    expectManifestIssue(
      (manifest) => {
        manifest.parameters[3]!.smoothing = { type: 'multiplicative', milliseconds: 10 };
      },
      'parameters[3].smoothing.type',
      'invalid_multiplicative_smoothing'
    );
  });

  test('AT-016 rejects manufacturer and plugin identity codes that are not four ASCII characters', () => {
    expectManifestIssue(
      (manifest) => {
        manifest.plugin.manufacturer.code = 'ABC';
      },
      'plugin.manufacturer.code',
      'invalid_identity_code'
    );
    expectManifestIssue(
      (manifest) => {
        manifest.plugin.pluginCode = 'ÅBCD';
      },
      'plugin.pluginCode',
      'invalid_identity_code'
    );
  });

  test('AT-017 rejects Audio Unit when macOS is disabled', () => {
    expectManifestIssue(
      (manifest) => {
        manifest.platforms.macos!.enabled = false;
      },
      'formats[1]',
      'invalid_format_platform'
    );
  });

  test('rejects unknown formats and enabled Linux', () => {
    expectManifestIssue(
      (manifest) => manifest.formats.push('lv2'),
      'formats[3]',
      'unsupported_value'
    );
    expectManifestIssue(
      (manifest) => {
        manifest.platforms.linux!.enabled = true;
      },
      'platforms.linux.enabled',
      'unsupported_platform'
    );
  });

  test('AT-018 rejects sidechain outputs and required sidechain inputs', () => {
    expectManifestIssue(
      (manifest) => {
        manifest.buses.outputs[0]!.role = 'sidechain';
      },
      'buses.outputs[0].role',
      'invalid_sidechain_output'
    );

    expectManifestIssue(
      (manifest) => {
        manifest.buses.inputs.push({
          id: 'sidechain',
          name: 'Sidechain',
          role: 'sidechain',
          optional: false,
          layouts: ['mono', 'stereo']
        });
      },
      'buses.inputs[1].optional',
      'required_sidechain'
    );
  });

  test('rejects unsupported disabled bus combinations', () => {
    expectManifestIssue(
      (manifest) => {
        manifest.buses.inputs[0]!.layouts = ['none', 'stereo'];
      },
      'buses.inputs[0].layouts',
      'mixed_disabled_layout'
    );
    expectManifestIssue(
      (manifest) => {
        manifest.buses.inputs[0]!.layouts = ['none'];
      },
      'buses.inputs[0].layouts',
      'required_disabled_bus'
    );
  });

  test('AT-019 rejects state and parameter ID collisions', () => {
    expectManifestIssue(
      (manifest) => {
        manifest.state.fields[0]!.id = 'cutoff';
      },
      'state.fields[0].id',
      'state_parameter_collision'
    );
  });

  test('validation issue ordering is deterministic', () => {
    const invalid = mutableExampleManifest();
    invalid.plugin.pluginCode = 'x';
    invalid.parameters[0]!.default = 99_999;

    let paths: string[] = [];
    try {
      parseManifest(JSON.stringify(invalid));
    } catch (error) {
      expect(error).toBeInstanceOf(ManifestValidationError);
      paths = (error as ManifestValidationError).issues.map((issue) => issue.path);
    }
    expect(paths).toEqual([...paths].sort((left, right) => left.localeCompare(right, 'en')));
  });
});
