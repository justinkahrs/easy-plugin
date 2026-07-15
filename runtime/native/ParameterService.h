#pragma once

#include <juce_audio_processors/juce_audio_processors.h>

#include <atomic>
#include <memory>
#include <span>
#include <vector>

namespace easy_plugin
{
class ParameterService final : private juce::AudioProcessorValueTreeState::Listener,
                               private juce::Timer
{
public:
    enum class ChangeSource
    {
        host,
        ui,
        preset,
        state
    };

    struct ParameterValue
    {
        juce::String id;
        float normalizedValue{};
    };

    struct CommandResult
    {
        juce::String code;
        juce::String message;

        [[nodiscard]] bool succeeded() const noexcept { return code.isEmpty(); }
    };

    class Listener
    {
    public:
        virtual ~Listener() = default;
        virtual void parameterChangedFromNative(
            const juce::String& parameterId,
            float normalizedValue,
            ChangeSource source) = 0;
    };

    ParameterService(
        juce::AudioProcessorValueTreeState& state,
        juce::AudioProcessor& processor);
    ~ParameterService() override;

    void addListener(Listener& listener);
    void removeListener(Listener& listener);

    [[nodiscard]] CommandResult beginGesture(const juce::String& parameterId);
    [[nodiscard]] CommandResult setNormalizedValue(
        const juce::String& parameterId,
        float normalizedValue);
    [[nodiscard]] CommandResult setNormalizedValues(
        std::span<const ParameterValue> values,
        ChangeSource source);
    [[nodiscard]] CommandResult endGesture(const juce::String& parameterId);
    void endAllGestures();

    [[nodiscard]] std::vector<ParameterValue> getSnapshot() const;
    [[nodiscard]] int getParameterCount() const noexcept;

    void flushPendingParameterChanges();

private:
    struct Entry
    {
        juce::String id;
        juce::RangedAudioParameter* parameter{};
        std::atomic<float> latestNormalizedValue{0.0f};
        std::atomic<ChangeSource> latestSource{ChangeSource::host};
        std::atomic<ChangeSource> writeSource{ChangeSource::host};
        std::atomic<bool> writeInProgress{false};
        std::atomic<bool> dirty{false};
        bool gestureActive{false};
    };

    void parameterChanged(const juce::String& parameterId, float newValue) override;
    void timerCallback() override;

    [[nodiscard]] Entry* findEntry(const juce::String& parameterId) noexcept;
    [[nodiscard]] const Entry* findEntry(const juce::String& parameterId) const noexcept;
    [[nodiscard]] static CommandResult unknownParameter(const juce::String& parameterId);
    [[nodiscard]] CommandResult setNormalizedValue(
        Entry& entry,
        float normalizedValue,
        ChangeSource source);

    juce::AudioProcessorValueTreeState& state;
    std::vector<std::unique_ptr<Entry>> entries;
    juce::ListenerList<Listener> listeners;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(ParameterService)
};
}
