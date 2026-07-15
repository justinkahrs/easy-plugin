import { CompatibilityError, type ValidationIssue } from '../schema/errors.js';
import type { ParameterType, PluginManifest, PluginType, StateFieldType } from '../schema/model.js';

export const compatibilitySnapshotFileName = 'CompatibilitySnapshot.generated.json';
export const generatedWarning = 'GENERATED FILE. DO NOT EDIT.';
const pluginTypes: readonly PluginType[] = [
  'effect',
  'instrument',
  'midi-instrument',
  'analyzer',
  'sidechain-effect'
];
const parameterTypes: readonly ParameterType[] = ['float', 'integer', 'boolean', 'choice'];
const stateFieldTypes: readonly StateFieldType[] = [
  'boolean',
  'integer',
  'float',
  'string',
  'string-array',
  'number-array',
  'object'
];

export interface CompatibilitySnapshot {
  _generated: typeof generatedWarning;
  snapshotVersion: 1;
  plugin: {
    id: string;
    manufacturerCode: string;
    pluginCode: string;
    type: PluginType;
  };
  parameters: Array<{
    id: string;
    type: ParameterType;
    version: number;
  }>;
  state: {
    schemaVersion: number;
    fields: Array<{
      id: string;
      type: StateFieldType;
    }>;
  };
}

export function createCompatibilitySnapshot(manifest: PluginManifest): CompatibilitySnapshot {
  return {
    _generated: generatedWarning,
    snapshotVersion: 1,
    plugin: {
      id: manifest.plugin.id,
      manufacturerCode: manifest.plugin.manufacturer.code,
      pluginCode: manifest.plugin.pluginCode,
      type: manifest.plugin.type
    },
    parameters: [...manifest.parameters]
      .sort(compareIds)
      .map((parameter) => ({
        id: parameter.id,
        type: parameter.type,
        version: parameter.version
      })),
    state: {
      schemaVersion: manifest.state.schemaVersion,
      fields: [...manifest.state.fields]
        .sort(compareIds)
        .map((field) => ({ id: field.id, type: field.type }))
    }
  };
}

export function serializeCompatibilitySnapshot(snapshot: CompatibilitySnapshot): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

export function parseCompatibilitySnapshot(source: string): CompatibilitySnapshot {
  let value: unknown;
  try {
    value = JSON.parse(source) as unknown;
  } catch (error) {
    throw new CompatibilityError([
      {
        path: 'generated.CompatibilitySnapshot',
        code: 'invalid_compatibility_snapshot',
        message: error instanceof Error ? error.message : 'must be valid JSON.'
      }
    ]);
  }

  if (!isRecord(value) || value['snapshotVersion'] !== 1 || !isRecord(value['plugin'])) {
    throw new CompatibilityError([
      {
        path: 'generated.CompatibilitySnapshot',
        code: 'invalid_compatibility_snapshot',
        message: 'does not use compatibility snapshot version 1.'
      }
    ]);
  }

  const plugin = value['plugin'];
  const parameters = value['parameters'];
  const state = value['state'];
  if (
    typeof plugin['id'] !== 'string' ||
    typeof plugin['manufacturerCode'] !== 'string' ||
    typeof plugin['pluginCode'] !== 'string' ||
    !isSupportedString(plugin['type'], pluginTypes) ||
    !Array.isArray(parameters) ||
    !isRecord(state) ||
    typeof state['schemaVersion'] !== 'number' ||
    !Number.isInteger(state['schemaVersion']) ||
    state['schemaVersion'] < 1 ||
    !Array.isArray(state['fields'])
  ) {
    throw invalidSnapshotShape();
  }

  const parsedParameters: CompatibilitySnapshot['parameters'] = [];
  for (const parameter of parameters) {
    if (
      !isRecord(parameter) ||
      typeof parameter['id'] !== 'string' ||
      !isSupportedString(parameter['type'], parameterTypes) ||
      typeof parameter['version'] !== 'number' ||
      !Number.isInteger(parameter['version']) ||
      parameter['version'] < 1
    ) {
      throw invalidSnapshotShape();
    }
    parsedParameters.push({
      id: parameter['id'],
      type: parameter['type'] as ParameterType,
      version: parameter['version']
    });
  }

  const parsedFields: CompatibilitySnapshot['state']['fields'] = [];
  for (const field of state['fields']) {
    if (
      !isRecord(field) ||
      typeof field['id'] !== 'string' ||
      !isSupportedString(field['type'], stateFieldTypes)
    ) {
      throw invalidSnapshotShape();
    }
    parsedFields.push({ id: field['id'], type: field['type'] as StateFieldType });
  }

  return {
    _generated: generatedWarning,
    snapshotVersion: 1,
    plugin: {
      id: plugin['id'],
      manufacturerCode: plugin['manufacturerCode'],
      pluginCode: plugin['pluginCode'],
      type: plugin['type'] as PluginType
    },
    parameters: parsedParameters,
    state: {
      schemaVersion: state['schemaVersion'],
      fields: parsedFields
    }
  };
}

