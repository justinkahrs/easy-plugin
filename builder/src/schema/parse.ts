import { parseDocument } from 'yaml';

import { ManifestValidationError, type ValidationIssue } from './errors.js';
import {
  builderVersion,
  supportedSchemaVersion,
  type BooleanParameter,
  type BuildConfiguration,
  type BusDefinition,
  type BusRole,
  type ChannelLayout,
  type ChoiceParameter,
  type FeatureConfiguration,
  type FloatParameter,
  type IntegerParameter,
  type ParameterBase,
  type ParameterDefinition,
  type ParameterGroup,
  type ParameterScale,
  type PlatformConfiguration,
  type PluginFormat,
  type PluginIdentity,
  type PluginManifest,
  type PluginType,
  type PresetConfiguration,
  type SmoothingType,
  type StateField,
  type StateFieldType,
  type StatePersistence,
  type UiConfiguration,
  type UiRenderer
} from './model.js';

type UnknownRecord = Record<string, unknown>;

const identifierPattern = /^[A-Za-z][A-Za-z0-9._-]*$/;
const reverseDomainPattern = /^[A-Za-z][A-Za-z0-9-]*(?:\.[A-Za-z0-9][A-Za-z0-9-]*)+$/;
const semanticVersionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const toolVersionPattern = /^\d+(?:\.\d+){0,2}(?:-[0-9A-Za-z.-]+)?$/;
const fourAsciiCharactersPattern = /^[\x20-\x7e]{4}$/;

const pluginTypes = [
  'effect',
  'instrument',
  'midi-instrument',
  'analyzer',
  'sidechain-effect'
] as const satisfies readonly PluginType[];
const pluginFormats = ['vst3', 'au', 'standalone'] as const satisfies readonly PluginFormat[];
const busRoles = ['main', 'sidechain', 'auxiliary'] as const satisfies readonly BusRole[];
const channelLayouts = ['none', 'mono', 'stereo'] as const satisfies readonly ChannelLayout[];
const parameterScales = ['linear', 'logarithmic', 'skewed'] as const satisfies readonly ParameterScale[];
const smoothingTypes = ['none', 'linear', 'multiplicative'] as const satisfies readonly SmoothingType[];
const stateTypes = [
  'boolean',
  'integer',
  'float',
  'string',
  'string-array',
  'number-array',
  'object'
] as const satisfies readonly StateFieldType[];
const statePersistence = ['plugin', 'ui'] as const satisfies readonly StatePersistence[];
const uiRenderers = ['dom', 'canvas', 'webgl', 'mixed'] as const satisfies readonly UiRenderer[];

class Reader {
  readonly issues: ValidationIssue[] = [];

  issue(path: string, code: string, message: string): void {
    this.issues.push({ path, code, message });
  }

  record(value: unknown, path: string): UnknownRecord {
    if (!isRecord(value)) {
      this.issue(path, 'expected_object', 'must be an object.');
      return {};
    }
    return value;
  }

  childRecord(parent: UnknownRecord, key: string, path: string): UnknownRecord {
    if (!(key in parent)) {
      this.issue(path, 'required', 'is required.');
      return {};
    }
    return this.record(parent[key], path);
  }

  array(value: unknown, path: string): unknown[] {
    if (!Array.isArray(value)) {
      this.issue(path, 'expected_array', 'must be an array.');
      return [];
    }
    return value;
  }

  childArray(parent: UnknownRecord, key: string, path: string): unknown[] {
    if (!(key in parent)) {
      this.issue(path, 'required', 'is required.');
      return [];
    }
    return this.array(parent[key], path);
  }

  string(value: unknown, path: string, options: { allowEmpty?: boolean } = {}): string {
    if (typeof value !== 'string') {
      this.issue(path, 'expected_string', 'must be a string.');
      return '';
    }
    if (!options.allowEmpty && value.trim().length === 0) {
      this.issue(path, 'empty_string', 'must not be empty.');
    }
    return value;
  }

  childString(parent: UnknownRecord, key: string, path: string): string {
    if (!(key in parent)) {
      this.issue(path, 'required', 'is required.');
      return '';
    }
    return this.string(parent[key], path);
  }

  optionalString(parent: UnknownRecord, key: string, path: string): string | undefined {
    if (!(key in parent) || parent[key] === undefined) return undefined;
    return this.string(parent[key], path);
  }

  boolean(value: unknown, path: string): boolean {
    if (typeof value !== 'boolean') {
      this.issue(path, 'expected_boolean', 'must be a boolean.');
      return false;
    }
    return value;
  }

  childBoolean(parent: UnknownRecord, key: string, path: string): boolean {
    if (!(key in parent)) {
      this.issue(path, 'required', 'is required.');
      return false;
    }
    return this.boolean(parent[key], path);
  }

  optionalBoolean(parent: UnknownRecord, key: string, path: string, fallback: boolean): boolean {
    if (!(key in parent) || parent[key] === undefined) return fallback;
    return this.boolean(parent[key], path);
  }

