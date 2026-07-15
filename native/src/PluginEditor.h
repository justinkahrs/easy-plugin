#pragma once

#include "PluginWebView.h"

#include <juce_audio_processors/juce_audio_processors.h>

namespace easy_plugin
{
class PluginProcessor;

class PluginEditor final : public juce::AudioProcessorEditor
{
public:
    explicit PluginEditor(PluginProcessor& processorIn);
    ~PluginEditor() override;

    void resized() override;

private:
    PluginWebView webView;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(PluginEditor)
};
}
