import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);
const manifestPath = path.join(projectDirectory, 'plugin.yaml');
const snapshotPath = path.join(
  projectDirectory,
  'generated',
  'CompatibilitySnapshot.generated.json'
);
const templateIdentity = {
  id: 'com.example.superfilter',
  name: 'Super Filter',
  manufacturerName: 'Example Audio',
  manufacturerCode: 'ExAu',
  pluginCode: 'SpFl',
  presetExtension: 'superfilterpreset',
  presetDirectory: 'Super Filter'
};

const [{ parseManifest }, manifestSource, snapshotSource] = await Promise.all([
  import('../../builder/dist/schema/parse.js'),
  readFile(manifestPath, 'utf8'),
  readFile(snapshotPath, 'utf8')
]);

const manifest = parseManifest(manifestSource);
const snapshot = JSON.parse(snapshotSource);
const unchangedFields = [
  manifest.plugin.id === templateIdentity.id ? 'plugin.id' : undefined,
  manifest.plugin.name === templateIdentity.name ? 'plugin.name' : undefined,
  manifest.plugin.manufacturer.name === templateIdentity.manufacturerName
    ? 'plugin.manufacturer.name'
    : undefined,
  manifest.plugin.manufacturer.code === templateIdentity.manufacturerCode
    ? 'plugin.manufacturer.code'
    : undefined,
  manifest.plugin.pluginCode === templateIdentity.pluginCode ? 'plugin.pluginCode' : undefined,
  manifest.presets.extension === templateIdentity.presetExtension
    ? 'presets.extension'
    : undefined,
  manifest.presets.userDirectoryName === templateIdentity.presetDirectory
    ? 'presets.userDirectoryName'
    : undefined
].filter(Boolean);

if (unchangedFields.length > 0) {
  throw new Error(
    `Template initialization stopped. Replace the sample values in ${unchangedFields.join(', ')} before running pnpm template:init.`
  );
}

if (
  snapshot?.plugin?.id !== templateIdentity.id ||
  snapshot?.plugin?.manufacturerCode !== templateIdentity.manufacturerCode ||
  snapshot?.plugin?.pluginCode !== templateIdentity.pluginCode
) {
  throw new Error(
    'Template initialization stopped because the compatibility snapshot no longer has the shipped sample identity. Use pnpm generate for an initialized plugin.'
  );
}

await rm(snapshotPath);
process.stdout.write(
  'Released the shipped sample identity. Generating a new compatibility baseline from plugin.yaml.\n'
);