  number(value: unknown, path: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      this.issue(path, 'expected_finite_number', 'must be a finite number.');
      return 0;
    }
    return value;
  }

  childNumber(parent: UnknownRecord, key: string, path: string): number {
    if (!(key in parent)) {
      this.issue(path, 'required', 'is required.');
      return 0;
    }
    return this.number(parent[key], path);
  }

  optionalNumber(parent: UnknownRecord, key: string, path: string): number | undefined {
    if (!(key in parent) || parent[key] === undefined) return undefined;
    return this.number(parent[key], path);
  }

  integer(value: unknown, path: string): number {
    const result = this.number(value, path);
    if (!Number.isInteger(result)) {
      this.issue(path, 'expected_integer', 'must be an integer.');
    }
    return result;
  }

  childInteger(parent: UnknownRecord, key: string, path: string): number {
    if (!(key in parent)) {
      this.issue(path, 'required', 'is required.');
      return 0;
    }
    return this.integer(parent[key], path);
  }

  optionalInteger(parent: UnknownRecord, key: string, path: string): number | undefined {
    if (!(key in parent) || parent[key] === undefined) return undefined;
    return this.integer(parent[key], path);
  }

  enumValue<const T extends string>(
    value: unknown,
    path: string,
    supported: readonly T[]
  ): T | undefined {
    if (typeof value !== 'string') {
      this.issue(path, 'expected_string', `must be one of: ${supported.join(', ')}.`);
      return undefined;
    }
    if (!supported.includes(value as T)) {
      this.issue(path, 'unsupported_value', `must be one of: ${supported.join(', ')}.`);
      return undefined;
    }
    return value as T;
  }
}

export function parseManifest(source: string): PluginManifest {
  const document = parseDocument(source, { prettyErrors: true, strict: true, uniqueKeys: true });

  if (document.errors.length > 0) {
    const issues = document.errors.map((error) => ({
      path: 'manifest',
      code: 'invalid_yaml',
      message: error.message.replaceAll('\n', ' ')
    }));
    throw new ManifestValidationError(issues);
  }

  let value: unknown;
  try {
    value = document.toJS({ maxAliasCount: 100 });
  } catch (error) {
    throw new ManifestValidationError([
      {
        path: 'manifest',
        code: 'invalid_yaml_value',
        message: error instanceof Error ? error.message : 'could not be converted to data.'
      }
    ]);
  }

  return validateManifest(value);
}

export function validateManifest(value: unknown): PluginManifest {
  const reader = new Reader();
  const root = reader.record(value, 'manifest');

  const schemaVersion = reader.childInteger(root, 'schemaVersion', 'schemaVersion');
  if (schemaVersion !== supportedSchemaVersion) {
    reader.issue(
      'schemaVersion',
      'unsupported_schema_version',
      `must be ${supportedSchemaVersion}; received ${schemaVersion}.`
    );
  }

  const builderObject = reader.childRecord(root, 'builder', 'builder');
  const minimumVersion = reader.childString(builderObject, 'minimumVersion', 'builder.minimumVersion');
  const projectVersion = reader.childString(builderObject, 'projectVersion', 'builder.projectVersion');
  validateVersion(reader, minimumVersion, 'builder.minimumVersion', semanticVersionPattern);
  validateVersion(reader, projectVersion, 'builder.projectVersion', semanticVersionPattern);
  if (
    semanticVersionPattern.test(minimumVersion) &&
    compareSemanticVersions(minimumVersion, builderVersion) > 0
  ) {
    reader.issue(
      'builder.minimumVersion',
      'incompatible_builder_version',
      `requires builder ${minimumVersion} or newer; current version is ${builderVersion}.`
    );
  }
  const templateCommit = reader.optionalString(builderObject, 'templateCommit', 'builder.templateCommit');

  const plugin = parsePlugin(reader, reader.childRecord(root, 'plugin', 'plugin'));
  const platforms = parsePlatforms(reader, reader.childRecord(root, 'platforms', 'platforms'));
  const formats = parseFormats(reader, root, platforms.macos.enabled);
  const buses = parseBuses(reader, reader.childRecord(root, 'buses', 'buses'), plugin.type);
  const parameterGroups = parseParameterGroups(reader, root);
  const parameters = parseParameters(reader, root, parameterGroups);
  const state = parseState(reader, reader.childRecord(root, 'state', 'state'), parameters);
  const ui = parseUi(reader, reader.childRecord(root, 'ui', 'ui'));
  const presets = parsePresets(reader, reader.childRecord(root, 'presets', 'presets'));
  const build = parseBuild(reader, reader.childRecord(root, 'build', 'build'));
  const features = parseFeatures(reader, reader.childRecord(root, 'features', 'features'));

  validateFeatureConsistency(reader, plugin, buses.inputs, features);

  if (reader.issues.length > 0) {
    throw new ManifestValidationError(reader.issues);
  }

  return {
    schemaVersion: supportedSchemaVersion,
    builder: {
      minimumVersion,
      projectVersion,
      ...(templateCommit === undefined ? {} : { templateCommit })
    },
    plugin,
    platforms,
    formats,
    buses,
    parameterGroups,
    parameters,
    state,
    ui,
    presets,
    build,
    features
  };
}

