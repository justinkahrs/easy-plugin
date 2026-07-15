import {
  createCompatibilitySnapshot,
  generatedWarning,
  serializeCompatibilitySnapshot
} from '../compatibility/snapshot.js';
import type {
  BusDefinition,
  FloatParameter,
  ParameterDefinition,
  ParameterGroup,
  PluginManifest,
  StateField
} from '../schema/model.js';

export const generatedFileNames = [
  'BridgeTypes.generated.ts',
  'BusLayouts.generated.cpp',
  'BusLayouts.generated.h',
  'CompatibilitySnapshot.generated.json',
  'DspParameters.generated.cpp',
  'DspParameters.generated.h',
  'ParameterMetadata.generated.ts',
  'Parameters.generated.cpp',
  'Parameters.generated.h',
  'PluginMetadata.generated.cmake',
  'PluginMetadata.generated.h',
  'StateMetadata.generated.cpp',
  'StateMetadata.generated.h',
  'StateMetadata.generated.ts',
  'SvelteParameterMetadata.generated.ts'
] as const;

const cppHeader = `// ${generatedWarning}\n// Generated from the plugin manifest.\n\n`;
const typescriptHeader = `// ${generatedWarning}\n// Generated from the plugin manifest.\n\n`;
const cmakeHeader = `# ${generatedWarning}\n# Generated from the plugin manifest.\n\n`;

export function renderGeneratedFiles(manifest: PluginManifest): ReadonlyMap<string, string> {
  const files = new Map<string, string>([
    ['BridgeTypes.generated.ts', renderBridgeTypes(manifest)],
    ['BusLayouts.generated.cpp', renderBusLayoutsSource(manifest)],
    ['BusLayouts.generated.h', renderBusLayoutsHeader()],
    [
      'CompatibilitySnapshot.generated.json',
      serializeCompatibilitySnapshot(createCompatibilitySnapshot(manifest))
    ],
    ['DspParameters.generated.cpp', renderDspParametersSource(manifest)],
    ['DspParameters.generated.h', renderDspParametersHeader(manifest)],
    ['ParameterMetadata.generated.ts', renderParameterMetadata(manifest)],
    ['Parameters.generated.cpp', renderParametersSource(manifest)],
    ['Parameters.generated.h', renderParametersHeader(manifest)],
    ['PluginMetadata.generated.cmake', renderCmakeMetadata(manifest)],
    ['PluginMetadata.generated.h', renderPluginMetadata(manifest)],
    ['StateMetadata.generated.cpp', renderStateMetadataSource(manifest)],
    ['StateMetadata.generated.h', renderStateMetadataHeader(manifest)],
    ['StateMetadata.generated.ts', renderStateMetadataTypescript(manifest)],
    ['SvelteParameterMetadata.generated.ts', renderSvelteParameterMetadata(manifest)]
  ]);

  return new Map([...files.entries()].sort(([left], [right]) => compareStrings(left, right)));
}

function renderPluginMetadata(manifest: PluginManifest): string {
  const versionParts = manifest.plugin.version.split(/[+-]/u)[0]?.split('.').map(Number) ?? [0, 0, 0];
  const formats = [...manifest.formats].sort(compareStrings);
  const formatValues = formats.map((format) => cppString(format)).join(', ');

  return `${cppHeader}#pragma once

#include <array>
#include <string_view>

namespace easy_plugin::generated::metadata
{
inline constexpr int schemaVersion = ${manifest.schemaVersion};
inline constexpr std::string_view builderMinimumVersion = ${cppString(manifest.builder.minimumVersion)};
inline constexpr std::string_view projectVersion = ${cppString(manifest.builder.projectVersion)};
inline constexpr std::string_view pluginId = ${cppString(manifest.plugin.id)};
inline constexpr std::string_view pluginName = ${cppString(manifest.plugin.name)};
inline constexpr std::string_view pluginDescription = ${cppString(manifest.plugin.description ?? '')};
inline constexpr std::string_view pluginCategory = ${cppString(manifest.plugin.category ?? '')};
inline constexpr std::string_view manufacturerName = ${cppString(manifest.plugin.manufacturer.name)};
inline constexpr std::string_view manufacturerCode = ${cppString(manifest.plugin.manufacturer.code)};
inline constexpr std::string_view pluginCode = ${cppString(manifest.plugin.pluginCode)};
inline constexpr std::string_view version = ${cppString(manifest.plugin.version)};
inline constexpr int versionMajor = ${versionParts[0] ?? 0};
inline constexpr int versionMinor = ${versionParts[1] ?? 0};
inline constexpr int versionPatch = ${versionParts[2] ?? 0};
inline constexpr std::string_view type = ${cppString(manifest.plugin.type)};
inline constexpr bool acceptsMidi = ${cppBoolean(manifest.plugin.midiInput)};
inline constexpr bool producesMidi = ${cppBoolean(manifest.plugin.midiOutput)};
inline constexpr bool isMidiEffect = ${cppBoolean(manifest.plugin.midiEffect)};
inline constexpr bool isSynth = ${cppBoolean(manifest.plugin.synth)};
inline constexpr int stateSchemaVersion = ${manifest.state.schemaVersion};
inline constexpr bool supportsPresets = ${cppBoolean(manifest.features.presets)};
inline constexpr bool supportsTransport = ${cppBoolean(manifest.features.transport)};
inline constexpr bool supportsMeters = ${cppBoolean(manifest.features.meters)};
inline constexpr bool supportsAnalyzer = ${cppBoolean(manifest.features.analyzer)};
inline constexpr bool supportsMidi = ${cppBoolean(manifest.features.midi)};
inline constexpr std::array<std::string_view, ${formats.length}> formats{{ ${formatValues} }};

struct UiConstraints
{
    int width;
    int height;
    int minWidth;
    int minHeight;
    int maxWidth;
    int maxHeight;
    bool resizable;
    double defaultZoom;
};

inline constexpr UiConstraints ui{
    ${manifest.ui.width},
    ${manifest.ui.height},
    ${manifest.ui.minWidth},
    ${manifest.ui.minHeight},
    ${manifest.ui.maxWidth},
    ${manifest.ui.maxHeight},
    ${cppBoolean(manifest.ui.resizable)},
    ${cppDouble(manifest.ui.defaultZoom)}
};
}
`;
}

