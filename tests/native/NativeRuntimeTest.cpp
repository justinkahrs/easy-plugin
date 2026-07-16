#include "BridgeDispatcher.h"
#include "PluginProcessor.h"

#include <juce_gui_basics/juce_gui_basics.h>

#include <cmath>
#include <array>
#include <iostream>
#include <memory>
#include <vector>

namespace
{
class EventCollector final : public easy_plugin::BridgeEventSink
{
public:
    void emitBridgeEvent(const juce::var& envelope) override
    {
        events.push_back(envelope);
    }

    [[nodiscard]] const juce::DynamicObject* findLastPayload(const juce::String& type) const
    {
        for (auto iterator = events.rbegin(); iterator != events.rend(); ++iterator)
        {
            const auto* envelope = iterator->getDynamicObject();
            const auto* payload = envelope == nullptr
                ? nullptr
                : envelope->getProperty("payload").getDynamicObject();
            if (payload != nullptr && payload->getProperty("type").toString() == type)
                return payload;
        }
        return nullptr;
    }

    [[nodiscard]] const juce::DynamicObject* getLastEnvelope() const
    {
        return events.empty() ? nullptr : events.back().getDynamicObject();
    }

    [[nodiscard]] std::size_t getEventCount() const noexcept
    {
        return events.size();
    }

private:
    std::vector<juce::var> events;
};

class GestureListener final : public juce::AudioProcessorParameter::Listener
{
public:
    void parameterValueChanged(int, float value) override
    {
        lastValue = value;
        valueChangeCount += 1;
    }

    void parameterGestureChanged(int, bool gestureIsStarting) override
    {
        gestures.push_back(gestureIsStarting);
    }

    float lastValue{};
    int valueChangeCount{};
    std::vector<bool> gestures;
};

juce::var makeCommand(
    const juce::String& instanceId,
    const juce::String& requestId,
    const juce::String& type,
    const juce::String& parameterId = {},
    double value = 0.0,
    int version = easy_plugin::BridgeDispatcher::protocolVersion)
{
    auto* payload = new juce::DynamicObject();
    payload->setProperty("type", type);
    if (parameterId.isNotEmpty())
        payload->setProperty("parameterId", parameterId);
    if (type == "parameter.setNormalized")
        payload->setProperty("value", value);
    if (type == "bridge.ping")
        payload->setProperty("timestamp", value);

    auto* envelope = new juce::DynamicObject();
    envelope->setProperty("protocolVersion", version);
    envelope->setProperty("instanceId", instanceId);
    envelope->setProperty("requestId", requestId);
    envelope->setProperty("payload", juce::var{payload});
    return juce::var{envelope};
}

bool approximatelyEqual(float left, float right)
{
    return std::abs(left - right) < 0.0001f;
}

std::vector<int> midiOffsets(const juce::MidiBuffer& midi)
{
    auto result = std::vector<int>{};
    for (const auto metadata : midi)
        result.push_back(metadata.samplePosition);
    return result;
}
}

