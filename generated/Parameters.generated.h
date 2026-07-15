// GENERATED FILE. DO NOT EDIT.
// Generated from the plugin manifest.

#pragma once

#include <juce_audio_processors/juce_audio_processors.h>

#include <array>
#include <string_view>

namespace easy_plugin::generated::parameters
{
inline constexpr std::string_view id_cutoff = "cutoff";
inline constexpr std::string_view id_mode = "mode";
inline constexpr std::string_view id_outputGain = "outputGain";
inline constexpr std::string_view id_resonance = "resonance";

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

inline constexpr std::array<SmoothingDefinition, 3> smoothingDefinitions{{
    SmoothingDefinition{ id_cutoff, SmoothingType::multiplicative, 30.0 },
    SmoothingDefinition{ id_outputGain, SmoothingType::linear, 20.0 },
    SmoothingDefinition{ id_resonance, SmoothingType::linear, 20.0 }
}};

[[nodiscard]] juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout();
}
