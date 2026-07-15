import { spawn } from 'node:child_process';
import { access, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { PluginManifest } from '../schema/model.js';
import { parseManifest } from '../schema/parse.js';

export const vst3SdkTag = 'v3.8.0_build_66' as const;
export const vst3SdkCommit = '9fad9770f2ae8542ab1a548a68c1ad1ac690abe0' as const;
export const vst3SdkRepository = 'https://github.com/steinbergmedia/vst3sdk.git' as const;

export type ValidationCheckStatus = 'passed' | 'failed' | 'skipped';

export interface ValidationCheck {
  readonly id: string;
  readonly status: ValidationCheckStatus;
  readonly summary: string;
  readonly command?: string;
  readonly output?: string;
}

export interface ValidationReport {
  readonly schemaVersion: 1;
  readonly plugin: {
    readonly id: string;
    readonly name: string;
    readonly version: string;
  };
  readonly platform: NodeJS.Platform;
  readonly architecture: string;
  readonly configuration: string;
  readonly status: 'passed' | 'failed';
  readonly checks: readonly ValidationCheck[];
}

export interface ValidationOptions {
  readonly projectDirectory: string;
  readonly manifestPath: string;
  readonly buildDirectory: string;
  readonly configuration: string;
  readonly reportPath: string;
  readonly vst3ValidatorPath?: string;
  readonly buildVst3Validator: boolean;
  readonly runInternalTests: boolean;
}

interface ProcessResult {
  readonly command: string;
  readonly exitCode: number | null;
  readonly output: string;
  readonly error?: string;
}

export async function runValidation(options: ValidationOptions): Promise<ValidationReport> {
  const manifest = parseManifest(await readFile(options.manifestPath, 'utf8'));
  const checks: ValidationCheck[] = [];

  if (options.runInternalTests) {
    checks.push(await processCheck(
      'internal.acceptance',
      'Internal loading, editor, state, automation, bus, MIDI, offline, and visualization tests passed.',
      'Internal acceptance tests failed. Run CTest with --output-on-failure and fix the named test.',
      'ctest',
      ['--test-dir', options.buildDirectory, '--build-config', options.configuration, '--output-on-failure'],
      options.projectDirectory
    ));
  } else {
    checks.push({
      id: 'internal.acceptance',
      status: 'skipped',
      summary: 'Internal CTest execution was explicitly skipped.'
    });
  }

  if (manifest.formats.includes('vst3')) {
    const vst3Path = vst3ArtifactPath(options, manifest);
    checks.push(await artifactCheck(
      'vst3.artifact',
      vst3Path,
      `Release VST3 artifact found at ${vst3Path}.`,
      `VST3 artifact is missing at ${vst3Path}. Build the ${options.configuration} plugin before validation.`
    ));

    let validatorPath = options.vst3ValidatorPath ?? process.env['VST3_VALIDATOR'];
    if (options.buildVst3Validator) {
      const bootstrap = await ensureVst3Validator(options.projectDirectory);
      checks.push(bootstrap.check);
      if (bootstrap.path !== undefined) validatorPath = bootstrap.path;
    }
    validatorPath ??= defaultVst3ValidatorPath(options.projectDirectory);

    const artifactExists = await exists(vst3Path);
    const validatorExists = await exists(validatorPath);
    if (!validatorExists) {
      checks.push({
        id: 'vst3.validator',
        status: 'failed',
        summary: `VST3 validator is missing at ${validatorPath}. Re-run with --build-vst3-validator or pass --vst3-validator <path>.`
      });
    } else if (!artifactExists) {
      checks.push({
        id: 'vst3.validator',
        status: 'failed',
        summary: 'VST3 validation could not run because the plugin artifact is missing.'
      });
    } else {
      checks.push(await processCheck(
        'vst3.validator',
        `Steinberg VST3 validator ${vst3SdkTag} passed.`,
        'Steinberg VST3 validation failed. The validator output identifies the failing suite.',
        validatorPath,
        [vst3Path],
        options.projectDirectory
      ));
    }
  }

  if (manifest.formats.includes('au')) {
    if (process.platform !== 'darwin') {
      checks.push({
        id: 'au.auval',
        status: 'skipped',
        summary: 'Audio Unit validation only runs on macOS.'
      });
    } else {
      const componentPath = auArtifactPath(options, manifest);
      checks.push(await artifactCheck(
        'au.artifact',
        componentPath,
        `Release Audio Unit artifact found at ${componentPath}.`,
        `Audio Unit artifact is missing at ${componentPath}. Build the ${options.configuration} plugin before validation.`
      ));
      checks.push(await runAudioUnitValidation(componentPath, manifest, options.projectDirectory));
    }
  }

  const report: ValidationReport = {
    schemaVersion: 1,
    plugin: {
      id: manifest.plugin.id,
      name: manifest.plugin.name,
      version: manifest.plugin.version
    },
    platform: process.platform,
    architecture: process.arch,
    configuration: options.configuration,
    status: checks.some((check) => check.status === 'failed') ? 'failed' : 'passed',
    checks
  };
  await mkdir(path.dirname(options.reportPath), { recursive: true });
  await writeFile(options.reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return report;
}

async function ensureVst3Validator(
  projectDirectory: string
): Promise<{ readonly check: ValidationCheck; readonly path?: string }> {
  const toolsDirectory = path.join(projectDirectory, 'build', 'validation-tools');
  const sourceDirectory = path.join(toolsDirectory, 'vst3sdk-source');
  const buildDirectory = path.join(toolsDirectory, 'vst3sdk-build');
  const validatorPath = defaultVst3ValidatorPath(projectDirectory);
  await mkdir(toolsDirectory, { recursive: true });

  if (!(await exists(path.join(sourceDirectory, '.git')))) {
    const clone = await runProcess(
      'git',
      ['clone', '--depth', '1', '--branch', vst3SdkTag, '--recursive', vst3SdkRepository, sourceDirectory],
      projectDirectory
    );
    if (clone.exitCode !== 0) {
      return {
        check: {
          id: 'vst3.validator-bootstrap',
          status: 'failed',
          summary: 'Could not clone the pinned Steinberg VST3 SDK validator source.',
          command: clone.command,
          output: formatProcessOutput(clone)
        }
      };
    }
  }

  const revision = await runProcess('git', ['-C', sourceDirectory, 'rev-parse', 'HEAD'], projectDirectory);
  if (revision.exitCode !== 0 || revision.output.trim() !== vst3SdkCommit) {
    return {
      check: {
        id: 'vst3.validator-bootstrap',
        status: 'failed',
        summary: `VST3 SDK source is not the pinned ${vst3SdkTag} commit ${vst3SdkCommit}. Remove ${sourceDirectory} and retry.`,
        command: revision.command,
        output: formatProcessOutput(revision)
      }
    };
  }

  const configure = await runProcess(
    'cmake',
    [
      '-S', sourceDirectory,
      '-B', buildDirectory,
      '-DCMAKE_BUILD_TYPE=Release',
      '-DSMTG_ENABLE_VST3_PLUGIN_EXAMPLES=OFF',
      '-DSMTG_ENABLE_VST3_HOSTING_EXAMPLES=ON',
      '-DSMTG_ENABLE_VSTGUI_SUPPORT=OFF'
    ],
    projectDirectory
  );
  if (configure.exitCode !== 0) {
    return { check: failedBootstrap('configure', configure) };
  }

  const build = await runProcess(
    'cmake',
    ['--build', buildDirectory, '--target', 'validator', '--config', 'Release', '--parallel', '2'],
    projectDirectory
  );
  if (build.exitCode !== 0 || !(await exists(validatorPath))) {
    return { check: failedBootstrap('build', build) };
  }

  return {
    path: validatorPath,
    check: {
      id: 'vst3.validator-bootstrap',
      status: 'passed',
      summary: `Pinned Steinberg VST3 validator ${vst3SdkTag} is available.`,
      command: build.command
    }
  };
}

function failedBootstrap(stage: string, result: ProcessResult): ValidationCheck {
  return {
    id: 'vst3.validator-bootstrap',
    status: 'failed',
    summary: `Could not ${stage} the pinned Steinberg VST3 validator.`,
    command: result.command,
    output: formatProcessOutput(result)
  };
}

async function runAudioUnitValidation(
  componentPath: string,
  manifest: PluginManifest,
  projectDirectory: string
): Promise<ValidationCheck> {
  if (!(await exists(componentPath))) {
    return {
      id: 'au.auval',
      status: 'failed',
      summary: 'Audio Unit validation could not run because the component artifact is missing.'
    };
  }

  const componentsDirectory = path.join(
    process.env['HOME'] ?? projectDirectory,
    'Library', 'Audio', 'Plug-Ins', 'Components'
  );
  const stagedName = `EasyPluginValidation-${process.pid}-${slug(manifest.plugin.name)}.component`;
  const stagedPath = path.join(componentsDirectory, stagedName);
  await mkdir(componentsDirectory, { recursive: true });

  try {
    if (await exists(stagedPath)) {
      return {
        id: 'au.auval',
        status: 'failed',
        summary: `Refusing to replace the existing validation staging path ${stagedPath}. Remove it manually and retry.`
      };
    }
    await cp(componentPath, stagedPath, { recursive: true, preserveTimestamps: true });

    await runProcess('/usr/bin/killall', ['-9', 'AudioComponentRegistrar'], projectDirectory);
    await delay(500);
    return await processCheck(
      'au.auval',
      'Apple auval passed the Audio Unit.',
      'Apple auval failed. Its output identifies the failing discovery or render test.',
      '/usr/bin/auval',
      ['-v', audioUnitType(manifest), manifest.plugin.pluginCode, manifest.plugin.manufacturer.code],
      projectDirectory
    );
  } finally {
    await rm(stagedPath, { recursive: true, force: true });
    await runProcess('/usr/bin/killall', ['-9', 'AudioComponentRegistrar'], projectDirectory);
  }
}

function audioUnitType(manifest: PluginManifest): string {
  if (manifest.plugin.midiEffect) return 'aumi';
  if (manifest.plugin.synth || manifest.plugin.type === 'instrument' || manifest.plugin.type === 'midi-instrument') {
    return 'aumu';
  }
  return 'aufx';
}

async function artifactCheck(
  id: string,
  artifactPath: string,
  passedSummary: string,
  failedSummary: string
): Promise<ValidationCheck> {
  return await exists(artifactPath)
    ? { id, status: 'passed', summary: passedSummary }
    : { id, status: 'failed', summary: failedSummary };
}

async function processCheck(
  id: string,
  passedSummary: string,
  failedSummary: string,
  executable: string,
  arguments_: readonly string[],
  cwd: string
): Promise<ValidationCheck> {
  const result = await runProcess(executable, arguments_, cwd);
  return result.exitCode === 0
    ? { id, status: 'passed', summary: passedSummary, command: result.command }
    : {
        id,
        status: 'failed',
        summary: result.error === undefined ? failedSummary : `${failedSummary} ${result.error}`,
        command: result.command,
        output: formatProcessOutput(result)
      };
}

async function runProcess(
  executable: string,
  arguments_: readonly string[],
  cwd: string
): Promise<ProcessResult> {
  const command = [executable, ...arguments_].map(displayArgument).join(' ');
  return await new Promise<ProcessResult>((resolve) => {
    const child = spawn(executable, arguments_, {
      cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });
    let output = '';
    const append = (chunk: Buffer): void => {
      output += chunk.toString('utf8');
      if (output.length > 262_144) output = output.slice(-262_144);
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    child.once('error', (error) => resolve({ command, exitCode: null, output, error: error.message }));
    child.once('close', (exitCode) => resolve({ command, exitCode, output }));
  });
}

function formatProcessOutput(result: ProcessResult): string | undefined {
  const combined = [result.error, result.output.trim()].filter(Boolean).join('\n');
  if (combined.length === 0) return undefined;
  return combined.length <= 32_768 ? combined : combined.slice(-32_768);
}

function displayArgument(value: string): string {
  return /^[A-Za-z0-9_./:=+-]+$/.test(value) ? value : JSON.stringify(value);
}

function vst3ArtifactPath(options: ValidationOptions, manifest: PluginManifest): string {
  return path.join(
    options.buildDirectory,
    'EasyPluginPlugin_artefacts',
    options.configuration,
    'VST3',
    `${manifest.plugin.name}.vst3`
  );
}

function auArtifactPath(options: ValidationOptions, manifest: PluginManifest): string {
  return path.join(
    options.buildDirectory,
    'EasyPluginPlugin_artefacts',
    options.configuration,
    'AU',
    `${manifest.plugin.name}.component`
  );
}

function defaultVst3ValidatorPath(projectDirectory: string): string {
  return path.join(
    projectDirectory,
    'build',
    'validation-tools',
    'vst3sdk-build',
    'bin',
    'Release',
    process.platform === 'win32' ? 'validator.exe' : 'validator'
  );
}

async function exists(candidate: string): Promise<boolean> {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'plugin';
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}
