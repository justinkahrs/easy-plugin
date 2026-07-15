#pragma once

#include "DspParameters.generated.h"

#include <juce_audio_basics/juce_audio_basics.h>

#include <array>

namespace easy_plugin
{
struct DspProcessSpec
{
    double sampleRate{};
    int maximumBlockSize{};
    int channelCount{};
};

class DspProcessor final
{
public:
    void prepare(
        const DspProcessSpec& spec,
        const generated::dsp::ParameterValues& initialParameters) noexcept;
    void reset() noexcept;
    void process(
        juce::AudioBuffer<float>& audio,
        juce::MidiBuffer& midi,
        const generated::dsp::ParameterValues& parameterTargets) noexcept;

    [[nodiscard]] bool isSmoothing() const noexcept { return smoothers.isSmoothing(); }

private:
    struct ChannelState
    {
        float integrator1{};
        float integrator2{};
    };

    static constexpr int maximumSupportedChannels = 64;

    std::array<ChannelState, maximumSupportedChannels> channels{};
    generated::dsp::ParameterSmoothers smoothers;
    generated::dsp::ParameterValues lastParameters{};
    double sampleRate{44'100.0};
    int preparedChannelCount{};
};
}
