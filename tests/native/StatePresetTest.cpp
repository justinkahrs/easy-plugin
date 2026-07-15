#include "BridgeDispatcher.h"
#include "FactoryPresets.h"
#include "PluginProcessor.h"
#include "PresetService.h"
#include "StateMetadata.generated.h"

#include <juce_gui_basics/juce_gui_basics.h>

#include <cmath>
#include <iostream>

namespace
{
bool approximatelyEqual(float left, float right)
{
    return std::abs(left - right) < 0.0001f;
}

juce::var legacyState()
{
    return juce::JSON::parse(R"json({
      "schemaVersion": 1,
      "parameters": {
        "cutoff": 0.21,
        "mode": 0.5,
        "outputGain": 0.4,
        "resonance": 0.8
      },
      "pluginState": { "analyzer_on": false },
      "uiState": { "tab": "output" }
    })json");
}

class EventCollector final : public easy_plugin::BridgeEventSink
{
public:
    void emitBridgeEvent(const juce::var& value) override { last = value; }

    [[nodiscard]] const juce::DynamicObject* lastPayload() const
    {
        const auto* envelope = last.getDynamicObject();
        return envelope == nullptr ? nullptr : envelope->getProperty("payload").getDynamicObject();
    }

private:
    juce::var last;
};

juce::var snapshotCommand(const juce::String& instanceId)
{
    auto payload = juce::var{new juce::DynamicObject()};
    payload.getDynamicObject()->setProperty("type", "state.requestSnapshot");
    auto envelope = juce::var{new juce::DynamicObject()};
    envelope.getDynamicObject()->setProperty("protocolVersion", 1);
    envelope.getDynamicObject()->setProperty("instanceId", instanceId);
    envelope.getDynamicObject()->setProperty("requestId", "rehydrate");
    envelope.getDynamicObject()->setProperty("payload", payload);
    return envelope;
}
}

