#pragma once

#include <juce_audio_processors/juce_audio_processors.h>

#include <atomic>
#include <cstdint>
#include <optional>

namespace easy_plugin
{
struct TransportSnapshot
{
    bool playing{};
    bool recording{};
    bool looping{};
    std::optional<double> bpm;
    std::optional<double> ppqPosition;
    std::optional<std::int64_t> samplePosition;
    std::optional<juce::AudioPlayHead::TimeSignature> timeSignature;
    std::optional<juce::AudioPlayHead::LoopPoints> loop;

    [[nodiscard]] bool operator==(const TransportSnapshot&) const = default;
};

class TransportService final
{
public:
    TransportService() = default;

    // Called by PluginProcessor::processBlock. This method is lock-free and allocation-free.
    void capture(const juce::Optional<juce::AudioPlayHead::PositionInfo>& position) noexcept;

    // Called from the message thread. A bounded retry avoids waiting on the audio callback.
    [[nodiscard]] TransportSnapshot getSnapshot() const noexcept;

private:
    enum OptionalField : std::uint32_t
    {
        bpmAvailable = 1U << 0U,
        ppqAvailable = 1U << 1U,
        samplesAvailable = 1U << 2U,
        timeSignatureAvailable = 1U << 3U,
        loopAvailable = 1U << 4U
    };

    std::atomic<std::uint64_t> revision{0};
    std::atomic<std::uint32_t> optionals{0};
    std::atomic<std::uint32_t> flags{0};
    std::atomic<double> bpm{0.0};
    std::atomic<double> ppqPosition{0.0};
    std::atomic<std::int64_t> samplePosition{0};
    std::atomic<int> timeSignatureNumerator{4};
    std::atomic<int> timeSignatureDenominator{4};
    std::atomic<double> loopStartPpq{0.0};
    std::atomic<double> loopEndPpq{0.0};
};
}
