#pragma once

#include "BusLayouts.generated.h"
#include "DspParameters.generated.h"
#include "DspProcessor.h"
#include "ParameterService.h"
#include "PresetService.h"
#include "StateService.h"
#include "TransportService.h"
#include "VisualizationService.h"

#include <juce_audio_processors/juce_audio_processors.h>

namespace easy_plugin
{
class PluginProcessor final : public generated::buses::ManifestAudioProcessor
{
public:
    PluginProcessor();
    ~PluginProcessor() override;

    void prepareToPlay(double sampleRate, int samplesPerBlock) override;
    void releaseResources() override;
    void processBlock(juce::AudioBuffer<float>& audio, juce::MidiBuffer& midi) override;

    [[nodiscard]] const juce::String getName() const override;
    [[nodiscard]] bool acceptsMidi() const override;
    [[nodiscard]] bool producesMidi() const override;
    [[nodiscard]] bool isMidiEffect() const override;
    [[nodiscard]] double getTailLengthSeconds() const override;

    [[nodiscard]] int getNumPrograms() override;
    [[nodiscard]] int getCurrentProgram() override;
    void setCurrentProgram(int index) override;
    [[nodiscard]] const juce::String getProgramName(int index) override;
    void changeProgramName(int index, const juce::String& newName) override;

    [[nodiscard]] bool hasEditor() const override;
    [[nodiscard]] juce::AudioProcessorEditor* createEditor() override;

    void getStateInformation(juce::MemoryBlock& destinationData) override;
    void setStateInformation(const void* data, int sizeInBytes) override;

    [[nodiscard]] juce::AudioProcessorValueTreeState& getParameterState() noexcept
    {
        return parameterState;
    }

    [[nodiscard]] ParameterService& getParameterService() noexcept
    {
        return parameterService;
    }

    [[nodiscard]] StateService& getStateService() noexcept
    {
        return stateService;
    }

    [[nodiscard]] PresetService& getPresetService() noexcept
    {
        return presetService;
    }

    [[nodiscard]] TransportService& getTransportService() noexcept
    {
        return transportService;
    }

    [[nodiscard]] VisualizationService& getVisualizationService() noexcept
    {
        return visualizationService;
    }

    [[nodiscard]] const juce::String& getInstanceId() const noexcept
    {
        return instanceId;
    }

private:
    const juce::String instanceId;
    juce::AudioProcessorValueTreeState parameterState;
    ParameterService parameterService;
    StateService stateService;
    PresetService presetService;
    TransportService transportService;
    VisualizationService visualizationService;
    generated::dsp::ParameterSnapshot parameterSnapshot;
    DspProcessor dsp;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(PluginProcessor)
};
}

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter();