function renderParametersHeader(manifest: PluginManifest): string {
  const parameters = sortedParameters(manifest);
  const identifiers = parameters
    .map(
      (parameter) =>
        `inline constexpr std::string_view ${parameterIdentifier(parameter.id)} = ${cppString(parameter.id)};`
    )
    .join('\n');
  const smoothing = parameters
    .filter((parameter): parameter is FloatParameter => parameter.type === 'float' && parameter.smoothing !== undefined)
    .map(
      (parameter) =>
        `    SmoothingDefinition{ ${parameterIdentifier(parameter.id)}, SmoothingType::${parameter.smoothing?.type}, ${cppDouble(parameter.smoothing?.milliseconds ?? 0)} }`
    );

  return `${cppHeader}#pragma once

#include <juce_audio_processors/juce_audio_processors.h>

#include <array>
#include <string_view>

namespace easy_plugin::generated::parameters
{
${identifiers}

enum class SmoothingType
{
    none,
    linear,
    multiplicative
};

struct SmoothingDefinition
{
    std::string_view parameterId;
    SmoothingType type;
    double milliseconds;
};

inline constexpr std::array<SmoothingDefinition, ${smoothing.length}> smoothingDefinitions{{
${smoothing.join(',\n')}
}};

[[nodiscard]] juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();
}
`;
}

function renderParametersSource(manifest: PluginManifest): string {
  const parameters = sortedParameters(manifest);
  const groups = [...manifest.parameterGroups].sort(compareIds);
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const lines: string[] = [
    `${cppHeader}#include "Parameters.generated.h"`,
    '',
    '#include <memory>',
    '#include <utility>',
    '',
    'namespace easy_plugin::generated::parameters',
    '{',
    'juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout()',
    '{',
    '    auto layout = juce::AudioProcessorValueTreeState::ParameterLayout{};'
  ];

  for (const group of groups) {
    lines.push(
      `    auto ${groupVariable(group.id)} = std::make_unique<juce::AudioProcessorParameterGroup>(`,
      `        ${cppString(group.id)}, ${cppString(group.name)}, " / ");`
    );
  }
  if (groups.length > 0) lines.push('');

  for (const parameter of parameters) {
    lines.push(...renderParameterCreation(parameter));
    if (parameter.group === undefined) {
      lines.push(`    layout.add(std::move(${parameterVariable(parameter.id)}));`);
    } else {
      lines.push(
        `    ${groupVariable(parameter.group)}->addChild(std::move(${parameterVariable(parameter.id)}));`
      );
    }
    lines.push('');
  }

  const childGroups = groups
    .filter((group) => group.parentId !== undefined)
    .sort((left, right) => groupDepth(right, groupById) - groupDepth(left, groupById) || compareIds(left, right));
  for (const group of childGroups) {
    lines.push(
      `    ${groupVariable(group.parentId ?? '')}->addChild(std::move(${groupVariable(group.id)}));`
    );
  }
  if (childGroups.length > 0) lines.push('');

  for (const group of groups.filter((item) => item.parentId === undefined)) {
    lines.push(`    layout.add(std::move(${groupVariable(group.id)}));`);
  }
  if (groups.length > 0) lines.push('');
  lines.push('    return layout;', '}', '}', '');
  return lines.join('\n');
}

function renderDspParametersHeader(manifest: PluginManifest): string {
  const parameters = sortedParameters(manifest);
  const valueFields = parameters
    .map((parameter) => `    ${dspValueType(parameter)} ${encodeIdentifier(parameter.id)}{};`)
    .join('\n');
  const pointerFields = parameters
    .map((parameter) => `    std::atomic<float>* value_${encodeIdentifier(parameter.id)}{};`)
    .join('\n');
  const smootherFields = smoothedFloatParameters(manifest)
    .map(
      (parameter) =>
        `    juce::SmoothedValue<float, juce::ValueSmoothingTypes::${parameter.smoothing?.type === 'multiplicative' ? 'Multiplicative' : 'Linear'}> smoothed_${encodeIdentifier(parameter.id)};`
    )
    .join('\n');

  return `${cppHeader}#pragma once

#include <juce_audio_basics/juce_audio_basics.h>
#include <juce_audio_processors/juce_audio_processors.h>

#include <atomic>

namespace easy_plugin::generated::dsp
{
struct ParameterValues
{
${valueFields}
};

class ParameterSnapshot final
{
public:
    explicit ParameterSnapshot(juce::AudioProcessorValueTreeState& state) noexcept;
    [[nodiscard]] ParameterValues read() const noexcept;

private:
${pointerFields}
};

class ParameterSmoothers final
{
public:
    void prepare(double sampleRate, const ParameterValues& initialValues) noexcept;
    void reset(const ParameterValues& values) noexcept;
    void setTargets(const ParameterValues& values) noexcept;
    [[nodiscard]] ParameterValues getNext() noexcept;
    [[nodiscard]] bool isSmoothing() const noexcept;

private:
    ParameterValues current{};
${smootherFields}
};
}
`;
}

