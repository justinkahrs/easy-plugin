#pragma once

#include "BridgeDispatcher.h"

#include <juce_gui_extra/juce_gui_extra.h>

#include <memory>
#include <optional>

namespace easy_plugin
{
class PluginWebView final : public juce::Component,
                            private BridgeEventSink
{
public:
    PluginWebView(
        ParameterService& parameters,
        StateService& state,
        PresetService& presets,
        TransportService& transport,
        VisualizationService& visualization,
        const juce::String& instanceId);
    ~PluginWebView() override;

    void resized() override;

private:
    class Browser;

    void emitBridgeEvent(const juce::var& envelope) override;

    [[nodiscard]] juce::WebBrowserComponent::Options createBrowserOptions();
    [[nodiscard]] static juce::String getStartUrl();
    [[nodiscard]] std::optional<juce::WebBrowserComponent::Resource> provideResource(
        const juce::String& path) const;

    juce::String instanceId;
    BridgeDispatcher dispatcher;
    std::unique_ptr<Browser> browser;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(PluginWebView)
};
}
