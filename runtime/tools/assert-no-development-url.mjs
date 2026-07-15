import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const argumentsByName = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  argumentsByName.set(process.argv[index], process.argv[index + 1]);
}

const configuration = argumentsByName.get('--configuration');
const inputPath = argumentsByName.get('--path');

if (configuration === undefined || inputPath === undefined) {
  throw new Error('Usage: assert-no-development-url.mjs --configuration Release --path <binary>');
}

if (configuration.toLowerCase() !== 'release') {
  process.stdout.write(`Development URL scan skipped for ${configuration}.\n`);
  process.exit(0);
}

const contents = await readFile(resolve(inputPath));
const forbiddenValue = Buffer.from(['http:', '', 'localhost:5173'].join('/'));

if (contents.includes(forbiddenValue)) {
  throw new Error(`Release binary contains the development server URL: ${inputPath}`);
}

process.stdout.write('Release binary contains no development server URL.\n');