function renderDspParametersSource(manifest: PluginManifest): string {
  const parameters = sortedParameters(manifest);
  const smoothed = smoothedFloatParameters(manifest);
  const pointerInitializers = parameters
    .map(
      (parameter) =>
        `      value_${encodeIdentifier(parameter.id)}(state.getRawParameterValue(juce::String{ easy_plugin::generated::parameters::${parameterIdentifier(parameter.id)}.data() }))`
    )
    .join(',\n');
  const reads = parameters
    .map(
      (parameter) =>
        `        ${renderDspSnapshotRead(parameter, `value_${encodeIdentifier(parameter.id)}`)}`
    )
    .join(',\n');
  const prepares = smoothed
    .map(
      (parameter) =>
        `    smoothed_${encodeIdentifier(parameter.id)}.reset(safeSampleRate, ${cppDouble((parameter.smoothing?.milliseconds ?? 0) / 1000)});`
    )
    .join('\n');
  const resets = smoothed
    .map(
      (parameter) =>
        `    smoothed_${encodeIdentifier(parameter.id)}.setCurrentAndTargetValue(values.${encodeIdentifier(parameter.id)});`
    )
    .join('\n');
  const targets = smoothed
    .map(
      (parameter) =>
        `    smoothed_${encodeIdentifier(parameter.id)}.setTargetValue(values.${encodeIdentifier(parameter.id)});`
    )
    .join('\n');
  const nextValues = smoothed
    .map(
      (parameter) =>
        `    result.${encodeIdentifier(parameter.id)} = smoothed_${encodeIdentifier(parameter.id)}.getNextValue();`
    )
    .join('\n');
  const smoothingExpression =
    smoothed.length === 0
      ? 'false'
      : smoothed.map((parameter) => `smoothed_${encodeIdentifier(parameter.id)}.isSmoothing()`).join(' || ');

  return `${cppHeader}#include "DspParameters.generated.h"

#include "Parameters.generated.h"

#include <algorithm>
#include <cmath>

namespace easy_plugin::generated::dsp
{
namespace
{
float readValue(const std::atomic<float>* value, float fallback) noexcept
{
    return value == nullptr ? fallback : value->load(std::memory_order_relaxed);
}
}

ParameterSnapshot::ParameterSnapshot(juce::AudioProcessorValueTreeState& state) noexcept
    : ${pointerInitializers}
{
}

ParameterValues ParameterSnapshot::read() const noexcept
{
    return ParameterValues{
${reads}
    };
}

void ParameterSmoothers::prepare(double sampleRate, const ParameterValues& initialValues) noexcept
{
    const auto safeSampleRate = std::max(1.0, sampleRate);
${prepares}
    reset(initialValues);
}

void ParameterSmoothers::reset(const ParameterValues& values) noexcept
{
    current = values;
${resets}
}

void ParameterSmoothers::setTargets(const ParameterValues& values) noexcept
{
    current = values;
${targets}
}

ParameterValues ParameterSmoothers::getNext() noexcept
{
    auto result = current;
${nextValues}
    return result;
}

bool ParameterSmoothers::isSmoothing() const noexcept
{
    return ${smoothingExpression};
}
}
`;
}

function renderParameterCreation(parameter: ParameterDefinition): string[] {
  const variable = parameterVariable(parameter.id);
  const attributes = `${attributeType(parameter)}{}.withLabel(${cppString(parameter.unit ?? '')}).withAutomatable(${cppBoolean(parameter.automatable)})`;
  const id = `juce::ParameterID{ juce::String{ ${parameterIdentifier(parameter.id)}.data() }, ${parameter.version} }`;

  if (parameter.type === 'float') {
    const rangeVariable = `${variable}_range`;
    const lines = [
      `    auto ${rangeVariable} = ${renderFloatRange(parameter)};`
    ];
    if (parameter.scale === 'logarithmic') {
      lines.push(
        `    ${rangeVariable}.setSkewForCentre(${cppFloat(Math.sqrt(parameter.min * parameter.max))});`
      );
    }
    lines.push(
      `    auto ${variable} = std::make_unique<juce::AudioParameterFloat>(`,
      `        ${id},`,
      `        ${cppString(parameter.name)},`,
      `        ${rangeVariable},`,
      `        ${cppFloat(parameter.default)},`,
      `        ${attributes});`
    );
    return lines;
  }

  if (parameter.type === 'integer') {
    return [
      `    auto ${variable} = std::make_unique<juce::AudioParameterInt>(`,
      `        ${id},`,
      `        ${cppString(parameter.name)},`,
      `        ${parameter.min},`,
      `        ${parameter.max},`,
      `        ${parameter.default},`,
      `        ${attributes});`
    ];
  }

  if (parameter.type === 'boolean') {
    return [
      `    auto ${variable} = std::make_unique<juce::AudioParameterBool>(`,
      `        ${id},`,
      `        ${cppString(parameter.name)},`,
      `        ${cppBoolean(parameter.default)},`,
      `        ${attributes});`
    ];
  }

  const defaultIndex = parameter.choices.indexOf(parameter.default);
  return [
    `    auto ${variable} = std::make_unique<juce::AudioParameterChoice>(`,
    `        ${id},`,
    `        ${cppString(parameter.name)},`,
    `        juce::StringArray{ ${parameter.choices.map(cppString).join(', ')} },`,
    `        ${defaultIndex},`,
    `        ${attributes});`
  ];
}

function renderFloatRange(parameter: FloatParameter): string {
  if (parameter.scale === 'skewed') {
    return `juce::NormalisableRange<float>{ ${cppFloat(parameter.min)}, ${cppFloat(parameter.max)}, ${cppFloat(parameter.step)}, ${cppFloat(parameter.skew ?? 1)}, false }`;
  }
  return `juce::NormalisableRange<float>{ ${cppFloat(parameter.min)}, ${cppFloat(parameter.max)}, ${cppFloat(parameter.step)} }`;
}

