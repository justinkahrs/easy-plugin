// GENERATED FILE. DO NOT EDIT.
// Generated from the plugin manifest.

#include "Parameters.generated.h"

#include <memory>
#include <utility>

namespace easy_plugin::generated::parameters
{
juce::AudioProcessorValueTreeState::ParameterLayout createParameterLayout()
{
    auto layout = juce::AudioProcessorValueTreeState::ParameterLayout{};
    auto group_filter = std::make_unique<juce::AudioProcessorParameterGroup>(
        "filter", "Filter", " / ");
    auto group_output = std::make_unique<juce::AudioProcessorParameterGroup>(
        "output", "Output", " / ");

    auto parameter_cutoff_range = juce::NormalisableRange<float>{ 20.0f, 20000.0f, 0.0f };
    parameter_cutoff_range.setSkewForCentre(632.4555320336759f);
    auto parameter_cutoff = std::make_unique<juce::AudioParameterFloat>(
        juce::ParameterID{ juce::String{ id_cutoff.data() }, 1 },
        "Cutoff",
        parameter_cutoff_range,
        1000.0f,
        juce::AudioParameterFloatAttributes{}.withLabel("Hz").withAutomatable(true));
    group_filter->addChild(std::move(parameter_cutoff));

    auto parameter_mode = std::make_unique<juce::AudioParameterChoice>(
        juce::ParameterID{ juce::String{ id_mode.data() }, 1 },
        "Mode",
        juce::StringArray{ "Low-pass", "High-pass", "Band-pass" },
        0,
        juce::AudioParameterChoiceAttributes{}.withLabel("").withAutomatable(true));
    group_filter->addChild(std::move(parameter_mode));

    auto parameter_outputGain_range = juce::NormalisableRange<float>{ -24.0f, 12.0f, 0.1f };
    auto parameter_outputGain = std::make_unique<juce::AudioParameterFloat>(
        juce::ParameterID{ juce::String{ id_outputGain.data() }, 1 },
        "Output",
        parameter_outputGain_range,
        0.0f,
        juce::AudioParameterFloatAttributes{}.withLabel("dB").withAutomatable(true));
    group_output->addChild(std::move(parameter_outputGain));

    auto parameter_resonance_range = juce::NormalisableRange<float>{ 0.1f, 10.0f, 0.0f };
    auto parameter_resonance = std::make_unique<juce::AudioParameterFloat>(
        juce::ParameterID{ juce::String{ id_resonance.data() }, 1 },
        "Resonance",
        parameter_resonance_range,
        0.7f,
        juce::AudioParameterFloatAttributes{}.withLabel("").withAutomatable(true));
    group_filter->addChild(std::move(parameter_resonance));

    layout.add(std::move(group_filter));
    layout.add(std::move(group_output));

    return layout;
}
}
