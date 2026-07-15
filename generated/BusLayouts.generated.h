// GENERATED FILE. DO NOT EDIT.
// Generated from the plugin manifest.

#pragma once

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