function renderParameterMetadata(manifest: PluginManifest): string {
  const parameters = sortedParameters(manifest);
  const ids = Object.fromEntries(parameters.map((parameter) => [parameter.id, parameter.id]));
  const metadata = parameters.map((parameter) => ({
    id: parameter.id,
    version: parameter.version,
    name: parameter.name,
    type: parameter.type,
    groupId: parameter.group ?? null,
    default: parameter.default,
    min: parameter.type === 'float' || parameter.type === 'integer' ? parameter.min : null,
    max: parameter.type === 'float' || parameter.type === 'integer' ? parameter.max : null,
    step: parameter.type === 'float' || parameter.type === 'integer' ? parameter.step : null,
    choices: parameter.type === 'choice' ? parameter.choices : null,
    unit: parameter.unit ?? null,
    precision: parameter.precision ?? null,
    scale: parameter.type === 'float' ? parameter.scale : null,
    skew: parameter.type === 'float' ? parameter.skew ?? null : null,
    smoothing: parameter.type === 'float' ? parameter.smoothing ?? null : null,
    automatable: parameter.automatable,
    hidden: parameter.hidden,
    advanced: parameter.advanced,
    formatter: parameter.formatter ?? null,
    parser: parameter.parser ?? null
  }));

  return `${typescriptHeader}export const parameterIds = ${typescriptValue(ids)} as const;

export type ParameterId = (typeof parameterIds)[keyof typeof parameterIds];
export type ParameterType = 'float' | 'integer' | 'boolean' | 'choice';
export type ParameterScale = 'linear' | 'logarithmic' | 'skewed';
export type SmoothingType = 'none' | 'linear' | 'multiplicative';

export interface ParameterMetadata {
  readonly id: ParameterId;
  readonly version: number;
  readonly name: string;
  readonly type: ParameterType;
  readonly groupId: string | null;
  readonly default: number | boolean | string;
  readonly min: number | null;
  readonly max: number | null;
  readonly step: number | null;
  readonly choices: readonly string[] | null;
  readonly unit: string | null;
  readonly precision: number | null;
  readonly scale: ParameterScale | null;
  readonly skew: number | null;
  readonly smoothing: Readonly<{ type: SmoothingType; milliseconds: number }> | null;
  readonly automatable: boolean;
  readonly hidden: boolean;
  readonly advanced: boolean;
  readonly formatter: string | null;
  readonly parser: string | null;
}

export const parameterMetadata = ${typescriptValue(metadata)} as const satisfies readonly ParameterMetadata[];

export function getParameterMetadata(id: ParameterId): ParameterMetadata {
  const result = parameterMetadata.find((parameter) => parameter.id === id);
  if (result === undefined) throw new Error(\`Unknown generated parameter ID: \${id}\`);
  return result;
}
`;
}

function renderSvelteParameterMetadata(manifest: PluginManifest): string {
  const groups = [...manifest.parameterGroups].sort(compareIds).map((group) => ({
    id: group.id,
    name: group.name,
    parentId: group.parentId ?? null
  }));
  const controls = sortedParameters(manifest).map((parameter) => ({
    id: parameter.id,
    control: parameter.type === 'boolean' ? 'toggle' : parameter.type === 'choice' ? 'select' : 'slider',
    label: parameter.name,
    groupId: parameter.group ?? null,
    unit: parameter.unit ?? null,
    precision: parameter.precision ?? null,
    hidden: parameter.hidden,
    advanced: parameter.advanced
  }));

  return `${typescriptHeader}import type { ParameterId } from './ParameterMetadata.generated.js';

export type SvelteControlKind = 'slider' | 'toggle' | 'select';

export interface SvelteParameterGroupMetadata {
  readonly id: string;
  readonly name: string;
  readonly parentId: string | null;
}

export interface SvelteParameterMetadata {
  readonly id: ParameterId;
  readonly control: SvelteControlKind;
  readonly label: string;
  readonly groupId: string | null;
  readonly unit: string | null;
  readonly precision: number | null;
  readonly hidden: boolean;
  readonly advanced: boolean;
}

export const svelteParameterGroups = ${typescriptValue(groups)} as const satisfies readonly SvelteParameterGroupMetadata[];

export const svelteParameterMetadata = ${typescriptValue(controls)} as const satisfies readonly SvelteParameterMetadata[];
`;
}

function renderStateMetadataHeader(manifest: PluginManifest): string {
  const categories = [...manifest.presets.categories].sort(compareStrings);
  return `${cppHeader}#pragma once

#include <juce_core/juce_core.h>

#include <array>
#include <span>
#include <string_view>

namespace easy_plugin::generated::state
{
inline constexpr int schemaVersion = ${manifest.state.schemaVersion};

enum class FieldType
{
    boolean,
    integer,
    floating,
    string,
    stringArray,
    numberArray,
    object
};

enum class Persistence
{
    plugin,
    ui
};

struct FieldDefinition
{
    std::string_view id;
    FieldType type;
    Persistence persistence;
    std::string_view defaultJson;
};

[[nodiscard]] std::span<const FieldDefinition> getFieldDefinitions() noexcept;
[[nodiscard]] const FieldDefinition* findField(std::string_view id) noexcept;
[[nodiscard]] bool validateValue(const FieldDefinition& field, const juce::var& value) noexcept;
[[nodiscard]] juce::var createDefaultPluginState();
[[nodiscard]] juce::var createDefaultUiState();

inline constexpr std::string_view presetExtension = ${cppString(manifest.presets.extension)};
inline constexpr std::string_view factoryPresetDirectory = ${cppString(manifest.presets.factoryDirectory)};
inline constexpr std::string_view userPresetDirectoryName = ${cppString(manifest.presets.userDirectoryName)};
inline constexpr bool presetsIncludeUiState = ${cppBoolean(manifest.presets.includeUiState)};
inline constexpr std::array<std::string_view, ${categories.length}> presetCategories{{
    ${categories.map(cppString).join(', ')}
}};
}
`;
}

