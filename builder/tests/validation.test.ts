import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runValidation } from '../src/validation/run.js';
import { exampleManifestSource } from './fixtures.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(async (directory) => {
    await rm(directory, { recursive: true, force: true });
  }));
});

describe('validation reports', () => {
  it('records actionable artifact and validator failures in JSON', async () => {
    const projectDirectory = await mkdtemp(path.join(tmpdir(), 'easy-plugin-validation-'));
    temporaryDirectories.push(projectDirectory);
    const manifestPath = path.join(projectDirectory, 'plugin.yaml');
    const reportPath = path.join(projectDirectory, 'reports', 'validation.json');
    await writeFile(manifestPath, exampleManifestSource, 'utf8');

    const report = await runValidation({
      projectDirectory,
      manifestPath,
      buildDirectory: path.join(projectDirectory, 'build', 'release'),
      configuration: 'Release',
      reportPath,
      buildVst3Validator: false,
      runInternalTests: false
    });

    expect(report.status).toBe('failed');
    expect(report.checks).toContainEqual(expect.objectContaining({
      id: 'vst3.artifact',
      status: 'failed',
      summary: expect.stringContaining('Build the Release plugin')
    }));
    expect(report.checks).toContainEqual(expect.objectContaining({
      id: 'vst3.validator',
      status: 'failed',
      summary: expect.stringContaining('--build-vst3-validator')
    }));
    expect(JSON.parse(await readFile(reportPath, 'utf8'))).toMatchObject({
      schemaVersion: 1,
      status: 'failed',
      plugin: { id: 'com.example.superfilter' }
    });
  });
});
