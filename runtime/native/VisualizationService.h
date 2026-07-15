#pragma once

#include "TransportService.h"

#include <juce_audio_basics/juce_audio_basics.h>
#include <juce_events/juce_events.h>

#include <array>
#include <atomic>
#include <cstddef>
#include <cstdint>
#include <span>
#include <vector>

namespace easy_plugin
{
class MeterAccumulator final
{
public:
    static constexpr std::size_t maxChannels = 64;

    struct Frame
    {
        std::array<float, maxChannels> peaks{};
        std::array<float, maxChannels> rms{};
        std::size_t channelCount{};
        bool hasSamples{};
    };

    void capture(const juce::AudioBuffer<float>& audio) noexcept;
    [[nodiscard]] Frame consume() noexcept;

private:
    std::array<std::atomic<float>, maxChannels> peaks{};
    std::array<std::atomic<float>, maxChannels> squareSums{};
    std::array<std::atomic<std::uint64_t>, maxChannels> sampleCounts{};
    std::atomic<std::size_t> channelCount{0};
};

class AnalyzerBuffer final
{
public:
    static constexpr std::size_t capacity = 8'192;

    void capture(const juce::AudioBuffer<float>& audio) noexcept;
    [[nodiscard]] bool readLatest(std::span<float> destination) const noexcept;
    [[nodiscard]] std::uint64_t getWrittenSampleCount() const noexcept;

private:
    std::array<std::atomic<float>, capacity> samples{};
    std::atomic<std::uint64_t> writePosition{0};
};

class VisualizationService final : private juce::Timer
{
public:
    static constexpr std::size_t analyzerWindowSize = 512;
    static constexpr std::size_t analyzerBinCount = 128;

    enum class Stream
    {
        meters,
        analyzer
    };

    struct AnalyzerFrame
    {
        std::array<float, analyzerBinCount> magnitudes{};
        std::size_t binCount{};
        double sampleRate{};
        double minFrequency{};
        double maxFrequency{};
    };

    class Listener
    {
    public:
        virtual ~Listener() = default;
        virtual void transportChanged(const TransportSnapshot& snapshot) = 0;
        virtual void meterFrame(const MeterAccumulator::Frame& frame, std::uint64_t sequence, double timestamp) = 0;
        virtual void analyzerFrame(const AnalyzerFrame& frame, std::uint64_t sequence, double timestamp) = 0;
    };

    explicit VisualizationService(TransportService& transportIn);
    ~VisualizationService() override;

    void prepare(double sampleRateIn) noexcept;
    void captureAudio(const juce::AudioBuffer<float>& audio) noexcept;

    // Subscription methods are message-thread-only and may allocate.
    void addListener(Listener& listener);
    void removeListener(Listener& listener) noexcept;
    void subscribe(Listener& listener, Stream stream, int rateHz);
    void unsubscribe(Listener& listener, Stream stream) noexcept;

    [[nodiscard]] std::size_t getListenerCountForTesting() const noexcept;
    [[nodiscard]] std::size_t getSubscriberCountForTesting(Stream stream) const noexcept;
    void dispatchPendingForTesting(double timestamp);

private:
    struct Subscription
    {
        Listener* listener{};
        int meterRateHz{};
        int analyzerRateHz{};
        double nextMeterTimestamp{};
        double nextAnalyzerTimestamp{};
        bool meterDue{};
        bool analyzerDue{};
    };

    using SubscriptionIterator = std::vector<Subscription>::iterator;
    using ConstSubscriptionIterator = std::vector<Subscription>::const_iterator;

    void timerCallback() override;
    void dispatchPending(double timestamp);
    void updateCaptureState() noexcept;
    [[nodiscard]] AnalyzerFrame calculateAnalyzerFrame() const noexcept;
    [[nodiscard]] static bool isDue(double timestamp, double& nextTimestamp, int rateHz) noexcept;
    [[nodiscard]] SubscriptionIterator find(Listener& listener) noexcept;
    [[nodiscard]] ConstSubscriptionIterator find(const Listener& listener) const noexcept;

    TransportService& transport;
    MeterAccumulator meters;
    AnalyzerBuffer analyzer;
    std::atomic<double> sampleRate{44'100.0};
    std::atomic<bool> meterCaptureEnabled{false};
    std::atomic<bool> analyzerCaptureEnabled{false};
    std::vector<Subscription> subscriptions;
    TransportSnapshot lastTransport;
    bool hasLastTransport{};
    std::uint64_t meterSequence{};
    std::uint64_t analyzerSequence{};
};
}
