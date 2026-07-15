#include "PluginProcessor.h"

#include "Parameters.generated.h"
#include "PluginEditor.h"
#include "PluginMetadata.generated.h"
#include "StateMigrations.h"

#include <algorithm>
#include <memory>

namespace easy_plugin
{
PluginProcessor::PluginProcessor()
    : instanceId(juce::Uuid{}.toString()),
      parameterState(
          *this,
          nullptr,
          "PARAMETERS",
          generated::parameters::createParameterLayout()),
      parameterService(parameterState, *this),
      stateService(parameterService, createStateMigrationRegistry()),
      presetService(
          stateService,
          parameterService,
          getDefaultUserPresetDirectory(),
          getFactoryPresets()),
      visualizationService(transportService),
      parameterSnapshot(parameterState)
{
}

PluginProcessor::~PluginProcessor() = default;

void PluginProcessor::prepareToPlay(double sampleRate, int samplesPerBlock)
{
    visualizationService.prepare(sampleRate);
    dsp.prepare(
        {sampleRate, samplesPerBlock, getTotalNumOutputChannels()},
        parameterSnapshot.read());
}

void PluginProcessor::releaseResources()
{
    dsp.reset();
}

void PluginProcessor::processBlock(
    juce::AudioBuffer<float>& audio,
    juce::MidiBuffer& midi)
{
    const auto noDenormals = juce::ScopedNoDenormals{};
    const auto* playHead = getPlayHead();
    transportService.capture(
        playHead == nullptr
            ? juce::Optional<juce::AudioPlayHead::PositionInfo>{}
            : playHead->getPosition());
    const auto inputChannels = getTotalNumInputChannels();
    const auto outputChannels = getTotalNumOutputChannels();
    for (auto channel = inputChannels; channel < outputChannels; ++channel)
        audio.clear(channel, 0, audio.getNumSamples());

    dsp.process(audio, midi, parameterSnapshot.read());
    visualizationService.captureAudio(audio);
}

const juce::String PluginProcessor::getName() const
{
    return juce::String{generated::metadata::pluginName.data()};
}

bool PluginProcessor::acceptsMidi() const
{
    return generated::metadata::acceptsMidi;
}

bool PluginProcessor::producesMidi() const
{
    return generated::metadata::producesMidi;
}

bool PluginProcessor::isMidiEffect() const
{
    return generated::metadata::isMidiEffect;
}

double PluginProcessor::getTailLengthSeconds() const
{
    return 0.0;
}

int PluginProcessor::getNumPrograms()
{
    return 1;
}

int PluginProcessor::getCurrentProgram()
{
    return 0;
}

void PluginProcessor::setCurrentProgram(int)
{
}

const juce::String PluginProcessor::getProgramName(int)
{
    return "Default";
}

void PluginProcessor::changeProgramName(int, const juce::String&)
{
}

bool PluginProcessor::hasEditor() const
{
    return true;
}

juce::AudioProcessorEditor* PluginProcessor::createEditor()
{
    return new PluginEditor(*this);
}

void PluginProcessor::getStateInformation(juce::MemoryBlock& destinationData)
{
    const auto serialised = stateService.serialise(true);
    destinationData.replaceAll(serialised.toRawUTF8(), serialised.getNumBytesAsUTF8());
}

void PluginProcessor::setStateInformation(const void* data, int sizeInBytes)
{
    if (data == nullptr || sizeInBytes <= 0)
        return;
    static_cast<void>(stateService.restoreFromText(
        juce::String::fromUTF8(static_cast<const char*>(data), sizeInBytes),
        StateService::ChangeSource::state));
}
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter()
{
    return new easy_plugin::PluginProcessor();
}