function renderStateMetadataSource(manifest: PluginManifest): string {
  const fields = sortedStateFields(manifest);
  const definitions = fields
    .map(
      (field) =>
        `    FieldDefinition{ ${cppString(field.id)}, FieldType::${cppStateFieldType(field)}, Persistence::${field.persistence}, ${cppString(JSON.stringify(field.default))} }`
    )
    .join(',\n');
  const pluginDefaults = Object.fromEntries(
    fields.filter((field) => field.persistence === 'plugin').map((field) => [field.id, field.default])
  );
  const uiDefaults = Object.fromEntries(
    fields.filter((field) => field.persistence === 'ui').map((field) => [field.id, field.default])
  );

  return `${cppHeader}#include "StateMetadata.generated.h"

#include <algorithm>
#include <cmath>

namespace easy_plugin::generated::state
{
namespace
{
constexpr std::array<FieldDefinition, ${fields.length}> definitions{{
${definitions}
}};

bool isFiniteNumber(const juce::var& value) noexcept
{
    return (value.isInt() || value.isInt64() || value.isDouble())
        && std::isfinite(static_cast<double>(value));
}

bool isInteger(const juce::var& value) noexcept
{
    if (value.isInt() || value.isInt64())
        return true;
    if (!value.isDouble())
        return false;
    const auto number = static_cast<double>(value);
    return std::isfinite(number) && std::floor(number) == number;
}

bool isArrayOf(const juce::var& value, bool (*predicate)(const juce::var&) noexcept) noexcept
{
    const auto* array = value.getArray();
    if (array == nullptr)
        return false;
    return std::all_of(array->begin(), array->end(), predicate);
}

juce::var parseDefaults(const char* json)
{
    auto parsed = juce::JSON::parse(juce::String::fromUTF8(json));
    return parsed.getDynamicObject() == nullptr ? juce::var{new juce::DynamicObject()} : parsed;
}
}

std::span<const FieldDefinition> getFieldDefinitions() noexcept
{
    return definitions;
}

const FieldDefinition* findField(std::string_view id) noexcept
{
    const auto iterator = std::find_if(definitions.begin(), definitions.end(), [id](const auto& field) {
        return field.id == id;
    });
    return iterator == definitions.end() ? nullptr : &*iterator;
}

bool validateValue(const FieldDefinition& field, const juce::var& value) noexcept
{
    switch (field.type)
    {
        case FieldType::boolean: return value.isBool();
        case FieldType::integer: return isInteger(value);
        case FieldType::floating: return isFiniteNumber(value);
        case FieldType::string: return value.isString();
        case FieldType::stringArray:
            return isArrayOf(value, [](const juce::var& item) noexcept { return item.isString(); });
        case FieldType::numberArray: return isArrayOf(value, isFiniteNumber);
        case FieldType::object: return value.getDynamicObject() != nullptr;
    }
    return false;
}

juce::var createDefaultPluginState()
{
    return parseDefaults(${cppString(JSON.stringify(pluginDefaults))});
}

juce::var createDefaultUiState()
{
    return parseDefaults(${cppString(JSON.stringify(uiDefaults))});
}
}
`;
}

function renderStateMetadataTypescript(manifest: PluginManifest): string {
  const fields = sortedStateFields(manifest).map((field) => ({
    id: field.id,
    type: field.type,
    persistence: field.persistence,
    default: field.default
  }));
  const fieldIds = Object.fromEntries(fields.map((field) => [field.id, field.id]));
  const presetConfiguration = {
    extension: manifest.presets.extension,
    factoryDirectory: manifest.presets.factoryDirectory,
    userDirectoryName: manifest.presets.userDirectoryName,
    includeUiState: manifest.presets.includeUiState,
    categories: [...manifest.presets.categories].sort(compareStrings)
  };
  return `${typescriptHeader}export const stateSchemaVersion = ${manifest.state.schemaVersion} as const;
export const stateFieldIds = ${typescriptValue(fieldIds)} as const;
export type StateFieldId = (typeof stateFieldIds)[keyof typeof stateFieldIds];
export type StateFieldType = 'boolean' | 'integer' | 'float' | 'string' | 'string-array' | 'number-array' | 'object';
export type StatePersistence = 'plugin' | 'ui';

export interface StateFieldMetadata {
  readonly id: StateFieldId;
  readonly type: StateFieldType;
  readonly persistence: StatePersistence;
  readonly default: unknown;
}

export const stateFieldMetadata = ${typescriptValue(fields)} as const satisfies readonly StateFieldMetadata[];
export const presetConfiguration = ${typescriptValue(presetConfiguration)} as const;
`;
}