function parsePlugin(reader: Reader, object: UnknownRecord): PluginIdentity {
  const manufacturer = reader.childRecord(object, 'manufacturer', 'plugin.manufacturer');
  const id = reader.childString(object, 'id', 'plugin.id');
  const manufacturerCode = reader.childString(manufacturer, 'code', 'plugin.manufacturer.code');
  const pluginCode = reader.childString(object, 'pluginCode', 'plugin.pluginCode');
  const version = reader.childString(object, 'version', 'plugin.version');
  const type = reader.enumValue(object['type'], 'plugin.type', pluginTypes) ?? 'effect';

  if (!reverseDomainPattern.test(id)) {
    reader.issue('plugin.id', 'invalid_plugin_id', 'must use reverse-domain notation.');
  }
  validateIdentityCode(reader, manufacturerCode, 'plugin.manufacturer.code');
  validateIdentityCode(reader, pluginCode, 'plugin.pluginCode');
  validateVersion(reader, version, 'plugin.version', semanticVersionPattern);
  const description = reader.optionalString(object, 'description', 'plugin.description');
  const category = reader.optionalString(object, 'category', 'plugin.category');

  return {
    id,
    name: reader.childString(object, 'name', 'plugin.name'),
    ...(description === undefined ? {} : { description }),
    manufacturer: {
      name: reader.childString(manufacturer, 'name', 'plugin.manufacturer.name'),
      code: manufacturerCode
    },
    pluginCode,
    version,
    type,
    ...(category === undefined ? {} : { category }),
    midiInput: reader.optionalBoolean(object, 'midiInput', 'plugin.midiInput', false),
    midiOutput: reader.optionalBoolean(object, 'midiOutput', 'plugin.midiOutput', false),
    midiEffect: reader.optionalBoolean(object, 'midiEffect', 'plugin.midiEffect', false),
    synth: reader.optionalBoolean(object, 'synth', 'plugin.synth', false)
  };
}

function parsePlatforms(
  reader: Reader,
  object: UnknownRecord
): PluginManifest['platforms'] {
  const windows = parsePlatform(
    reader,
    reader.childRecord(object, 'windows', 'platforms.windows'),
    'platforms.windows',
    ['x86_64'],
    false
  );
  const macos = parsePlatform(
    reader,
    reader.childRecord(object, 'macos', 'platforms.macos'),
    'platforms.macos',
    ['arm64', 'x86_64'],
    true
  );
  const linux = parsePlatform(
    reader,
    reader.childRecord(object, 'linux', 'platforms.linux'),
    'platforms.linux',
    [],
    false
  );

  if (linux.enabled) {
    reader.issue('platforms.linux.enabled', 'unsupported_platform', 'Linux is not supported in the first release.');
  }

  return { windows, macos, linux };
}

function parsePlatform(
  reader: Reader,
  object: UnknownRecord,
  path: string,
  supportedArchitectures: readonly string[],
  supportsUniversalBinary: boolean
): PlatformConfiguration {
  const enabled = reader.childBoolean(object, 'enabled', `${path}.enabled`);
  const architectureValues = 'architectures' in object
    ? reader.array(object['architectures'], `${path}.architectures`)
    : [];
  const architectures = architectureValues.map((value, index) =>
    reader.string(value, `${path}.architectures[${index}]`)
  );
  validateUniqueStrings(reader, architectures, `${path}.architectures`, 'duplicate_architecture');

  for (const [index, architecture] of architectures.entries()) {
    if (!supportedArchitectures.includes(architecture)) {
      reader.issue(
        `${path}.architectures[${index}]`,
        'unsupported_architecture',
        `is not supported for ${path.replace('platforms.', '')}.`
      );
    }
  }

  if (enabled && supportedArchitectures.length > 0 && architectures.length === 0) {
    reader.issue(`${path}.architectures`, 'missing_architecture', 'must contain at least one architecture when enabled.');
  }

  const universalBinary = reader.optionalBoolean(
    object,
    'universalBinary',
    `${path}.universalBinary`,
    false
  );
  if (!supportsUniversalBinary && universalBinary) {
    reader.issue(`${path}.universalBinary`, 'unsupported_option', 'is supported only on macOS.');
  }

  return { enabled, architectures, ...(supportsUniversalBinary ? { universalBinary } : {}) };
}

function parseFormats(reader: Reader, root: UnknownRecord, macosEnabled: boolean): PluginFormat[] {
  const values = reader.childArray(root, 'formats', 'formats');
  const formats = values
    .map((value, index) => reader.enumValue(value, `formats[${index}]`, pluginFormats))
    .filter((value): value is PluginFormat => value !== undefined);
  validateUniqueStrings(reader, formats, 'formats', 'duplicate_format');

  if (formats.length === 0) {
    reader.issue('formats', 'missing_format', 'must contain at least one supported format.');
  }
  const audioUnitIndex = formats.indexOf('au');
  if (audioUnitIndex >= 0 && !macosEnabled) {
    reader.issue(
      `formats[${audioUnitIndex}]`,
      'invalid_format_platform',
      'Audio Unit requires platforms.macos.enabled to be true.'
    );
  }
  return formats;
}

function parseBuses(
  reader: Reader,
  object: UnknownRecord,
  pluginType: PluginType
): PluginManifest['buses'] {
  const inputs = parseBusDirection(reader, object, 'inputs');
  const outputs = parseBusDirection(reader, object, 'outputs');
  const mainOutputs = outputs.filter((bus) => bus.role === 'main');

  if (mainOutputs.length !== 1) {
    reader.issue('buses.outputs', 'invalid_main_output_count', 'must contain exactly one main output bus.');
  }
  if (mainOutputs.some((bus) => bus.optional)) {
    reader.issue('buses.outputs', 'optional_main_output', 'the main output bus must not be optional.');
  }
  if (!['instrument', 'midi-instrument'].includes(pluginType) && inputs.length === 0) {
    reader.issue('buses.inputs', 'missing_input_bus', `${pluginType} plugins require an input bus.`);
  }

  return { inputs, outputs };
}

