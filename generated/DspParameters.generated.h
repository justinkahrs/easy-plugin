// GENERATED FILE. DO NOT EDIT.
// Generated from the plugin manifest.

#pragma once

#include <juce_audio_basics/juce_audio_basics.h>
#include <juce_audio_processors/juce_audio_processors.h>

#include <atomic>

namespace easy_plugin::generated::dsp
{
struct ParameterValues
{
    float cutoff{};
    int mode{};
    float outputGain{};
    float resonance{};
};

class ParameterSnapshot final
{
public:
    explicit ParameterSnapshot(juce::AudioProcessorValueTreeState& state) noexcept;
    [[nodiscard]] ParameterValues read() const noexcept;

private:
    std::atomic<float>* value_cutoff{};
    std::atomic<float>* value_mode{};
    std::atomic<float>* value_outputGain{};
    std::atomic<float>* value_resonance{};
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
    juce::SmoothedValue<float, juce::ValueSmoothingTypes::Multiplicative> smoothed_cutoff;
    juce::SmoothedValue<float, juce::ValueSmoothingTypes::Linear> smoothed_outputGain;
    juce::SmoothedValue<float, juce::ValueSmoothingTypes::Linear> smoothed_resonance;
};
}
