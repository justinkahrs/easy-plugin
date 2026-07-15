import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';
import { expect } from 'vitest';

import { ManifestValidationError } from '../src/schema/errors.js';
import { validateManifest } from '../src/schema/parse.js';

export const exampleManifestPath = fileURLToPath(
  new URL('../../plugin.example.yaml', import.meta.url)
);
export const exampleManifestSource = readFileSync(exampleManifestPath, 'utf8');

export type MutableManifest = Record<string, unknown> & {
  plugin: Record<string, unknown> & { manufacturer: Record<string, unknown> };
  platforms: Record<string, Record<string, unknown>>;
  formats: unknown[];
  buses: { inputs: Array<Record<string, unknown>>; outputs: Array<Record<string, unknown>> };
  parameters: Array<Record<string, unknown>>;
  state: { schemaVersion: number; fields: Array<Record<string, unknown>> };
};

export function mutableExampleManifest(): MutableManifest {
  return parseYaml(exampleManifestSource) as MutableManifest;
}

export function expectManifestIssue(
  mutate: (manifest: MutableManifest) => void,
  expectedPath: string,
  expectedCode: string
): ManifestValidationError {
  const value = mutableExampleManifest();
  mutate(value);
  try {
    validateManifest(value);
  } catch (error) {
    if (!(error instanceof ManifestValidationError)) throw error;
    expect(error.issues).toContainEqual(
      expect.objectContaining({ path: expectedPath, code: expectedCode })
    );
    expect(error.message).toContain(expectedPath);
    return error;
  }
  throw new Error(`Expected manifest issue ${expectedCode} at ${expectedPath}.`);
}