function parseBusDirection(
  reader: Reader,
  busesObject: UnknownRecord,
  direction: 'inputs' | 'outputs'
): BusDefinition[] {
  const basePath = `buses.${direction}`;
  const values = reader.childArray(busesObject, direction, basePath);
  const buses = values.map((value, index) => {
    const path = `${basePath}[${index}]`;
    const object = reader.record(value, path);
    const id = reader.childString(object, 'id', `${path}.id`);
    const role = reader.enumValue(object['role'], `${path}.role`, busRoles) ?? 'auxiliary';
    const optional = reader.childBoolean(object, 'optional', `${path}.optional`);
    const layoutValues = reader.childArray(object, 'layouts', `${path}.layouts`);
    const layouts = layoutValues
      .map((layout, layoutIndex) =>
        reader.enumValue(layout, `${path}.layouts[${layoutIndex}]`, channelLayouts)
      )
      .filter((layout): layout is ChannelLayout => layout !== undefined);

    validateIdentifier(reader, id, `${path}.id`);
    validateUniqueStrings(reader, layouts, `${path}.layouts`, 'duplicate_bus_layout');
    if (layouts.length === 0) {
      reader.issue(`${path}.layouts`, 'missing_bus_layout', 'must contain at least one channel layout.');
    }
    if (layouts.includes('none') && layouts.length > 1) {
      reader.issue(`${path}.layouts`, 'mixed_disabled_layout', '`none` cannot be combined with active layouts.');
    }
    if (layouts.includes('none') && !optional) {
      reader.issue(
        `${path}.layouts`,
        'required_disabled_bus',
        'a bus whose only layout is `none` must be optional.'
      );
    }
    if (role === 'sidechain' && direction === 'outputs') {
      reader.issue(`${path}.role`, 'invalid_sidechain_output', 'sidechain buses must be inputs.');
    }
    if (role === 'sidechain' && !optional) {
      reader.issue(`${path}.optional`, 'required_sidechain', 'sidechain input buses must be optional.');
    }

    return {
      id,
      name: reader.childString(object, 'name', `${path}.name`),
      role,
      optional,
      layouts
    };
  });

  validateUniqueIds(reader, buses, basePath, 'duplicate_bus_id');
  return buses;
}

function parseParameterGroups(reader: Reader, root: UnknownRecord): ParameterGroup[] {
  const values = reader.childArray(root, 'parameterGroups', 'parameterGroups');
  const groups = values.map((value, index) => {
    const path = `parameterGroups[${index}]`;
    const object = reader.record(value, path);
    const id = reader.childString(object, 'id', `${path}.id`);
    validateIdentifier(reader, id, `${path}.id`);
    const parentId = reader.optionalString(object, 'parentId', `${path}.parentId`);
    return {
      id,
      name: reader.childString(object, 'name', `${path}.name`),
      ...(parentId === undefined ? {} : { parentId })
    };
  });

  validateUniqueIds(reader, groups, 'parameterGroups', 'duplicate_parameter_group_id');
  const ids = new Set(groups.map((group) => group.id));
  for (const [index, group] of groups.entries()) {
    if (group.parentId !== undefined && !ids.has(group.parentId)) {
      reader.issue(
        `parameterGroups[${index}].parentId`,
        'unknown_parent_group',
        `references unknown group '${group.parentId}'.`
      );
    }
  }
  validateGroupCycles(reader, groups);
  return groups;
}

function parseParameters(
  reader: Reader,
  root: UnknownRecord,
  groups: readonly ParameterGroup[]
): ParameterDefinition[] {
  const values = reader.childArray(root, 'parameters', 'parameters');
  const groupIds = new Set(groups.map((group) => group.id));
  const parameters = values
    .map((value, index) => parseParameter(reader, value, index, groupIds))
    .filter((value): value is ParameterDefinition => value !== undefined);

  validateUniqueIds(reader, parameters, 'parameters', 'duplicate_parameter_id');
  return parameters;
}

