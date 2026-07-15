#include "BusLayouts.generated.h"
#include "DspParameters.generated.h"
#include "Parameters.generated.h"
#include "PluginMetadata.generated.h"
#include "StateMetadata.generated.h"

#include <cstddef>

int main()
{
    namespace buses = easy_plugin::generated::buses;
    namespace metadata = easy_plugin::generated::metadata;
    namespace parameters = easy_plugin::generated::parameters;

    if (metadata::pluginId != "com.example.superfilter")
        return 1;
    if (parameters::id_cutoff != "cutoff" || parameters::id_outputGain != "outputGain")
        return 2;
    if (parameters::smoothingDefinitions.size() != 3)
        return 3;

    auto parameterLayout = parameters::createParameterLayout();
    static_cast<void>(parameterLayout);

    const auto definitions = buses::getBusDefinitions();
    if (definitions.size() != 2)
        return 4;

    auto stereoLayout = juce::AudioProcessor::BusesLayout{};
    stereoLayout.inputBuses.add(juce::AudioChannelSet::stereo());
    stereoLayout.outputBuses.add(juce::AudioChannelSet::stereo());
    if (!buses::isBusLayoutSupported(stereoLayout))
        return 5;

    auto monoLayout = juce::AudioProcessor::BusesLayout{};
    monoLayout.inputBuses.add(juce::AudioChannelSet::mono());
    monoLayout.outputBuses.add(juce::AudioChannelSet::mono());
    if (!buses::isBusLayoutSupported(monoLayout))
        return 6;

    auto unsupportedLayout = juce::AudioProcessor::BusesLayout{};
    unsupportedLayout.inputBuses.add(juce::AudioChannelSet::createLCR());
    unsupportedLayout.outputBuses.add(juce::AudioChannelSet::createLCR());
    if (buses::isBusLayoutSupported(unsupportedLayout))
        return 7;

    if (easy_plugin::generated::state::schemaVersion != 3
        || easy_plugin::generated::state::getFieldDefinitions().size() != 2
        || easy_plugin::generated::state::createDefaultPluginState().getDynamicObject() == nullptr)
        return 8;

    auto smoothers = easy_plugin::generated::dsp::ParameterSmoothers{};
    const auto initial = easy_plugin::generated::dsp::ParameterValues{100.0f, 0, -24.0f, 0.1f};
    const auto target = easy_plugin::generated::dsp::ParameterValues{1'000.0f, 1, 0.0f, 1.0f};
    smoothers.prepare(48'000.0, initial);
    smoothers.setTargets(target);
    const auto firstStep = smoothers.getNext();
    if (firstStep.cutoff <= initial.cutoff || firstStep.cutoff >= target.cutoff)
        return 9;

    return 0;
}
