// GENERATED FILE. DO NOT EDIT.
// Generated from the plugin manifest.

#pragma once

#include <juce_core/juce_core.h>

#include <array>
#include <span>
#include <string_view>

namespace easy_plugin::generated::state
{
inline constexpr int schemaVersion = 3;

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

inline constexpr std::string_view presetExtension = "superfilterpreset";
inline constexpr std::string_view factoryPresetDirectory = "presets/factory";
inline constexpr std::string_view userPresetDirectoryName = "Super Filter";
inline constexpr bool presetsIncludeUiState = false;
inline constexpr std::array<std::string_view, 3> presetCategories{{
    "Clean", "Creative", "Utility"
}};
}