function parseParameter(
  reader: Reader,
  value: unknown,
  index: number,
  groupIds: ReadonlySet<string>
): ParameterDefinition | undefined {
  const path = `parameters[${index}]`;
  const object = reader.record(value, path);
  const id = reader.childString(object, 'id', `${path}.id`);
  const parameterType = reader.enumValue(
    object['type'],
    `${path}.type`,
    ['float', 'integer', 'boolean', 'choice'] as const
  );
  validateIdentifier(reader, id, `${path}.id`);
  if (parameterType === undefined) return undefined;

  const version = reader.childInteger(object, 'version', `${path}.version`);
  if (version < 1) reader.issue(`${path}.version`, 'invalid_parameter_version', 'must be at least 1.');
  const group = reader.optionalString(object, 'group', `${path}.group`);
  if (group !== undefined && !groupIds.has(group)) {
    reader.issue(`${path}.group`, 'unknown_parameter_group', `references unknown group '${group}'.`);
  }
  const precision = reader.optionalInteger(object, 'precision', `${path}.precision`);
  const unit = reader.optionalString(object, 'unit', `${path}.unit`);
  const formatter = reader.optionalString(object, 'formatter', `${path}.formatter`);
  const parser = reader.optionalString(object, 'parser', `${path}.parser`);
  if (precision !== undefined && precision < 0) {
    reader.issue(`${path}.precision`, 'invalid_precision', 'must be non-negative.');
  }

  const base: ParameterBase = {
    id,
    version,
    name: reader.childString(object, 'name', `${path}.name`),
    ...(group === undefined ? {} : { group }),
    automatable: reader.optionalBoolean(object, 'automatable', `${path}.automatable`, true),
    hidden: reader.optionalBoolean(object, 'hidden', `${path}.hidden`, false),
    advanced: reader.optionalBoolean(object, 'advanced', `${path}.advanced`, false),
    ...(unit === undefined ? {} : { unit }),
    ...(precision === undefined ? {} : { precision }),
    ...(formatter === undefined ? {} : { formatter }),
    ...(parser === undefined ? {} : { parser })
  };

  if (parameterType === 'float') return parseFloatParameter(reader, object, path, base);
  if (parameterType === 'integer') return parseIntegerParameter(reader, object, path, base);
  if ('smoothing' in object) {
    reader.issue(`${path}.smoothing`, 'invalid_smoothing', 'smoothing is valid only for float parameters.');
  }
  if (parameterType === 'boolean') {
    return {
      ...base,
      type: 'boolean',
      default: reader.boolean(object['default'], `${path}.default`)
    } satisfies BooleanParameter;
  }

  const choiceValues = reader.childArray(object, 'choices', `${path}.choices`);
  const choices = choiceValues.map((choice, choiceIndex) =>
    reader.string(choice, `${path}.choices[${choiceIndex}]`)
  );
  validateUniqueStrings(reader, choices, `${path}.choices`, 'duplicate_choice');
  if (choices.length === 0) {
    reader.issue(`${path}.choices`, 'empty_choice_list', 'must contain at least one choice.');
  }
  const defaultValue = reader.string(object['default'], `${path}.default`);
  if (!choices.includes(defaultValue)) {
    reader.issue(`${path}.default`, 'invalid_choice_default', `must be one of: ${choices.join(', ')}.`);
  }
  return { ...base, type: 'choice', choices, default: defaultValue } satisfies ChoiceParameter;
}

function parseFloatParameter(
  reader: Reader,
  object: UnknownRecord,
  path: string,
  base: ParameterBase
): FloatParameter {
  const min = reader.childNumber(object, 'min', `${path}.min`);
  const max = reader.childNumber(object, 'max', `${path}.max`);
  const defaultValue = reader.childNumber(object, 'default', `${path}.default`);
  const step = 'step' in object ? reader.number(object['step'], `${path}.step`) : 0;
  const scale = 'scale' in object
    ? reader.enumValue(object['scale'], `${path}.scale`, parameterScales) ?? 'linear'
    : 'linear';
  const skew = reader.optionalNumber(object, 'skew', `${path}.skew`);

  validateNumericRange(reader, path, min, max, defaultValue);
  if (step < 0 || step > max - min) {
    reader.issue(`${path}.step`, 'invalid_float_step', 'must be between 0 and the parameter range.');
  }
  if (scale === 'logarithmic' && min <= 0) {
    reader.issue(`${path}.min`, 'invalid_logarithmic_range', 'must be greater than zero for logarithmic scale.');
  }
  if (scale === 'skewed' && (skew === undefined || skew <= 0)) {
    reader.issue(`${path}.skew`, 'invalid_skew', 'must be a positive number for skewed scale.');
  }

  const smoothing = parseSmoothing(reader, object, path, min);
  return {
    ...base,
    type: 'float',
    min,
    max,
    default: defaultValue,
    step,
    scale,
    ...(skew === undefined ? {} : { skew }),
    ...(smoothing === undefined ? {} : { smoothing })
  };
}

function parseIntegerParameter(
  reader: Reader,
  object: UnknownRecord,
  path: string,
  base: ParameterBase
): IntegerParameter {
  const min = reader.childInteger(object, 'min', `${path}.min`);
  const max = reader.childInteger(object, 'max', `${path}.max`);
  const defaultValue = reader.childInteger(object, 'default', `${path}.default`);
  const step = reader.childInteger(object, 'step', `${path}.step`);
  validateNumericRange(reader, path, min, max, defaultValue);

  if (step <= 0 || step > max - min) {
    reader.issue(`${path}.step`, 'invalid_integer_step', 'must be a positive integer within the parameter range.');
  } else {
    if ((max - min) % step !== 0) {
      reader.issue(`${path}.step`, 'invalid_integer_step', 'must divide the parameter range evenly.');
    }
    if ((defaultValue - min) % step !== 0) {
      reader.issue(`${path}.default`, 'unaligned_integer_default', 'must align to min plus a whole number of steps.');
    }
  }
  if ('smoothing' in object) {
    reader.issue(`${path}.smoothing`, 'invalid_smoothing', 'smoothing is valid only for float parameters.');
  }

  return { ...base, type: 'integer', min, max, default: defaultValue, step };
}