function renderBridgeTypes(manifest: PluginManifest): string {
  return `${typescriptHeader}import type { ParameterId } from './ParameterMetadata.generated.js';
import type { StateFieldId } from './StateMetadata.generated.js';

export const bridgeProtocolVersion = 1 as const;
export type PluginInstanceId = string;

export interface BridgeMessage<TPayload> {
  readonly protocolVersion: typeof bridgeProtocolVersion;
  readonly instanceId: PluginInstanceId;
  readonly requestId?: string;
  readonly sequence?: number;
  readonly payload: TPayload;
}

export type ParameterCommand =
  | { readonly type: 'parameter.beginGesture'; readonly parameterId: ParameterId }
  | { readonly type: 'parameter.setNormalized'; readonly parameterId: ParameterId; readonly value: number }
  | { readonly type: 'parameter.endGesture'; readonly parameterId: ParameterId };

export type FrontendCommand =
  | ParameterCommand
  | { readonly type: 'state.requestSnapshot' }
  | { readonly type: 'state.setField'; readonly fieldId: StateFieldId; readonly value: unknown }
  | { readonly type: 'preset.list' }
  | { readonly type: 'preset.load'; readonly presetId: string }
  | { readonly type: 'preset.save'; readonly name: string; readonly category?: string; readonly tags?: readonly string[] }
  | { readonly type: 'preset.delete'; readonly presetId: string }
  | { readonly type: 'transport.requestSnapshot' }
  | { readonly type: 'visualization.subscribe'; readonly stream: VisualizationStream; readonly rateHz?: number }
  | { readonly type: 'visualization.unsubscribe'; readonly stream: VisualizationStream }
  | { readonly type: 'bridge.ping'; readonly timestamp: number };

export type VisualizationStream = 'meters' | 'analyzer';

export interface BridgeCapabilities {
  readonly presets: boolean;
  readonly transport: boolean;
  readonly meters: boolean;
  readonly analyzer: boolean;
  readonly midi: boolean;
}

export interface BridgeReadyEvent {
  readonly type: 'bridge.ready';
  readonly protocolVersion: typeof bridgeProtocolVersion;
  readonly capabilities: BridgeCapabilities;
}

export interface BridgePongEvent {
  readonly type: 'bridge.pong';
  readonly timestamp: number;
}

export interface StateSnapshotEvent {
  readonly type: 'state.snapshot';
  readonly schemaVersion: number;
  readonly parameters: Readonly<Record<ParameterId, number>>;
  readonly pluginState: Readonly<Record<string, unknown>>;
  readonly uiState?: Readonly<Record<string, unknown>>;
  readonly preset?: Readonly<{ readonly id?: string; readonly name?: string; readonly dirty: boolean }>;
}

export interface StateFieldChangedEvent {
  readonly type: 'state.fieldChanged';
  readonly fieldId: StateFieldId;
  readonly value: unknown;
  readonly source: 'ui' | 'preset' | 'state' | 'native';
}

export interface ParameterChangedEvent {
  readonly type: 'parameter.changed';
  readonly parameterId: ParameterId;
  readonly normalizedValue: number;
  readonly source: 'host' | 'ui' | 'preset' | 'state';
}

export interface TransportChangedEvent {
  readonly type: 'transport.changed';
  readonly playing: boolean;
  readonly recording: boolean;
  readonly looping: boolean;
  readonly bpm?: number;
  readonly ppqPosition?: number;
  readonly samplePosition?: number;
  readonly timeSignature?: Readonly<{ readonly numerator: number; readonly denominator: number }>;
  readonly loop?: Readonly<{ readonly startPpq: number; readonly endPpq: number }>;
}

export interface MeterFrameEvent {
  readonly type: 'meter.frame';
  readonly sequence: number;
  readonly timestamp: number;
  readonly peaks: readonly number[];
  readonly rms: readonly number[];
}

export interface AnalyzerFrameEvent {
  readonly type: 'analyzer.frame';
  readonly sequence: number;
  readonly timestamp: number;
  readonly sampleRate: number;
  readonly minFrequency: number;
  readonly maxFrequency: number;
  readonly encoding: 'f32-base64';
  readonly binCount: number;
  readonly data: string;
}

export interface BridgeErrorEvent {
  readonly type: 'error';
  readonly category: 'bridge' | 'parameter' | 'state' | 'preset' | 'editor' | 'transport' | 'visualization' | 'native';
  readonly code: string;
  readonly message: string;
  readonly recoverable: boolean;
  readonly requestId?: string;
}

export interface PresetInfo {
  readonly id: string;
  readonly name: string;
  readonly category?: string;
  readonly tags?: readonly string[];
  readonly factory: boolean;
}

export interface PresetListEvent {
  readonly type: 'preset.list';
  readonly presets: readonly PresetInfo[];
}

export interface PresetLoadedEvent {
  readonly type: 'preset.loaded';
  readonly presetId: string;
  readonly name: string;
}

export interface PresetSavedEvent {
  readonly type: 'preset.saved';
  readonly presetId: string;
  readonly name: string;
}

export interface PresetDeletedEvent {
  readonly type: 'preset.deleted';
  readonly presetId: string;
}

export interface PresetDirtyChangedEvent {
  readonly type: 'preset.dirtyChanged';
  readonly dirty: boolean;
}

export type NativeEvent =
  | BridgeReadyEvent
  | BridgePongEvent
  | StateSnapshotEvent
  | StateFieldChangedEvent
  | ParameterChangedEvent
  | TransportChangedEvent
  | MeterFrameEvent
  | AnalyzerFrameEvent
  | PresetListEvent
  | PresetLoadedEvent
  | PresetSavedEvent
  | PresetDeletedEvent
  | PresetDirtyChangedEvent
  | BridgeErrorEvent;

export const bridgeCapabilities = ${typescriptValue({
    presets: manifest.features.presets,
    transport: manifest.features.transport,
    meters: manifest.features.meters,
    analyzer: manifest.features.analyzer,
    midi: manifest.features.midi
  })} as const satisfies BridgeCapabilities;
`;
}

function renderBusLayoutsHeader(): string {
  return `${cppHeader}#pragma once

#include <juce_audio_processors/juce_audio_processors.h>

#include <span>
#include <string_view>

namespace easy_plugin::generated::buses
{
enum class BusRole
{
    main,
    sidechain,
    auxiliary
};

struct BusDefinition
{
    std::string_view id;
    std::string_view name;
    BusRole role;
    bool input;
    bool optional;
    std::span<const int> channelCounts;
};

class ManifestAudioProcessor : public juce::AudioProcessor
{
public:
    ~ManifestAudioProcessor() override = default;
    [[nodiscard]] bool isBusesLayoutSupported(const BusesLayout& layout) const final;

protected:
    ManifestAudioProcessor();
};

[[nodiscard]] std::span<const BusDefinition> getBusDefinitions() noexcept;
[[nodiscard]] bool isBusLayoutSupported(const juce::AudioProcessor::BusesLayout& layout) noexcept;
}
`;
}

