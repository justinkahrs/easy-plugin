#include "PluginEditor.h"

#include "PluginMetadata.generated.h"
#include "PluginProcessor.h"

namespace easy_plugin
{
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
    setResizable(constraints.resizable, false);
    setResizeLimits(
        constraints.minWidth,
        constraints.minHeight,
        constraints.maxWidth,
        constraints.maxHeight);
    setSize(constraints.width, constraints.height);
}

PluginEditor::~PluginEditor() = default;

void PluginEditor::resized()
{
    webView.setBounds(getLocalBounds());
}
}