function parseSmoothing(
  reader: Reader,
  object: UnknownRecord,
  parameterPath: string,
  min: number
): FloatParameter['smoothing'] {
  if (!('smoothing' in object) || object['smoothing'] === undefined) return undefined;
  const path = `${parameterPath}.smoothing`;
  const smoothing = reader.record(object['smoothing'], path);
  const type = reader.enumValue(smoothing['type'], `${path}.type`, smoothingTypes) ?? 'none';
  const milliseconds = reader.childNumber(smoothing, 'milliseconds', `${path}.milliseconds`);
  if (milliseconds < 0) {
    reader.issue(`${path}.milliseconds`, 'invalid_smoothing_time', 'must be non-negative.');
  }
  if (type === 'multiplicative' && min <= 0) {
    reader.issue(
      `${path}.type`,
      'invalid_multiplicative_smoothing',
      'requires a parameter range with a positive minimum.'
    );
  }
  return { type, milliseconds };
}

function parseState(
  reader: Reader,
  object: UnknownRecord,
  parameters: readonly ParameterDefinition[]
): PluginManifest['state'] {
  const schemaVersion = reader.childInteger(object, 'schemaVersion', 'state.schemaVersion');
  if (schemaVersion < 1) {
    reader.issue('state.schemaVersion', 'invalid_state_schema_version', 'must be at least 1.');
  }
  const values = reader.childArray(object, 'fields', 'state.fields');
  const fields = values.map((value, index) => parseStateField(reader, value, index));
  validateUniqueIds(reader, fields, 'state.fields', 'duplicate_state_field_id');

  const parameterIds = new Set(parameters.map((parameter) => parameter.id));
  for (const [index, field] of fields.entries()) {
    if (parameterIds.has(field.id)) {
      reader.issue(
        `state.fields[${index}].id`,
        'state_parameter_collision',
        `collides with parameter ID '${field.id}'.`
      );
    }
  }
  return { schemaVersion, fields };
}

function parseStateField(reader: Reader, value: unknown, index: number): StateField {
  const path = `state.fields[${index}]`;
  const object = reader.record(value, path);
  const id = reader.childString(object, 'id', `${path}.id`);
  validateIdentifier(reader, id, `${path}.id`);
  const type = reader.enumValue(object['type'], `${path}.type`, stateTypes) ?? 'string';
  const persistence =
    reader.enumValue(object['persistence'], `${path}.persistence`, statePersistence) ?? 'plugin';
  if (!('default' in object)) {
    reader.issue(`${path}.default`, 'required', 'is required.');
  }
  const defaultValue = object['default'];
  validateStateDefault(reader, defaultValue, type, `${path}.default`);
  return { id, type, default: defaultValue, persistence };
}

function parseUi(reader: Reader, object: UnknownRecord): UiConfiguration {
  const framework = reader.childString(object, 'framework', 'ui.framework');
  if (framework !== 'sveltekit') {
    reader.issue('ui.framework', 'unsupported_ui_framework', 'must be sveltekit.');
  }
  const width = reader.childInteger(object, 'width', 'ui.width');
  const height = reader.childInteger(object, 'height', 'ui.height');
  const minWidth = reader.childInteger(object, 'minWidth', 'ui.minWidth');
  const minHeight = reader.childInteger(object, 'minHeight', 'ui.minHeight');
  const maxWidth = reader.childInteger(object, 'maxWidth', 'ui.maxWidth');
  const maxHeight = reader.childInteger(object, 'maxHeight', 'ui.maxHeight');
  const defaultZoom = reader.childNumber(object, 'defaultZoom', 'ui.defaultZoom');
  const minZoom = reader.childNumber(object, 'minZoom', 'ui.minZoom');
  const maxZoom = reader.childNumber(object, 'maxZoom', 'ui.maxZoom');
  const aspectRatio = reader.optionalNumber(object, 'aspectRatio', 'ui.aspectRatio');
  const renderer = reader.enumValue(object['renderer'], 'ui.renderer', uiRenderers) ?? 'dom';

  for (const [path, dimension] of [
    ['ui.width', width],
    ['ui.height', height],
    ['ui.minWidth', minWidth],
    ['ui.minHeight', minHeight],
    ['ui.maxWidth', maxWidth],
    ['ui.maxHeight', maxHeight]
  ] as const) {
    if (dimension <= 0) reader.issue(path, 'invalid_ui_dimension', 'must be positive.');
  }
  if (minWidth > width) reader.issue('ui.minWidth', 'invalid_ui_bounds', 'must not exceed ui.width.');
  if (minHeight > height) reader.issue('ui.minHeight', 'invalid_ui_bounds', 'must not exceed ui.height.');
  if (maxWidth < width) reader.issue('ui.maxWidth', 'invalid_ui_bounds', 'must not be less than ui.width.');
  if (maxHeight < height) reader.issue('ui.maxHeight', 'invalid_ui_bounds', 'must not be less than ui.height.');
  if (minZoom <= 0 || defaultZoom <= 0 || maxZoom <= 0 || minZoom > defaultZoom || defaultZoom > maxZoom) {
    reader.issue('ui.defaultZoom', 'invalid_zoom_bounds', 'must be positive and between ui.minZoom and ui.maxZoom.');
  }
  if (aspectRatio !== undefined && aspectRatio <= 0) {
    reader.issue('ui.aspectRatio', 'invalid_aspect_ratio', 'must be positive.');
  }

  return {
    framework: 'sveltekit',
    width,
    height,
    minWidth,
    minHeight,
    maxWidth,
    maxHeight,
    resizable: reader.childBoolean(object, 'resizable', 'ui.resizable'),
    ...(aspectRatio === undefined ? {} : { aspectRatio }),
    defaultZoom,
    minZoom,
    maxZoom,
    renderer
  };
}

