#include "PluginWebView.h"

#include "FrontendAssets.h"

#include <cstddef>
#include <string_view>
#include <vector>

namespace easy_plugin
{
namespace
{
const juce::Identifier commandEventId{"easyPlugin.command"};
const juce::Identifier nativeEventId{"easyPlugin.event"};

juce::var makeInitialisationData(const juce::String& instanceId)
{
    auto* data = new juce::DynamicObject();
    data->setProperty("protocolVersion", BridgeDispatcher::protocolVersion);
    data->setProperty("instanceId", instanceId);
#if defined(EASY_PLUGIN_DEVELOPMENT_BUILD)
    data->setProperty("assetSource", "development-server");
#else
    data->setProperty("assetSource", "embedded");
#endif
    return juce::var{data};
}
}

class PluginWebView::Browser final : public juce::WebBrowserComponent
{
public:
    Browser(PluginWebView& ownerIn, const Options& options)
        : WebBrowserComponent(options), owner(ownerIn)
    {
    }

    void pageFinishedLoading(const juce::String&) override
    {
        owner.pageFinishedLoading();
    }

private:
    PluginWebView& owner;
};

PluginWebView::PluginWebView(
    ParameterService& parameters,
    StateService& state,
    PresetService& presets,
    TransportService& transport,
    VisualizationService& visualization,
    const juce::String& instanceIdIn)
    : instanceId(instanceIdIn),
      dispatcher(instanceId, parameters, state, presets, transport, visualization, *this)
{
    browser = std::make_unique<Browser>(*this, createBrowserOptions());
    addAndMakeVisible(*browser);
    browser->goToURL(getStartUrl());
}

PluginWebView::~PluginWebView() = default;

void PluginWebView::resized()
{
    if (browser != nullptr)
        browser->setBounds(getLocalBounds());
}

void PluginWebView::emitBridgeEvent(const juce::var& envelope)
{
    if (browser != nullptr)
        browser->emitEventIfBrowserIsVisible(nativeEventId, envelope);
}

void PluginWebView::pageFinishedLoading()
{
    dispatcher.frontendLoaded();
}

juce::WebBrowserComponent::Options PluginWebView::createBrowserOptions()
{
    auto options = juce::WebBrowserComponent::Options{}
                       .withBackend(juce::WebBrowserComponent::Options::Backend::webview2)
                       .withNativeIntegrationEnabled()
                       .withInitialisationData("easyPlugin", makeInitialisationData(instanceId))
                       .withEventListener(commandEventId, [this](juce::var command) {
                           dispatcher.handleCommand(command);
                       });

#if JUCE_WEB_BROWSER_RESOURCE_PROVIDER_AVAILABLE
    options = options.withResourceProvider([this](const juce::String& path) {
        return provideResource(path);
    });
#endif

    return options;
}

juce::String PluginWebView::getStartUrl()
{
#if defined(EASY_PLUGIN_DEVELOPMENT_BUILD)
    return EASY_PLUGIN_DEVELOPMENT_URL;
#else
    return juce::WebBrowserComponent::getResourceProviderRoot();
#endif
}

std::optional<juce::WebBrowserComponent::Resource> PluginWebView::provideResource(
    const juce::String& path) const
{
    const auto asset = frontend_assets::find(path.toStdString());
    if (!asset.has_value())
        return std::nullopt;

    auto data = std::vector<std::byte>{asset->data, asset->data + asset->size};
    return juce::WebBrowserComponent::Resource{std::move(data), juce::String{asset->mimeType.data()}};
}
}
