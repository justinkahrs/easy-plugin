// GENERATED FILE. DO NOT EDIT.
// Generated from the plugin manifest.

#include "BusLayouts.generated.h"

#include <algorithm>
#include <array>
#include <cstddef>

namespace easy_plugin::generated::buses
{
namespace
{
constexpr std::array<int, 2> layouts_input_main{{ 1, 2 }};
constexpr std::array<int, 2> layouts_output_main{{ 1, 2 }};

constexpr std::array<BusDefinition, 2> busDefinitions{{
    BusDefinition{ "main", "Input", BusRole::main, true, false, layouts_input_main },
    BusDefinition{ "main", "Output", BusRole::main, false, false, layouts_output_main }
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
        .withInput("Input", juce::AudioChannelSet::stereo(), true)
        .withOutput("Output", juce::AudioChannelSet::stereo(), true))
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
    const auto expectedInputs = static_cast<std::size_t>(1);
    const auto expectedOutputs = static_cast<std::size_t>(1);
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