function parsePresets(reader: Reader, object: UnknownRecord): PresetConfiguration {
  const extension = reader.childString(object, 'extension', 'presets.extension');
  const factoryDirectory = reader.childString(object, 'factoryDirectory', 'presets.factoryDirectory');
  const categoryValues = reader.childArray(object, 'categories', 'presets.categories');
  const categories = categoryValues.map((value, index) =>
    reader.string(value, `presets.categories[${index}]`)
  );

  if (extension.startsWith('.') || !/^[A-Za-z0-9_-]+$/.test(extension)) {
    reader.issue('presets.extension', 'invalid_preset_extension', 'must be an extension without a leading period.');
  }
  if (
    factoryDirectory.startsWith('/') ||
    /^[A-Za-z]:[\\/]/.test(factoryDirectory) ||
    factoryDirectory.split(/[\\/]/).includes('..')
  ) {
    reader.issue('presets.factoryDirectory', 'invalid_factory_directory', 'must be a project-relative path.');
  }
  validateUniqueStrings(reader, categories, 'presets.categories', 'duplicate_preset_category');

  return {
    extension,
    factoryDirectory,
    userDirectoryName: reader.childString(object, 'userDirectoryName', 'presets.userDirectoryName'),
    includeUiState: reader.childBoolean(object, 'includeUiState', 'presets.includeUiState'),
    categories
  };
}

function parseBuild(reader: Reader, object: UnknownRecord): BuildConfiguration {
  const cppStandard = reader.childInteger(object, 'cppStandard', 'build.cppStandard');
  const embedFrontend = reader.childBoolean(object, 'embedFrontend', 'build.embedFrontend');
  const developmentServer = reader.childString(object, 'developmentServer', 'build.developmentServer');
  const juceObject = reader.childRecord(object, 'juce', 'build.juce');
  const nodeObject = reader.childRecord(object, 'node', 'build.node');
  const pnpmObject = reader.childRecord(object, 'pnpm', 'build.pnpm');
  const juceVersion = parseToolVersion(reader, juceObject['version'], 'build.juce.version');
  const nodeVersion = parseToolVersion(reader, nodeObject['version'], 'build.node.version');
  const pnpmVersion = parseToolVersion(reader, pnpmObject['version'], 'build.pnpm.version');

  if (cppStandard < 20) {
    reader.issue('build.cppStandard', 'unsupported_cpp_standard', 'must be at least 20.');
  }
  if (!embedFrontend) {
    reader.issue('build.embedFrontend', 'frontend_embedding_required', 'must be true for offline Release builds.');
  }
  try {
    const url = new URL(developmentServer);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported protocol');
  } catch {
    reader.issue('build.developmentServer', 'invalid_development_server', 'must be a valid HTTP or HTTPS URL.');
  }

  return {
    cppStandard,
    embedFrontend,
    developmentServer,
    juce: { version: juceVersion },
    node: { version: nodeVersion },
    pnpm: { version: pnpmVersion },
    warningsAsErrors: reader.childBoolean(object, 'warningsAsErrors', 'build.warningsAsErrors'),
    enableLtoInRelease: reader.childBoolean(object, 'enableLtoInRelease', 'build.enableLtoInRelease')
  };
}

function parseFeatures(reader: Reader, object: UnknownRecord): FeatureConfiguration {
  return {
    transport: reader.childBoolean(object, 'transport', 'features.transport'),
    presets: reader.childBoolean(object, 'presets', 'features.presets'),
    meters: reader.childBoolean(object, 'meters', 'features.meters'),
    analyzer: reader.childBoolean(object, 'analyzer', 'features.analyzer'),
    midi: reader.childBoolean(object, 'midi', 'features.midi'),
    sidechain: reader.childBoolean(object, 'sidechain', 'features.sidechain')
  };
}

function validateFeatureConsistency(
  reader: Reader,
  plugin: PluginIdentity,
  inputs: readonly BusDefinition[],
  features: FeatureConfiguration
): void {
  const sidechainInputs = inputs.filter((bus) => bus.role === 'sidechain');
  if ((features.sidechain || plugin.type === 'sidechain-effect') && sidechainInputs.length === 0) {
    reader.issue('buses.inputs', 'missing_sidechain_bus', 'sidechain support requires an optional sidechain input bus.');
  }
  if (!features.sidechain && sidechainInputs.length > 0) {
    reader.issue('features.sidechain', 'disabled_sidechain_feature', 'must be true when a sidechain bus is declared.');
  }
}

function validateNumericRange(
  reader: Reader,
  path: string,
  min: number,
  max: number,
  defaultValue: number
): void {
  if (min >= max) reader.issue(`${path}.max`, 'invalid_parameter_range', 'must be greater than min.');
  if (defaultValue < min || defaultValue > max) {
    reader.issue(`${path}.default`, 'default_out_of_range', 'must be within the declared min and max.');
  }
}

function validateIdentityCode(reader: Reader, value: string, path: string): void {
  if (!fourAsciiCharactersPattern.test(value)) {
    reader.issue(path, 'invalid_identity_code', 'must contain exactly four ASCII characters.');
  }
}

function validateVersion(reader: Reader, value: string, path: string, pattern: RegExp): void {
  if (!pattern.test(value)) {
    reader.issue(path, 'invalid_version', 'uses an unsupported version format.');
  }
}

