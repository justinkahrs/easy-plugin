#pragma once

#include "ParameterService.h"
#include "PresetService.h"
#include "StateService.h"
#include "TransportService.h"
#include "VisualizationService.h"

#include <juce_core/juce_core.h>

namespace easy_plugin
{
class BridgeEventSink
{
public:
    virtual ~BridgeEventSink() = default;
    virtual void emitBridgeEvent(const juce::var& envelope) = 0;
};

class BridgeDispatcher final : private ParameterService::Listener,
                               private StateService::Listener,
                               private PresetService::Listener,
                               private VisualizationService::Listener
{
public:
    static constexpr int protocolVersion = 1;

    BridgeDispatcher(
        juce::String instanceId,
        ParameterService& parameters,
        StateService& state,
        PresetService& presets,
        TransportService& transport,
        VisualizationService& visualization,
        BridgeEventSink& eventSink);
    ~BridgeDispatcher() override;

    void frontendLoaded();
    void handleCommand(const juce::var& command);

    [[nodiscard]] const juce::String& getInstanceId() const noexcept { return instanceId; }

private:
    void parameterChangedFromNative(
        const juce::String& parameterId,
        float normalizedValue,
        ParameterService::ChangeSource source) override;
    void stateFieldChanged(
        const juce::String& fieldId,
        const juce::var& value,
        StateService::ChangeSource source) override;
    void stateRestored(StateService::ChangeSource source) override;
    void presetDirtyChanged(bool dirty) override;
    void transportChanged(const TransportSnapshot& snapshot) override;
    void meterFrame(
        const MeterAccumulator::Frame& frame,
        std::uint64_t sequence,
        double timestamp) override;
    void analyzerFrame(
        const VisualizationService::AnalyzerFrame& frame,
        std::uint64_t sequence,
        double timestamp) override;

    void emitPayload(juce::var payload, const juce::String& requestId = {});
    void emitReady();
    void emitSnapshot(const juce::String& requestId);
    void emitPong(const juce::String& requestId, double timestamp);
    void emitPresetList(const juce::String& requestId = {});
    void emitPresetEvent(
        const juce::String& type,
        const PresetService::PresetInfo& preset,
        const juce::String& requestId);
    void emitTransportSnapshot(const TransportSnapshot& snapshot, const juce::String& requestId = {});
    void emitError(
        const juce::String& requestId,
        const juce::String& category,
        const juce::String& code,
        const juce::String& message);
    void handleParameterCommand(
        const juce::String& type,
        const juce::DynamicObject& payload,
        const juce::String& requestId);
    void handleStateCommand(const juce::DynamicObject& payload, const juce::String& requestId);
    void handlePresetCommand(
        const juce::String& type,
        const juce::DynamicObject& payload,
        const juce::String& requestId);
    void handleVisualizationCommand(
        const juce::String& type,
        const juce::DynamicObject& payload,
        const juce::String& requestId);

    juce::String instanceId;
    ParameterService& parameters;
    StateService& state;
    PresetService& presets;
    TransportService& transport;
    VisualizationService& visualization;
    BridgeEventSink& eventSink;
    bool frontendReady{};

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(BridgeDispatcher)
};
}
