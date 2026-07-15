import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import { generateProject } from '../src/generator/generate.js';
import { generatedFileNames } from '../src/generator/render.js';
import { generatedWarning } from '../src/compatibility/snapshot.js';
import { exampleManifestSource } from './fixtures.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true }))
  );
});

describe('deterministic generated output', () => {
  test('AT-020 emits byte-identical files on repeated generation', async () => {
    const project = await createTemporaryProject();
    await generateProject({ manifestPath: project.manifestPath, outputDirectory: project.generated });
    const first = await readGenerated(project.generated);
    await generateProject({ manifestPath: project.manifestPath, outputDirectory: project.generated });
    const second = await readGenerated(project.generated);

    expect(second).toEqual(first);
    expect([...first.keys()]).toEqual([...generatedFileNames]);
  });

  test('AT-021 uses stable parameter, group, bus, and state ordering', async () => {
    const project = await createTemporaryProject();
    await generateProject({ manifestPath: project.manifestPath, outputDirectory: project.generated });
    const parameterMetadata = await readFile(
      path.join(project.generated, 'ParameterMetadata.generated.ts'),
      'utf8'
    );
    expectOrdered(parameterMetadata, ['"cutoff"', '"mode"', '"outputGain"', '"resonance"']);

    const controls = await readFile(
      path.join(project.generated, 'SvelteParameterMetadata.generated.ts'),
      'utf8'
    );
    expectOrdered(controls, ['"filter"', '"output"']);

    const busLayouts = await readFile(path.join(project.generated, 'BusLayouts.generated.cpp'), 'utf8');
    expectOrdered(busLayouts, ['layouts_input_main', 'layouts_output_main']);

    const snapshot = JSON.parse(
      await readFile(path.join(project.generated, 'CompatibilitySnapshot.generated.json'), 'utf8')
    ) as { state: { fields: Array<{ id: string }> } };
    expect(snapshot.state.fields.map((field) => field.id)).toEqual(['analyzerEnabled', 'selectedTab']);
  });

  test('AT-022 adds ownership warnings to every generated file', async () => {
    const project = await createTemporaryProject();
    await generateProject({ manifestPath: project.manifestPath, outputDirectory: project.generated });
    const files = await readGenerated(project.generated);
    for (const [name, contents] of files) {
      expect(contents, name).toContain(generatedWarning);
    }
  });

  test('AT-023 replaces only generated output and preserves user-owned sources', async () => {
    const project = await createTemporaryProject();
    const nativeFile = path.join(project.root, 'native/src/DspProcessor.cpp');
    const frontendFile = path.join(project.root, 'frontend/src/routes/+page.svelte');
    await mkdir(path.dirname(nativeFile), { recursive: true });
    await mkdir(path.dirname(frontendFile), { recursive: true });
    await writeFile(nativeFile, 'user native code\n', 'utf8');
    await writeFile(frontendFile, '<p>user frontend code</p>\n', 'utf8');

    await generateProject({ manifestPath: project.manifestPath, outputDirectory: project.generated });
    expect(await readFile(nativeFile, 'utf8')).toBe('user native code\n');
    expect(await readFile(frontendFile, 'utf8')).toBe('<p>user frontend code</p>\n');
  });

  test('AT-024 keeps C++ and TypeScript parameter ID values in parity', async () => {
    const project = await createTemporaryProject();
    await generateProject({ manifestPath: project.manifestPath, outputDirectory: project.generated });
    const cpp = await readFile(path.join(project.generated, 'Parameters.generated.h'), 'utf8');
    const typescript = await readFile(
      path.join(project.generated, 'ParameterMetadata.generated.ts'),
      'utf8'
    );
    for (const id of ['cutoff', 'mode', 'outputGain', 'resonance']) {
      expect(cpp).toContain(`= "${id}";`);
      expect(typescript).toContain(`"${id}": "${id}"`);
    }
  });

  test('generates real-time DSP helpers and versioned state/preset contracts', async () => {
    const project = await createTemporaryProject();
    await generateProject({ manifestPath: project.manifestPath, outputDirectory: project.generated });

    const dsp = await readFile(path.join(project.generated, 'DspParameters.generated.cpp'), 'utf8');
    const dspHeader = await readFile(path.join(project.generated, 'DspParameters.generated.h'), 'utf8');
    expectOrdered(dsp, ['value_cutoff', 'value_mode', 'value_outputGain', 'value_resonance']);
    expect(dspHeader).toContain('SmoothedValue');
    expect(dsp).toContain('memory_order_relaxed');

    const state = await readFile(path.join(project.generated, 'StateMetadata.generated.ts'), 'utf8');
    expect(state).toContain('stateSchemaVersion = 3');
    expectOrdered(state, ['"analyzerEnabled"', '"selectedTab"']);

    const bridge = await readFile(path.join(project.generated, 'BridgeTypes.generated.ts'), 'utf8');
    expect(bridge).toContain("type: 'state.setField'");
    expect(bridge).toContain("type: 'preset.save'");
    expect(bridge).toContain("type: 'preset.dirtyChanged'");
  });

  test('checks compatibility before replacing existing generated files', async () => {
    const project = await createTemporaryProject();
    await generateProject({ manifestPath: project.manifestPath, outputDirectory: project.generated });
    const releasedOutput = await readGenerated(project.generated);
    await writeFile(
      project.manifestPath,
      exampleManifestSource.replace('  - id: cutoff\n', '  - id: frequency\n'),
      'utf8'
    );

    await expect(
      generateProject({ manifestPath: project.manifestPath, outputDirectory: project.generated })
    ).rejects.toThrow(/parameter 'cutoff' was removed or renamed/);
    expect(await readGenerated(project.generated)).toEqual(releasedOutput);
  });
});

async function createTemporaryProject(): Promise<{
  root: string;
  manifestPath: string;
  generated: string;
}> {
  const root = await mkdtemp(path.join(tmpdir(), 'easy-plugin-builder-'));
  temporaryDirectories.push(root);
  const manifestPath = path.join(root, 'plugin.yaml');
  await writeFile(manifestPath, exampleManifestSource, 'utf8');
  return { root, manifestPath, generated: path.join(root, 'generated') };
}

async function readGenerated(directory: string): Promise<Map<string, string>> {
  const names = (await readdir(directory)).sort((left, right) => left.localeCompare(right, 'en'));
  const entries = await Promise.all(
    names.map(async (name) => [name, await readFile(path.join(directory, name), 'utf8')] as const)
  );
  return new Map(entries);
}

function expectOrdered(source: string, tokens: readonly string[]): void {
  let previous = -1;
  for (const token of tokens) {
    const index = source.indexOf(token, previous + 1);
    expect(index, `Expected ${token} after byte ${previous}.`).toBeGreaterThan(previous);
    previous = index;
  }
}
