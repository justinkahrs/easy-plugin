import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateProject } from './generator/generate.js';
import { runValidation } from './validation/run.js';

interface GenerateArguments {
  manifestPath?: string;
  outputDirectory?: string;
}

interface ValidateArguments {
  manifestPath?: string;
  buildDirectory?: string;
  configuration?: string;
  reportPath?: string;
  vst3ValidatorPath?: string;
  buildVst3Validator: boolean;
  runInternalTests: boolean;
}

export async function runCli(arguments_: readonly string[]): Promise<number> {
  const [command, ...rest] = arguments_;
  if (command === '--help' || command === '-h' || command === 'help') {
    printHelp();
    return 0;
  }
  if (command !== 'generate' && command !== 'validate') {
    printHelp();
    throw new Error(command === undefined ? 'A command is required.' : `Unknown command '${command}'.`);
  }


  if (command === 'validate') {
    const options = parseValidateArguments(rest);
    const projectDirectory = process.cwd();
    const reportPath = path.resolve(options.reportPath ?? 'build/validation/report.json');
    const report = await runValidation({
      projectDirectory,
      manifestPath: path.resolve(options.manifestPath ?? (await findDefaultManifest())),
      buildDirectory: path.resolve(options.buildDirectory ?? 'build/release'),
      configuration: options.configuration ?? 'Release',
      reportPath,
      vst3ValidatorPath: options.vst3ValidatorPath === undefined
        ? undefined
        : path.resolve(options.vst3ValidatorPath),
      buildVst3Validator: options.buildVst3Validator,
      runInternalTests: options.runInternalTests
    });
    for (const check of report.checks) {
      process.stdout.write(`${check.status.toUpperCase().padEnd(7)} ${check.id}: ${check.summary}\n`);
    }
    process.stdout.write(`Validation ${report.status}; report: ${reportPath}\n`);
    return report.status === 'passed' ? 0 : 1;
  }

  const options = parseGenerateArguments(rest);
  const manifestPath = path.resolve(options.manifestPath ?? (await findDefaultManifest()));
  const outputDirectory = path.resolve(options.outputDirectory ?? 'generated');
  const result = await generateProject({ manifestPath, outputDirectory });
  process.stdout.write(
    `Generated ${result.files.length} files for ${result.manifest.plugin.name} in ${result.outputDirectory}\n`
  );
  return 0;
}

function parseValidateArguments(arguments_: readonly string[]): ValidateArguments {
  const result: ValidateArguments = {
    buildVst3Validator: false,
    runInternalTests: true
  };
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--manifest' || argument === '-m') {
      result.manifestPath = requiredOptionValue(arguments_, ++index, argument);
    } else if (argument === '--build-dir') {
      result.buildDirectory = requiredOptionValue(arguments_, ++index, argument);
    } else if (argument === '--configuration') {
      result.configuration = requiredOptionValue(arguments_, ++index, argument);
    } else if (argument === '--report') {
      result.reportPath = requiredOptionValue(arguments_, ++index, argument);
    } else if (argument === '--vst3-validator') {
      result.vst3ValidatorPath = requiredOptionValue(arguments_, ++index, argument);
    } else if (argument === '--build-vst3-validator') {
      result.buildVst3Validator = true;
    } else if (argument === '--skip-internal-tests') {
      result.runInternalTests = false;
    } else {
      throw new Error(`Unknown validate option '${argument ?? ''}'.`);
    }
  }
  return result;
}

function parseGenerateArguments(arguments_: readonly string[]): GenerateArguments {
  const result: GenerateArguments = {};
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === '--manifest' || argument === '-m') {
      result.manifestPath = requiredOptionValue(arguments_, ++index, argument);
    } else if (argument === '--output' || argument === '-o') {
      result.outputDirectory = requiredOptionValue(arguments_, ++index, argument);
    } else {
      throw new Error(`Unknown generate option '${argument ?? ''}'.`);
    }
  }
  return result;
}

function requiredOptionValue(
  arguments_: readonly string[],
  index: number,
  option: string
): string {
  const value = arguments_[index];
  if (value === undefined || value.startsWith('-')) {
    throw new Error(`Option '${option}' requires a value.`);
  }
  return value;
}

async function findDefaultManifest(): Promise<string> {
  for (const candidate of ['plugin.yaml', 'plugin.example.yaml']) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Continue to the fallback or produce the actionable error below.
    }
  }
  throw new Error('No manifest found. Expected plugin.yaml or plugin.example.yaml in the current directory.');
}

function printHelp(): void {
  process.stdout.write(`Usage: plugin <command> [options]

Commands:
  generate                  Generate manifest-owned source files
  validate                  Run internal and format-specific plugin validators

Generate options:

  -m, --manifest <path>  Manifest file (defaults to plugin.yaml, then plugin.example.yaml)
  -o, --output <path>    Generated output directory (defaults to generated)

Validate options:
  -m, --manifest <path>       Manifest file
  --build-dir <path>          CMake build directory (defaults to build/release)
  --configuration <name>      Artifact configuration (defaults to Release)
  --report <path>             JSON report path (defaults to build/validation/report.json)
  --vst3-validator <path>     Existing Steinberg validator executable
  --build-vst3-validator      Build the pinned official validator before running
  --skip-internal-tests       Skip CTest (external validators still run)
`);
}

async function main(): Promise<void> {
  try {
    process.exitCode = await runCli(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

const isDirectExecution =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectExecution) await main();
