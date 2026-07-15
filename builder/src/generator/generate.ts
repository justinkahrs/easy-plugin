import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  assertCompatible,
  compatibilitySnapshotFileName,
  parseCompatibilitySnapshot
} from '../compatibility/snapshot.js';
import { parseManifest } from '../schema/parse.js';
import type { PluginManifest } from '../schema/model.js';
import { generatedFileNames, renderGeneratedFiles } from './render.js';

export interface GenerateOptions {
  manifestPath: string;
  outputDirectory: string;
}

export interface GenerateResult {
  manifest: PluginManifest;
  outputDirectory: string;
  files: readonly string[];
}

export async function generateProject(options: GenerateOptions): Promise<GenerateResult> {
  const manifestPath = path.resolve(options.manifestPath);
  const outputDirectory = path.resolve(options.outputDirectory);
  const source = await readFile(manifestPath, 'utf8');
  const manifest = parseManifest(source);
  await assertExistingOutputIsCompatible(outputDirectory, manifest);

  const renderedFiles = renderGeneratedFiles(manifest);
  assertCompleteFileSet(renderedFiles);
  await replaceGeneratedDirectory(outputDirectory, renderedFiles);

  return {
    manifest,
    outputDirectory,
    files: [...renderedFiles.keys()]
  };
}

async function assertExistingOutputIsCompatible(
  outputDirectory: string,
  manifest: PluginManifest
): Promise<void> {
  const snapshotPath = path.join(outputDirectory, compatibilitySnapshotFileName);
  try {
    const source = await readFile(snapshotPath, 'utf8');
    assertCompatible(manifest, parseCompatibilitySnapshot(source));
  } catch (error) {
    if (isMissingFileError(error)) return;
    throw error;
  }
}

async function replaceGeneratedDirectory(
  outputDirectory: string,
  files: ReadonlyMap<string, string>
): Promise<void> {
  const parentDirectory = path.dirname(outputDirectory);
  const temporaryDirectory = `${outputDirectory}.tmp-${process.pid}`;
  const backupDirectory = `${outputDirectory}.backup-${process.pid}`;

  await mkdir(parentDirectory, { recursive: true });
  await rm(temporaryDirectory, { force: true, recursive: true });
  await rm(backupDirectory, { force: true, recursive: true });
  await mkdir(temporaryDirectory, { recursive: true });

  try {
    for (const [fileName, contents] of files) {
      await writeFile(path.join(temporaryDirectory, fileName), contents, 'utf8');
    }

    let movedExistingOutput = false;
    try {
      await rename(outputDirectory, backupDirectory);
      movedExistingOutput = true;
    } catch (error) {
      if (!isMissingFileError(error)) throw error;
    }

    try {
      await rename(temporaryDirectory, outputDirectory);
      if (movedExistingOutput) await rm(backupDirectory, { force: true, recursive: true });
    } catch (error) {
      if (movedExistingOutput) await rename(backupDirectory, outputDirectory);
      throw error;
    }
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
    await rm(backupDirectory, { force: true, recursive: true });
  }
}

function assertCompleteFileSet(files: ReadonlyMap<string, string>): void {
  const expected = [...generatedFileNames];
  const actual = [...files.keys()];
  if (expected.length !== actual.length || expected.some((name, index) => name !== actual[index])) {
    throw new Error(`Generator renderer returned an unexpected file set: ${actual.join(', ')}`);
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}