export function assertCompatible(
  manifest: PluginManifest,
  previous: CompatibilitySnapshot
): void {
  const issues: ValidationIssue[] = [];
  compareIdentity(issues, 'plugin.id', manifest.plugin.id, previous.plugin.id);
  compareIdentity(
    issues,
    'plugin.manufacturer.code',
    manifest.plugin.manufacturer.code,
    previous.plugin.manufacturerCode
  );
  compareIdentity(issues, 'plugin.pluginCode', manifest.plugin.pluginCode, previous.plugin.pluginCode);
  compareIdentity(issues, 'plugin.type', manifest.plugin.type, previous.plugin.type);

  const currentParameterIndex = new Map(
    manifest.parameters.map((parameter, index) => [parameter.id, { parameter, index }])
  );
  for (const oldParameter of previous.parameters) {
    const current = currentParameterIndex.get(oldParameter.id);
    if (current === undefined) {
      issues.push({
        path: 'parameters',
        code: 'parameter_removed_or_renamed',
        message: `released parameter '${oldParameter.id}' was removed or renamed.`
      });
      continue;
    }
    if (current.parameter.type !== oldParameter.type) {
      issues.push({
        path: `parameters[${current.index}].type`,
        code: 'parameter_type_changed',
        message: `released parameter '${oldParameter.id}' changed from ${oldParameter.type} to ${current.parameter.type}.`
      });
    }
    if (current.parameter.version < oldParameter.version) {
      issues.push({
        path: `parameters[${current.index}].version`,
        code: 'parameter_version_decreased',
        message: `must not decrease below released version ${oldParameter.version}.`
      });
    }
  }

  if (manifest.state.schemaVersion < previous.state.schemaVersion) {
    issues.push({
      path: 'state.schemaVersion',
      code: 'state_schema_version_decreased',
      message: `must not decrease below released version ${previous.state.schemaVersion}.`
    });
  }
  const currentStateIndex = new Map(
    manifest.state.fields.map((field, index) => [field.id, { field, index }])
  );
  for (const oldField of previous.state.fields) {
    const current = currentStateIndex.get(oldField.id);
    if (current === undefined) {
      issues.push({
        path: 'state.fields',
        code: 'state_field_removed_or_renamed',
        message: `released state field '${oldField.id}' was removed or renamed.`
      });
    } else if (current.field.type !== oldField.type) {
      issues.push({
        path: `state.fields[${current.index}].type`,
        code: 'state_field_type_changed',
        message: `released state field '${oldField.id}' changed from ${oldField.type} to ${current.field.type}.`
      });
    }
  }

  if (issues.length > 0) throw new CompatibilityError(issues);
}

function compareIdentity(
  issues: ValidationIssue[],
  path: string,
  current: string,
  previous: string
): void {
  if (current !== previous) {
    issues.push({
      path,
      code: 'plugin_identity_changed',
      message: `released value '${previous}' cannot change to '${current}'.`
    });
  }
}

function invalidSnapshotShape(): CompatibilityError {
  return new CompatibilityError([
    {
      path: 'generated.CompatibilitySnapshot',
      code: 'invalid_compatibility_snapshot',
      message: 'contains malformed plugin, parameter, or state data.'
    }
  ]);
}

function compareIds(left: { id: string }, right: { id: string }): number {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSupportedString<const T extends string>(
  value: unknown,
  supported: readonly T[]
): value is T {
  return typeof value === 'string' && supported.includes(value as T);
}
