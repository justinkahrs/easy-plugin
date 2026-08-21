#pragma once

#include <juce_core/juce_core.h>

namespace easy_plugin
{
class BridgeExtension
{
public:
    class EventSink
    {
    public:
        virtual ~EventSink() = default;
        virtual void emitExtensionEvent(
            juce::var payload,
            const juce::String& requestId = {}) = 0;
    };

    virtual ~BridgeExtension() = default;
    virtual void setEventSink(EventSink* sink) = 0;
    [[nodiscard]] virtual bool handleBridgeCommand(
        const juce::String& type,
        const juce::DynamicObject& payload,
        const juce::String& requestId) = 0;
};
}
