#include "DspProcessor.h"

#include <algorithm>
#include <cmath>

namespace easy_plugin
{
void DspProcessor::prepare(
    const DspProcessSpec& spec,
    const generated::dsp::ParameterValues& initialParameters) noexcept
{
    sampleRate = std::max(1.0, spec.sampleRate);
    preparedChannelCount = std::clamp(spec.channelCount, 0, maximumSupportedChannels);
    lastParameters = initialParameters;
    smoothers.prepare(sampleRate, initialParameters);
    for (auto& channel : channels)
        channel = {};
}

void DspProcessor::reset() noexcept
{
    for (auto& channel : channels)
        channel = {};
    smoothers.reset(lastParameters);
}

void DspProcessor::process(
    juce::AudioBuffer<float>& audio,
    juce::MidiBuffer&,
    const generated::dsp::ParameterValues& parameterTargets) noexcept
{
    lastParameters = parameterTargets;
    smoothers.setTargets(parameterTargets);

    const auto sampleCount = audio.getNumSamples();
    const auto channelCount = std::min({audio.getNumChannels(), preparedChannelCount, maximumSupportedChannels});
    if (sampleCount <= 0 || channelCount <= 0)
        return;

    for (auto sample = 0; sample < sampleCount; ++sample)
    {
        const auto parameters = smoothers.getNext();
        const auto cutoff = std::clamp(parameters.cutoff, 10.0f, static_cast<float>(sampleRate * 0.45));
        const auto resonance = std::clamp(parameters.resonance, 0.1f, 20.0f);
        const auto gain = std::pow(10.0f, parameters.outputGain / 20.0f);
        const auto g = std::tan(juce::MathConstants<float>::pi * cutoff / static_cast<float>(sampleRate));
        const auto damping = 1.0f / resonance;
        const auto a1 = 1.0f / (1.0f + g * (g + damping));
        const auto a2 = g * a1;
        const auto a3 = g * a2;

        for (auto channel = 0; channel < channelCount; ++channel)
        {
            auto& filter = channels[static_cast<std::size_t>(channel)];
            const auto input = audio.getSample(channel, sample);
            const auto v3 = input - filter.integrator2;
            const auto band = a1 * filter.integrator1 + a2 * v3;
            const auto low = filter.integrator2 + a2 * filter.integrator1 + a3 * v3;
            filter.integrator1 = 2.0f * band - filter.integrator1;
            filter.integrator2 = 2.0f * low - filter.integrator2;
            const auto high = input - damping * band - low;

            const auto filtered = parameters.mode == 1 ? high : parameters.mode == 2 ? band : low;
            const auto output = filtered * gain;
            audio.setSample(channel, sample, std::isfinite(output) ? output : 0.0f);
        }
    }
}
}