function renderBusLayoutsSource(manifest: PluginManifest): string {
  const buses = sortedBuses(manifest);
  const layoutArrays = buses
    .map((bus) => {
      const counts = [...bus.layouts].sort(compareLayouts).map(layoutChannelCount);
      return `constexpr std::array<int, ${counts.length}> ${busLayoutVariable(bus)}{{ ${counts.join(', ')} }};`;
    })
    .join('\n');
  const definitions = buses
    .map(
      (bus) =>
        `    BusDefinition{ ${cppString(bus.id)}, ${cppString(bus.name)}, BusRole::${bus.role}, ${cppBoolean(bus.input)}, ${cppBoolean(bus.optional)}, ${busLayoutVariable(bus)} }`
    )
    .join(',\n');
  const busProperties = buses
    .map(
      (bus) =>
        `        .with${bus.input ? 'Input' : 'Output'}(${cppString(bus.name)}, ${defaultChannelSet(bus)}, ${cppBoolean(!bus.optional)})`
    )
    .join('\n');
  return `${cppHeader}#include "BusLayouts.generated.h"

#include <algorithm>
#include <array>
#include <cstddef>

namespace easy_plugin::generated::buses
{
namespace
{
${layoutArrays}

constexpr std::array<BusDefinition, ${buses.length}> busDefinitions{{
${definitions}
}};

bool supports(const BusDefinition& bus, const juce::AudioChannelSet& layout) noexcept
{
    const auto channels = layout.size();
    if (channels == 0 && bus.optional)
        return true;

    return std::find(bus.channelCounts.begin(), bus.channelCounts.end(), channels) != bus.channelCounts.end();
}
}

ManifestAudioProcessor::ManifestAudioProcessor()
    : AudioProcessor(BusesProperties()
${busProperties})
{
}

bool ManifestAudioProcessor::isBusesLayoutSupported(const BusesLayout& layout) const
{
    return isBusLayoutSupported(layout);
}

std::span<const BusDefinition> getBusDefinitions() noexcept
{
    return busDefinitions;
}

bool isBusLayoutSupported(const juce::AudioProcessor::BusesLayout& layout) noexcept
{
    const auto inputCount = static_cast<std::size_t>(layout.inputBuses.size());
    const auto outputCount = static_cast<std::size_t>(layout.outputBuses.size());
    const auto expectedInputs = static_cast<std::size_t>(${buses.filter((bus) => bus.input).length});
    const auto expectedOutputs = static_cast<std::size_t>(${buses.filter((bus) => !bus.input).length});
    if (inputCount != expectedInputs || outputCount != expectedOutputs)
        return false;

    std::size_t inputIndex = 0;
    std::size_t outputIndex = 0;
    for (const auto& bus : busDefinitions)
    {
        const auto& channelSet = bus.input
            ? layout.inputBuses[static_cast<int>(inputIndex++)]
            : layout.outputBuses[static_cast<int>(outputIndex++)];
        if (!supports(bus, channelSet))
            return false;
    }

    return true;
}
}
`;
}

function renderCmakeMetadata(manifest: PluginManifest): string {
  const formats = [...manifest.formats]
    .sort(compareStrings)
    .map((format) => ({ au: 'AU', standalone: 'Standalone', vst3: 'VST3' })[format]);
  return `${cmakeHeader}set(EASY_PLUGIN_BUNDLE_ID "${cmakeEscape(manifest.plugin.id)}")
set(EASY_PLUGIN_PRODUCT_NAME "${cmakeEscape(manifest.plugin.name)}")
set(EASY_PLUGIN_DESCRIPTION "${cmakeEscape(manifest.plugin.description ?? '')}")
set(EASY_PLUGIN_CATEGORY "${cmakeEscape(manifest.plugin.category ?? '')}")
set(EASY_PLUGIN_MANUFACTURER_NAME "${cmakeEscape(manifest.plugin.manufacturer.name)}")
set(EASY_PLUGIN_MANUFACTURER_CODE "${cmakeEscape(manifest.plugin.manufacturer.code)}")
set(EASY_PLUGIN_PLUGIN_CODE "${cmakeEscape(manifest.plugin.pluginCode)}")
set(EASY_PLUGIN_VERSION "${cmakeEscape(manifest.plugin.version)}")
set(EASY_PLUGIN_TYPE "${cmakeEscape(manifest.plugin.type)}")
set(EASY_PLUGIN_FORMATS "${formats.join(';')}")
set(EASY_PLUGIN_WINDOWS_ENABLED ${cmakeBoolean(manifest.platforms.windows.enabled)})
set(EASY_PLUGIN_WINDOWS_ARCHITECTURES "${manifest.platforms.windows.architectures.map(cmakeEscape).sort(compareStrings).join(';')}")
set(EASY_PLUGIN_MACOS_ENABLED ${cmakeBoolean(manifest.platforms.macos.enabled)})
set(EASY_PLUGIN_MACOS_ARCHITECTURES "${manifest.platforms.macos.architectures.map(cmakeEscape).sort(compareStrings).join(';')}")
set(EASY_PLUGIN_MACOS_UNIVERSAL_BINARY ${cmakeBoolean(manifest.platforms.macos.universalBinary ?? false)})
set(EASY_PLUGIN_MIDI_INPUT ${cmakeBoolean(manifest.plugin.midiInput)})
set(EASY_PLUGIN_MIDI_OUTPUT ${cmakeBoolean(manifest.plugin.midiOutput)})
set(EASY_PLUGIN_MIDI_EFFECT ${cmakeBoolean(manifest.plugin.midiEffect)})
set(EASY_PLUGIN_IS_SYNTH ${cmakeBoolean(manifest.plugin.synth)})
set(EASY_PLUGIN_UI_WIDTH ${manifest.ui.width})
set(EASY_PLUGIN_UI_HEIGHT ${manifest.ui.height})
set(EASY_PLUGIN_CPP_STANDARD ${manifest.build.cppStandard})
set(EASY_PLUGIN_DEVELOPMENT_URL "${cmakeEscape(manifest.build.developmentServer)}")
set(EASY_PLUGIN_JUCE_VERSION "${cmakeEscape(manifest.build.juce.version)}")
set(EASY_PLUGIN_NODE_VERSION "${cmakeEscape(manifest.build.node.version)}")
set(EASY_PLUGIN_PNPM_VERSION "${cmakeEscape(manifest.build.pnpm.version)}")
set(EASY_PLUGIN_WARNINGS_AS_ERRORS ${cmakeBoolean(manifest.build.warningsAsErrors)})
set(EASY_PLUGIN_ENABLE_LTO_IN_RELEASE ${cmakeBoolean(manifest.build.enableLtoInRelease)})
`;
}

