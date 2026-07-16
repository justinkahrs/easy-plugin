#include "PluginEditor.h"

#include "PluginMetadata.generated.h"
#include "PluginProcessor.h"

namespace easy_plugin
{
namespace
{
constexpr auto resizeStripHeight = 18;
}

PluginEditor::PluginEditor(PluginProcessor& processorIn)
    : AudioProcessorEditor(&processorIn),
      webView(
          processorIn.getParameterService(),
          processorIn.getStateService(),
          processorIn.getPresetService(),
          processorIn.getTransportService(),
          processorIn.getVisualizationService(),
          processorIn.getInstanceId())
{
    const auto& constraints = generated::metadata::ui;
    addAndMakeVisible(webView);
    setResizable(constraints.resizable, constraints.resizable);
    setResizeLimits(
        constraints.minWidth,
        constraints.minHeight,
        constraints.maxWidth,
        constraints.maxHeight);
    setSize(constraints.width, constraints.height);
}

PluginEditor::~PluginEditor() = default;

void PluginEditor::paint(juce::Graphics& graphics)
{
    graphics.fillAll(juce::Colour{0xff10120f});

    if (!generated::metadata::ui.resizable)
        return;

    auto resizeStrip = getLocalBounds().removeFromBottom(resizeStripHeight);
    graphics.setColour(juce::Colour{0xff30342b});
    graphics.drawHorizontalLine(resizeStrip.getY(), 0.0f, static_cast<float>(getWidth()));
    graphics.setColour(juce::Colour{0xff899080});
    graphics.setFont(juce::FontOptions{9.0f, juce::Font::plain});
    graphics.drawText(
        "DRAG TO RESIZE",
        resizeStrip.withTrimmedRight(resizeStripHeight + 5),
        juce::Justification::centredRight,
        false);
}

void PluginEditor::resized()
{
    auto webViewBounds = getLocalBounds();
    if (generated::metadata::ui.resizable)
        webViewBounds.removeFromBottom(resizeStripHeight);
    webView.setBounds(webViewBounds);
}
}