function compareSemanticVersions(left: string, right: string): number {
  const parse = (value: string): [number, number, number, string | undefined] => {
    const withoutBuildMetadata = value.split('+', 1)[0] ?? value;
    const prereleaseSeparator = withoutBuildMetadata.indexOf('-');
    const core = prereleaseSeparator < 0
      ? withoutBuildMetadata
      : withoutBuildMetadata.slice(0, prereleaseSeparator);
    const prerelease = prereleaseSeparator < 0
      ? undefined
      : withoutBuildMetadata.slice(prereleaseSeparator + 1);
    const [major = 0, minor = 0, patch = 0] = core.split('.').map(Number);
    return [major, minor, patch, prerelease];
  };
  const leftParts = parse(left);
  const rightParts = parse(right);
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] as number) - (rightParts[index] as number);
    if (difference !== 0) return difference;
  }
  if (leftParts[3] === rightParts[3]) return 0;
  if (leftParts[3] === undefined) return 1;
  if (rightParts[3] === undefined) return -1;
  return comparePrerelease(leftParts[3], rightParts[3]);
}

function comparePrerelease(left: string, right: string): number {
  const leftIdentifiers = left.split('.');
  const rightIdentifiers = right.split('.');
  const length = Math.max(leftIdentifiers.length, rightIdentifiers.length);
  for (let index = 0; index < length; index += 1) {
    const leftIdentifier = leftIdentifiers[index];
    const rightIdentifier = rightIdentifiers[index];
    if (leftIdentifier === undefined) return -1;
    if (rightIdentifier === undefined) return 1;
    if (leftIdentifier === rightIdentifier) continue;
    const leftNumeric = /^\d+$/u.test(leftIdentifier);
    const rightNumeric = /^\d+$/u.test(rightIdentifier);
    if (leftNumeric && rightNumeric) return Number(leftIdentifier) - Number(rightIdentifier);
    if (leftNumeric) return -1;
    if (rightNumeric) return 1;
    return leftIdentifier < rightIdentifier ? -1 : 1;
  }
  return 0;
}

function parseToolVersion(reader: Reader, value: unknown, path: string): string {
  const result = typeof value === 'number' && Number.isFinite(value)
    ? String(value)
    : reader.string(value, path);
  validateVersion(reader, result, path, toolVersionPattern);
  return result;
}

function validateIdentifier(reader: Reader, value: string, path: string): void {
  if (!identifierPattern.test(value)) {
    reader.issue(
      path,
      'invalid_identifier',
      'must start with a letter and contain only letters, numbers, dots, underscores, or hyphens.'
    );
  }
}

function validateUniqueIds(
  reader: Reader,
  values: readonly { id: string }[],
  basePath: string,
  code: string
): void {
  const firstIndex = new Map<string, number>();
  for (const [index, value] of values.entries()) {
    const previous = firstIndex.get(value.id);
    if (previous === undefined) {
      firstIndex.set(value.id, index);
    } else {
      reader.issue(
        `${basePath}[${index}].id`,
        code,
        `duplicates ${basePath}[${previous}].id ('${value.id}').`
      );
    }
  }
}

function validateUniqueStrings(
  reader: Reader,
  values: readonly string[],
  basePath: string,
  code: string
): void {
  const firstIndex = new Map<string, number>();
  for (const [index, value] of values.entries()) {
    const previous = firstIndex.get(value);
    if (previous === undefined) {
      firstIndex.set(value, index);
    } else {
      reader.issue(`${basePath}[${index}]`, code, `duplicates ${basePath}[${previous}] ('${value}').`);
    }
  }
}

function validateGroupCycles(reader: Reader, groups: readonly ParameterGroup[]): void {
  const byId = new Map(groups.map((group) => [group.id, group]));
  for (const [index, group] of groups.entries()) {
    const visited = new Set<string>([group.id]);
    let parentId = group.parentId;
    while (parentId !== undefined) {
      if (visited.has(parentId)) {
        reader.issue(`parameterGroups[${index}].parentId`, 'parameter_group_cycle', 'must not create a parent cycle.');
        break;
      }
      visited.add(parentId);
      parentId = byId.get(parentId)?.parentId;
    }
  }
}

function validateStateDefault(
  reader: Reader,
  value: unknown,
  type: StateFieldType,
  path: string
): void {
  const valid =
    (type === 'boolean' && typeof value === 'boolean') ||
    (type === 'integer' && typeof value === 'number' && Number.isInteger(value)) ||
    (type === 'float' && typeof value === 'number' && Number.isFinite(value)) ||
    (type === 'string' && typeof value === 'string') ||
    (type === 'string-array' && Array.isArray(value) && value.every((item) => typeof item === 'string')) ||
    (type === 'number-array' &&
      Array.isArray(value) &&
      value.every((item) => typeof item === 'number' && Number.isFinite(item))) ||
    (type === 'object' && isRecord(value));

  if (!valid) {
    reader.issue(path, 'invalid_state_default', `must match state field type '${type}'.`);
  }
  if (!isJsonSerializable(value)) {
    reader.issue(path, 'non_serializable_state_default', 'must be JSON-serializable.');
  }
}

function isJsonSerializable(value: unknown): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonSerializable);
  if (isRecord(value)) return Object.values(value).every(isJsonSerializable);
  return false;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