int main()
{
    const auto initialiseGui = juce::ScopedJuceInitialiser_GUI{};

    auto factoryProcessor = std::unique_ptr<juce::AudioProcessor>{createPluginFilter()};
    if (factoryProcessor == nullptr || factoryProcessor->getName() != "Super Filter")
        return 1;

    auto* processor = dynamic_cast<easy_plugin::PluginProcessor*>(factoryProcessor.get());
    if (processor == nullptr || processor->getParameters().size() != 4)
        return 2;
    if (processor->getParameterService().getParameterCount() != 4)
        return 3;

    auto* cutoff = processor->getParameterState().getParameter("cutoff");
    if (cutoff == nullptr)
        return 4;

    auto gestureListener = GestureListener{};
    cutoff->addListener(&gestureListener);

    auto collector = EventCollector{};
    {
        auto dispatcher = easy_plugin::BridgeDispatcher{
            processor->getInstanceId(),
            processor->getParameterService(),
            processor->getStateService(),
            processor->getPresetService(),
            processor->getTransportService(),
            processor->getVisualizationService(),
            collector};

        if (collector.getEventCount() != 0)
            return 28;
        dispatcher.handleCommand(makeCommand(
            processor->getInstanceId(),
            "frontend-ready",
            "bridge.frontendReady"));
        const auto* readyEnvelope = collector.getLastEnvelope();
        const auto* ready = collector.findLastPayload("bridge.ready");
        if (readyEnvelope == nullptr || ready == nullptr)
            return 5;
        if (readyEnvelope->getProperty("instanceId").toString() != processor->getInstanceId())
            return 6;
        if (static_cast<int>(readyEnvelope->getProperty("protocolVersion")) != 1)
            return 7;

        dispatcher.handleCommand(makeCommand(
            processor->getInstanceId(),
            "snapshot-1",
            "state.requestSnapshot"));
        const auto* snapshot = collector.findLastPayload("state.snapshot");
        if (snapshot == nullptr || static_cast<int>(snapshot->getProperty("schemaVersion")) != 3)
            return 8;
        const auto* snapshotParameters = snapshot->getProperty("parameters").getDynamicObject();
        if (snapshotParameters == nullptr || !snapshotParameters->hasProperty("cutoff"))
            return 9;

        dispatcher.handleCommand(makeCommand(
            processor->getInstanceId(),
            "gesture-1",
            "parameter.beginGesture",
            "cutoff"));
        dispatcher.handleCommand(makeCommand(
            processor->getInstanceId(),
            "set-1",
            "parameter.setNormalized",
            "cutoff",
            0.25));
        dispatcher.handleCommand(makeCommand(
            processor->getInstanceId(),
            "gesture-2",
            "parameter.endGesture",
            "cutoff"));
        if (!approximatelyEqual(cutoff->getValue(), 0.25f))
            return 10;
        if (gestureListener.gestures != std::vector<bool>{true, false})
            return 11;

        processor->getParameterService().flushPendingParameterChanges();
        const auto* uiChange = collector.findLastPayload("parameter.changed");
        if (uiChange == nullptr || uiChange->getProperty("source").toString() != "ui")
            return 12;

        cutoff->setValueNotifyingHost(0.75f);
        processor->getParameterService().flushPendingParameterChanges();
        const auto* hostChange = collector.findLastPayload("parameter.changed");
        if (hostChange == nullptr || hostChange->getProperty("source").toString() != "host")
            return 13;
        if (!approximatelyEqual(static_cast<float>(hostChange->getProperty("normalizedValue")), 0.75f))
            return 14;

        dispatcher.handleCommand(makeCommand(
            processor->getInstanceId(),
            "bad-version",
            "state.requestSnapshot",
            {},
            0.0,
            99));
        const auto* protocolError = collector.findLastPayload("error");
        if (protocolError == nullptr || protocolError->getProperty("code").toString() != "unsupported-protocol")
            return 15;

        dispatcher.handleCommand(makeCommand(
            "different-instance",
            "bad-instance",
            "state.requestSnapshot"));
        const auto* instanceError = collector.findLastPayload("error");
        if (instanceError == nullptr || instanceError->getProperty("code").toString() != "instance-mismatch")
            return 16;
    }

    cutoff->removeListener(&gestureListener);

    {
        auto reopenedCollector = EventCollector{};
        auto reopenedDispatcher = easy_plugin::BridgeDispatcher{
            processor->getInstanceId(),
            processor->getParameterService(),
            processor->getStateService(),
            processor->getPresetService(),
            processor->getTransportService(),
            processor->getVisualizationService(),
            reopenedCollector};
        reopenedDispatcher.handleCommand(makeCommand(
            processor->getInstanceId(),
            "frontend-ready-reopened",
            "bridge.frontendReady"));
        reopenedDispatcher.handleCommand(makeCommand(
            processor->getInstanceId(),
            "snapshot-reopened",
            "state.requestSnapshot"));
        const auto* snapshot = reopenedCollector.findLastPayload("state.snapshot");
        const auto* values = snapshot == nullptr
            ? nullptr
            : snapshot->getProperty("parameters").getDynamicObject();
        if (values == nullptr ||
            !approximatelyEqual(static_cast<float>(values->getProperty("cutoff")), 0.75f))
            return 17;
    }

    processor->prepareToPlay(48'000.0, 64);
    auto audio = juce::AudioBuffer<float>{2, 32};
    audio.clear();
    audio.addFrom(0, 0, std::vector<float>(32, 0.25f).data(), 32);
    auto midi = juce::MidiBuffer{};
    midi.addEvent(juce::MidiMessage::noteOn(1, 60, static_cast<juce::uint8>(100)), 0);
    midi.addEvent(juce::MidiMessage::controllerEvent(1, 74, 96), 7);
    midi.addEvent(juce::MidiMessage::noteOff(1, 60), 31);
    const auto expectedMidiOffsets = midiOffsets(midi);
    processor->processBlock(audio, midi);
    if (!std::isfinite(audio.getSample(0, 0)) || approximatelyEqual(audio.getSample(0, 0), 0.25f))
        return 18;
    if (midiOffsets(midi) != expectedMidiOffsets)
        return 23;

    auto state = juce::MemoryBlock{};
    cutoff->setValueNotifyingHost(0.33f);
    processor->getStateInformation(state);
    auto restoredProcessor = std::make_unique<easy_plugin::PluginProcessor>();
    restoredProcessor->setStateInformation(state.getData(), static_cast<int>(state.getSize()));
    auto* restoredCutoff = restoredProcessor->getParameterState().getParameter("cutoff");
    if (restoredCutoff == nullptr || !approximatelyEqual(restoredCutoff->getValue(), 0.33f))
    {
        std::cerr << "restored cutoff=" << (restoredCutoff == nullptr ? -1.0f : restoredCutoff->getValue())
                  << " state=" << juce::String::fromUTF8(
                         static_cast<const char*>(state.getData()),
                         static_cast<int>(state.getSize()))
                  << '\n';
        return 19;
    }

    if (processor->getInstanceId() == restoredProcessor->getInstanceId())
        return 20;
    restoredCutoff->setValueNotifyingHost(0.9f);
    if (approximatelyEqual(cutoff->getValue(), restoredCutoff->getValue()))
        return 21;

    if (processor->getVisualizationService().getListenerCountForTesting() != 0)
        return 24;
    for (auto cycle = 0; cycle < 3; ++cycle)
    {
        auto editor = std::unique_ptr<juce::AudioProcessorEditor>{processor->createEditor()};
        if (editor == nullptr || editor->getWidth() != 720 || editor->getHeight() != 480)
            return 22;
        auto hasResizeHandle = false;
        auto webViewLeavesResizeStripVisible = false;
        for (auto childIndex = 0; childIndex < editor->getNumChildComponents(); ++childIndex)
        {
            auto* child = editor->getChildComponent(childIndex);
            if (dynamic_cast<juce::ResizableCornerComponent*>(child) != nullptr)
                hasResizeHandle = true;
            else if (child != nullptr)
                webViewLeavesResizeStripVisible = child->getBottom() <= editor->getHeight() - 18;
        }
        if (!editor->isResizable() || !hasResizeHandle || !webViewLeavesResizeStripVisible)
            return 29;
        if (processor->getVisualizationService().getListenerCountForTesting() != 1)
            return 25;
    }
    if (processor->getVisualizationService().getListenerCountForTesting() != 0)
        return 26;

    processor->setNonRealtime(true);
    for (const auto& specification : std::array{
             std::pair{44'100.0, 17},
             std::pair{48'000.0, 64},
             std::pair{96'000.0, 2'048}})
    {
        processor->prepareToPlay(specification.first, specification.second);
        auto offlineAudio = juce::AudioBuffer<float>{2, specification.second};
        offlineAudio.clear();
        if (specification.second > 0)
            offlineAudio.setSample(0, 0, 1.0f);
        auto offlineMidi = juce::MidiBuffer{};
        offlineMidi.addEvent(juce::MidiMessage::noteOn(1, 64, static_cast<juce::uint8>(90)), specification.second - 1);
        processor->processBlock(offlineAudio, offlineMidi);
        if (!std::isfinite(offlineAudio.getMagnitude(0, offlineAudio.getNumSamples()))
            || midiOffsets(offlineMidi) != std::vector<int>{specification.second - 1})
            return 27;
    }
    return 0;
}