int main()
{
    const auto initialiseGui = juce::ScopedJuceInitialiser_GUI{};
    auto processor = easy_plugin::PluginProcessor{};
    auto& parameters = processor.getParameterService();
    auto& state = processor.getStateService();
    auto* cutoff = processor.getParameterState().getParameter("cutoff");
    if (cutoff == nullptr || easy_plugin::generated::state::schemaVersion != 3)
        return 1;

    cutoff->setValueNotifyingHost(0.27f);
    if (!state.setField("analyzerEnabled", false).succeeded()
        || !state.setField("selectedTab", "output").succeeded())
        return 2;
    const auto serialized = state.serialise(true);
    const auto serializedDocument = juce::JSON::parse(serialized);
    const auto* serializedObject = serializedDocument.getDynamicObject();
    if (serializedObject == nullptr
        || static_cast<int>(serializedObject->getProperty("schemaVersion")) != 3)
        return 3;

    cutoff->setValueNotifyingHost(0.91f);
    static_cast<void>(state.setField("analyzerEnabled", true));
    static_cast<void>(state.setField("selectedTab", "main"));
    const auto restored = state.restoreFromText(serialized, easy_plugin::StateService::ChangeSource::state);
    if (!restored.succeeded() || !approximatelyEqual(cutoff->getValue(), 0.27f))
    {
        std::cerr << "restore=" << restored.code << ":" << restored.message
                  << " cutoff=" << cutoff->getValue() << '\n';
        return 4;
    }
    if (static_cast<bool>(state.getField("analyzerEnabled"))
        || state.getField("selectedTab").toString() != "output")
        return 5;

    const auto withoutUi = state.createDocument(false);
    static_cast<void>(state.setField("selectedTab", "temporary"));
    const auto restoredWithoutUi = state.applyDocument(
        withoutUi,
        easy_plugin::StateService::ChangeSource::state);
    if (!restoredWithoutUi.succeeded() || state.getField("selectedTab").toString() != "main")
        return 6;

    const auto migrated = state.applyDocument(
        legacyState(),
        easy_plugin::StateService::ChangeSource::state);
    if (!migrated.succeeded()
        || static_cast<bool>(state.getField("analyzerEnabled"))
        || state.getField("selectedTab").toString() != "output"
        || !approximatelyEqual(cutoff->getValue(), 0.21f))
        return 7;

    auto newer = state.createDocument(true);
    newer.getDynamicObject()->setProperty("schemaVersion", 99);
    cutoff->setValueNotifyingHost(0.36f);
    const auto rejected = state.applyDocument(newer, easy_plugin::StateService::ChangeSource::state);
    if (rejected.succeeded() || rejected.code != "newer-state-version"
        || !approximatelyEqual(cutoff->getValue(), 0.36f))
        return 8;

    const auto temporaryDirectory = juce::File::getSpecialLocation(juce::File::tempDirectory)
        .getNonexistentChildFile("easy-plugin-preset-tests", {}, false);
    auto presets = easy_plugin::PresetService{
        state,
        parameters,
        temporaryDirectory,
        easy_plugin::getFactoryPresets()};
    if (presets.listPresets().size() != 2)
        return 9;

    const auto legacyPreset = presets.loadPreset("factory:legacy-resonator");
    if (!legacyPreset.succeeded()
        || !approximatelyEqual(cutoff->getValue(), 0.43f)
        || static_cast<bool>(state.getField("analyzerEnabled")))
        return 10;
    const auto protectedFactory = presets.deletePreset("factory:legacy-resonator");
    if (protectedFactory.succeeded() || protectedFactory.code != "factory-preset-protected")
        return 11;

    cutoff->setValueNotifyingHost(0.31f);
    static_cast<void>(state.setField("analyzerEnabled", true));
    const auto saved = presets.savePreset("Round Trip", "Clean", {"test"});
    if (!saved.succeeded() || saved.preset.factory || !saved.preset.id.startsWith("user:"))
        return 12;
    cutoff->setValueNotifyingHost(0.88f);
    static_cast<void>(state.setField("analyzerEnabled", false));
    const auto userLoaded = presets.loadPreset(saved.preset.id);
    if (!userLoaded.succeeded()
        || !approximatelyEqual(cutoff->getValue(), 0.31f)
        || !static_cast<bool>(state.getField("analyzerEnabled")))
        return 13;

    cutoff->setValueNotifyingHost(0.44f);
    parameters.flushPendingParameterChanges();
    if (!presets.getCurrentPreset().dirty)
        return 14;

    const auto deleted = presets.deletePreset(saved.preset.id);
    if (!deleted.succeeded() || presets.listPresets().size() != 2)
        return 15;

    auto hostState = juce::MemoryBlock{};
    processor.getStateInformation(hostState);
    auto hostRestored = easy_plugin::PluginProcessor{};
    hostRestored.setStateInformation(hostState.getData(), static_cast<int>(hostState.getSize()));
    if (!approximatelyEqual(
            hostRestored.getParameterState().getParameter("cutoff")->getValue(),
            cutoff->getValue())
        || static_cast<bool>(hostRestored.getStateService().getField("analyzerEnabled"))
            != static_cast<bool>(state.getField("analyzerEnabled")))
        return 16;

    auto collector = EventCollector{};
    auto dispatcher = easy_plugin::BridgeDispatcher{
        processor.getInstanceId(),
        parameters,
        state,
        presets,
        processor.getTransportService(),
        processor.getVisualizationService(),
        collector};
    dispatcher.handleCommand(snapshotCommand(processor.getInstanceId()));
    const auto* snapshot = collector.lastPayload();
    const auto* pluginState = snapshot == nullptr
        ? nullptr
        : snapshot->getProperty("pluginState").getDynamicObject();
    if (snapshot == nullptr
        || snapshot->getProperty("type").toString() != "state.snapshot"
        || pluginState == nullptr
        || !pluginState->hasProperty("analyzerEnabled"))
        return 17;

    static_cast<void>(temporaryDirectory.deleteRecursively());
    return 0;
}
