export const supportedSchemaVersion = 1 as const;
export const builderVersion = '0.1.0' as const;

export type PluginType =
  | 'effect'
  | 'instrument'
  | 'midi-instrument'
  | 'analyzer'
  | 'sidechain-effect';

export type PluginFormat = 'vst3' | 'au' | 'standalone';
export type ParameterType = 'float' | 'integer' | 'boolean' | 'choice';
export type ParameterScale = 'linear' | 'logarithmic' | 'skewed';
export type SmoothingType = 'none' | 'linear' | 'multiplicative';
export type BusRole = 'main' | 'sidechain' | 'auxiliary';
export type ChannelLayout = 'none' | 'mono' | 'stereo';
export type StateFieldType =
  | 'boolean'
  | 'integer'
  | 'float'
  | 'string'
  | 'string-array'
  | 'number-array'
  | 'object';
export type StatePersistence = 'plugin' | 'ui';
export type UiRenderer = 'dom' | 'canvas' | 'webgl' | 'mixed';

export interface BuilderManifest {
  minimumVersion: string;
  projectVersion: string;
  templateCommit?: string;
}

export interface PluginIdentity {
  id: string;
  name: string;
  description?: string;
  manufacturer: {
    name: string;
    code: string;
  };
  pluginCode: string;
  version: string;
  type: PluginType;
  category?: string;
  midiInput: boolean;
  midiOutput: boolean;
  midiEffect: boolean;
  synth: boolean;
}

export interface PlatformConfiguration {
  enabled: boolean;
  architectures: string[];
  universalBinary?: boolean;
}

export interface BusDefinition {
  id: string;
  name: string;
  role: BusRole;
  optional: boolean;
  layouts: ChannelLayout[];
}

export interface ParameterGroup {
  id: string;
  name: string;
  parentId?: string;
}

export interface ParameterSmoothing {
  type: SmoothingType;
  milliseconds: number;
}

export interface ParameterBase {
  id: string;
  version: number;
  name: string;
  group?: string;
  automatable: boolean;
  hidden: boolean;
  advanced: boolean;
  unit?: string;
  precision?: number;
  formatter?: string;
  parser?: string;
}

export interface FloatParameter extends ParameterBase {
  type: 'float';
  min: number;
  max: number;
  default: number;
  step: number;
  scale: ParameterScale;
  skew?: number;
  smoothing?: ParameterSmoothing;
}

export interface IntegerParameter extends ParameterBase {
  type: 'integer';
  min: number;
  max: number;
  default: number;
  step: number;
}

export interface BooleanParameter extends ParameterBase {
  type: 'boolean';
  default: boolean;
}

export interface ChoiceParameter extends ParameterBase {
  type: 'choice';
  choices: string[];
  default: string;
}

export type ParameterDefinition =
  | FloatParameter
  | IntegerParameter
  | BooleanParameter
  | ChoiceParameter;

export interface StateField {
  id: string;
  type: StateFieldType;
  default: unknown;
  persistence: StatePersistence;
}

export interface UiConfiguration {
  framework: 'sveltekit';
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  resizable: boolean;
  aspectRatio?: number;
  defaultZoom: number;
  minZoom: number;
  maxZoom: number;
  renderer: UiRenderer;
}

export interface PresetConfiguration {
  extension: string;
  factoryDirectory: string;
  userDirectoryName: string;
  includeUiState: boolean;
  categories: string[];
}

export interface BuildConfiguration {
  cppStandard: number;
  embedFrontend: boolean;
  developmentServer: string;
  juce: { version: string };
  node: { version: string };
  pnpm: { version: string };
  warningsAsErrors: boolean;
  enableLtoInRelease: boolean;
}

export interface FeatureConfiguration {
  transport: boolean;
  presets: boolean;
  meters: boolean;
  analyzer: boolean;
  midi: boolean;
  sidechain: boolean;
}

export interface PluginManifest {
  schemaVersion: typeof supportedSchemaVersion;
  builder: BuilderManifest;
  plugin: PluginIdentity;
  platforms: {
    windows: PlatformConfiguration;
    macos: PlatformConfiguration;
    linux: PlatformConfiguration;
  };
  formats: PluginFormat[];
  buses: {
    inputs: BusDefinition[];
    outputs: BusDefinition[];
  };
  parameterGroups: ParameterGroup[];
  parameters: ParameterDefinition[];
  state: {
    schemaVersion: number;
    fields: StateField[];
  };
  ui: UiConfiguration;
  presets: PresetConfiguration;
  build: BuildConfiguration;
  features: FeatureConfiguration;
}