function sortedParameters(manifest: PluginManifest): ParameterDefinition[] {
  return [...manifest.parameters].sort(compareIds);
}

function sortedStateFields(manifest: PluginManifest): StateField[] {
  return [...manifest.state.fields].sort(compareIds);
}

function cppStateFieldType(field: StateField): string {
  return {
    boolean: 'boolean',
    float: 'floating',
    integer: 'integer',
    'number-array': 'numberArray',
    object: 'object',
    string: 'string',
    'string-array': 'stringArray'
  }[field.type];
}

function smoothedFloatParameters(manifest: PluginManifest): FloatParameter[] {
  return sortedParameters(manifest).filter(
    (parameter): parameter is FloatParameter =>
      parameter.type === 'float' &&
      parameter.smoothing !== undefined &&
      parameter.smoothing.type !== 'none' &&
      parameter.smoothing.milliseconds > 0
  );
}

function dspValueType(parameter: ParameterDefinition): string {
  if (parameter.type === 'float') return 'float';
  if (parameter.type === 'boolean') return 'bool';
  return 'int';
}

function renderDspSnapshotRead(parameter: ParameterDefinition, pointer: string): string {
  const fallback =
    parameter.type === 'boolean'
      ? cppFloat(parameter.default ? 1 : 0)
      : parameter.type === 'choice'
        ? cppFloat(parameter.choices.indexOf(parameter.default))
        : cppFloat(parameter.default);
  const read = `readValue(${pointer}, ${fallback})`;
  if (parameter.type === 'float') return read;
  if (parameter.type === 'boolean') return `${read} >= 0.5f`;
  return `static_cast<int>(std::lround(${read}))`;
}

interface DirectionalBus extends BusDefinition {
  input: boolean;
}

function sortedBuses(manifest: PluginManifest): DirectionalBus[] {
  const roleOrder = new Map([['main', 0], ['sidechain', 1], ['auxiliary', 2]]);
  const sortDirection = (values: readonly BusDefinition[], input: boolean) =>
    values
      .map((bus) => ({ ...bus, input }))
      .sort(
        (left, right) =>
          (roleOrder.get(left.role) ?? 3) - (roleOrder.get(right.role) ?? 3) || compareIds(left, right)
      );
  return [...sortDirection(manifest.buses.inputs, true), ...sortDirection(manifest.buses.outputs, false)];
}

function groupDepth(group: ParameterGroup, byId: ReadonlyMap<string, ParameterGroup>): number {
  let depth = 0;
  let parentId = group.parentId;
  while (parentId !== undefined) {
    depth += 1;
    parentId = byId.get(parentId)?.parentId;
  }
  return depth;
}

function attributeType(parameter: ParameterDefinition): string {
  return {
    boolean: 'juce::AudioParameterBoolAttributes',
    choice: 'juce::AudioParameterChoiceAttributes',
    float: 'juce::AudioParameterFloatAttributes',
    integer: 'juce::AudioParameterIntAttributes'
  }[parameter.type];
}

function parameterIdentifier(id: string): string {
  return `id_${encodeIdentifier(id)}`;
}

function parameterVariable(id: string): string {
  return `parameter_${encodeIdentifier(id)}`;
}

function groupVariable(id: string): string {
  return `group_${encodeIdentifier(id)}`;
}

function busLayoutVariable(bus: DirectionalBus): string {
  return `layouts_${bus.input ? 'input' : 'output'}_${encodeIdentifier(bus.id)}`;
}

function encodeIdentifier(value: string): string {
  return [...value]
    .map((character) =>
      /^[A-Za-z0-9]$/u.test(character)
        ? character
        : `_x${character.codePointAt(0)?.toString(16).padStart(2, '0') ?? '00'}_`
    )
    .join('');
}

function layoutChannelCount(layout: string): number {
  return { mono: 1, none: 0, stereo: 2 }[layout] ?? 0;
}

function compareLayouts(left: string, right: string): number {
  return layoutChannelCount(left) - layoutChannelCount(right);
}

function defaultChannelSet(bus: BusDefinition): string {
  if (bus.layouts.includes('stereo')) return 'juce::AudioChannelSet::stereo()';
  if (bus.layouts.includes('mono')) return 'juce::AudioChannelSet::mono()';
  return 'juce::AudioChannelSet::disabled()';
}

function typescriptValue(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function cppString(value: string): string {
  return JSON.stringify(value);
}

function cppBoolean(value: boolean): string {
  return value ? 'true' : 'false';
}

function cppFloat(value: number): string {
  const rendered = Number.isInteger(value) ? `${value}.0` : String(value);
  return `${rendered}f`;
}

function cppDouble(value: number): string {
  return Number.isInteger(value) ? `${value}.0` : String(value);
}

function cmakeBoolean(value: boolean): string {
  return value ? 'TRUE' : 'FALSE';
}

function cmakeEscape(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll(';', '\\;').replaceAll('"', '\\"');
}

function compareIds(left: { id: string }, right: { id: string }): number {
  return compareStrings(left.id, right.id);
}

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
