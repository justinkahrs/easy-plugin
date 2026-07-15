// GENERATED FILE. DO NOT EDIT.
// Generated from the plugin manifest.

#include "DspParameters.generated.h"

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
    :       value_cutoff(state.getRawParameterValue(juce::String{ easy_plugin::generated::parameters::id_cutoff.data() })),
      value_mode(state.getRawParameterValue(juce::String{ easy_plugin::generated::parameters::id_mode.data() })),
      value_outputGain(state.getRawParameterValue(juce::String{ easy_plugin::generated::parameters::id_outputGain.data() })),
      value_resonance(state.getRawParameterValue(juce::String{ easy_plugin::generated::parameters::id_resonance.data() }))
{
}

ParameterValues ParameterSnapshot::read() const noexcept
{
    return ParameterValues{
        readValue(value_cutoff, 1000.0f),
        static_cast<int>(std::lround(readValue(value_mode, 0.0f))),
        readValue(value_outputGain, 0.0f),
        readValue(value_resonance, 0.7f)
    };
}

void ParameterSmoothers::prepare(double sampleRate, const ParameterValues& initialValues) noexcept
{
    const auto safeSampleRate = std::max(1.0, sampleRate);
    smoothed_cutoff.reset(safeSampleRate, 0.03);
    smoothed_outputGain.reset(safeSampleRate, 0.02);
    smoothed_resonance.reset(safeSampleRate, 0.02);
    reset(initialValues);
}

void ParameterSmoothers::reset(const ParameterValues& values) noexcept
{
    current = values;
    smoothed_cutoff.setCurrentAndTargetValue(values.cutoff);
    smoothed_outputGain.setCurrentAndTargetValue(values.outputGain);
    smoothed_resonance.setCurrentAndTargetValue(values.resonance);
}

void ParameterSmoothers::setTargets(const ParameterValues& values) noexcept
{
    current = values;
    smoothed_cutoff.setTargetValue(values.cutoff);
    smoothed_outputGain.setTargetValue(values.outputGain);
    smoothed_resonance.setTargetValue(values.resonance);
}

ParameterValues ParameterSmoothers::getNext() noexcept
{
    auto result = current;
    result.cutoff = smoothed_cutoff.getNextValue();
    result.outputGain = smoothed_outputGain.getNextValue();
    result.resonance = smoothed_resonance.getNextValue();
    return result;
}

bool ParameterSmoothers::isSmoothing() const noexcept
{
    return smoothed_cutoff.isSmoothing() || smoothed_outputGain.isSmoothing() || smoothed_resonance.isSmoothing();
}
}
