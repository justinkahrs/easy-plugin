// GENERATED FILE. DO NOT EDIT.
// Generated from the plugin manifest.

#include "StateMetadata.generated.h"

#include <algorithm>
#include <cmath>

namespace easy_plugin::generated::state
{
namespace
{
constexpr std::array<FieldDefinition, 2> definitions{{
    FieldDefinition{ "analyzerEnabled", FieldType::boolean, Persistence::plugin, "true" },
    FieldDefinition{ "selectedTab", FieldType::string, Persistence::ui, "\"main\"" }
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
    return parseDefaults("{\"analyzerEnabled\":true}");
}

juce::var createDefaultUiState()
{
    return parseDefaults("{\"selectedTab\":\"main\"}");
}
}
