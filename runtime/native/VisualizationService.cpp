#include "VisualizationService.h"

#include <algorithm>
#include <cmath>
#include <numbers>

namespace easy_plugin
{
static_assert(std::atomic<float>::is_always_lock_free);
static_assert(std::atomic<double>::is_always_lock_free);
static_assert(std::atomic<std::uint64_t>::is_always_lock_free);

void MeterAccumulator::capture(const juce::AudioBuffer<float>& audio) noexcept
{
    const auto channels = std::min<std::size_t>(
        static_cast<std::size_t>(std::max(0, audio.getNumChannels())), maxChannels);
    auto observed = channelCount.load(std::memory_order_relaxed);
    while (observed < channels
           && !channelCount.compare_exchange_weak(
               observed, channels, std::memory_order_relaxed, std::memory_order_relaxed))
    {
    }

    for (std::size_t channel = 0; channel < channels; ++channel)
    {
        const auto* values = audio.getReadPointer(static_cast<int>(channel));
        auto peak = 0.0f;
        auto squareSum = 0.0f;
        auto count = std::uint64_t{};
        for (auto sample = 0; sample < audio.getNumSamples(); ++sample)
        {
            const auto value = values[sample];
            if (!std::isfinite(value))
                continue;
            const auto bounded = std::clamp(value, -64.0f, 64.0f);
            peak = std::max(peak, std::abs(bounded));
            squareSum += bounded * bounded;
            ++count;
        }

        auto previousPeak = peaks[channel].load(std::memory_order_relaxed);
        while (previousPeak < peak
               && !peaks[channel].compare_exchange_weak(
                   previousPeak, peak, std::memory_order_relaxed, std::memory_order_relaxed))
        {
        }
        squareSums[channel].fetch_add(squareSum, std::memory_order_relaxed);
        sampleCounts[channel].fetch_add(count, std::memory_order_relaxed);
    }
}

MeterAccumulator::Frame MeterAccumulator::consume() noexcept
{
    auto result = Frame{};
    result.channelCount = std::min(channelCount.load(std::memory_order_relaxed), maxChannels);
    for (std::size_t channel = 0; channel < result.channelCount; ++channel)
    {
        result.peaks[channel] = peaks[channel].exchange(0.0f, std::memory_order_acq_rel);
        const auto sum = squareSums[channel].exchange(0.0f, std::memory_order_acq_rel);
        const auto count = sampleCounts[channel].exchange(0, std::memory_order_acq_rel);
        result.rms[channel] = count == 0 ? 0.0f : std::sqrt(std::max(0.0f, sum) / static_cast<float>(count));
        result.hasSamples = result.hasSamples || count != 0;
    }
    return result;
}

void AnalyzerBuffer::capture(const juce::AudioBuffer<float>& audio) noexcept
{
    const auto channels = audio.getNumChannels();
    if (channels <= 0)
        return;

    auto position = writePosition.load(std::memory_order_relaxed);
    for (auto sample = 0; sample < audio.getNumSamples(); ++sample)
    {
        auto mono = 0.0f;
        for (auto channel = 0; channel < channels; ++channel)
        {
            const auto value = audio.getSample(channel, sample);
            mono += std::isfinite(value) ? std::clamp(value, -64.0f, 64.0f) : 0.0f;
        }
        mono /= static_cast<float>(channels);
        samples[static_cast<std::size_t>(position % capacity)].store(mono, std::memory_order_relaxed);
        ++position;
    }
    writePosition.store(position, std::memory_order_release);
}

bool AnalyzerBuffer::readLatest(std::span<float> destination) const noexcept
{
    if (destination.empty() || destination.size() > capacity)
        return false;
    const auto end = writePosition.load(std::memory_order_acquire);
    if (end < destination.size())
        return false;

    const auto begin = end - destination.size();
    for (std::size_t index = 0; index < destination.size(); ++index)
        destination[index] = samples[static_cast<std::size_t>((begin + index) % capacity)].load(std::memory_order_relaxed);

    return writePosition.load(std::memory_order_acquire) - end < capacity;
}

std::uint64_t AnalyzerBuffer::getWrittenSampleCount() const noexcept
{
    return writePosition.load(std::memory_order_acquire);
}

VisualizationService::VisualizationService(TransportService& transportIn)
    : transport(transportIn)
{
}

VisualizationService::~VisualizationService()
{
    stopTimer();
}

void VisualizationService::prepare(double sampleRateIn) noexcept
{
    if (std::isfinite(sampleRateIn) && sampleRateIn > 0.0)
        sampleRate.store(sampleRateIn, std::memory_order_release);
}

void VisualizationService::captureAudio(const juce::AudioBuffer<float>& audio) noexcept
{
    if (meterCaptureEnabled.load(std::memory_order_acquire))
        meters.capture(audio);
    if (analyzerCaptureEnabled.load(std::memory_order_acquire))
        analyzer.capture(audio);
}

void VisualizationService::addListener(Listener& listener)
{
    if (find(listener) != subscriptions.end())
        return;
    subscriptions.push_back({&listener});
    if (subscriptions.size() == 1)
        startTimerHz(60);
}

void VisualizationService::removeListener(Listener& listener) noexcept
{
    subscriptions.erase(
        std::remove_if(
            subscriptions.begin(),
            subscriptions.end(),
            [&listener](const auto& subscription) { return subscription.listener == &listener; }),
        subscriptions.end());
    updateCaptureState();
    if (subscriptions.empty())
        stopTimer();
}

void VisualizationService::subscribe(Listener& listener, Stream stream, int rateHz)
{
    auto subscription = find(listener);
    if (subscription == subscriptions.end())
    {
        addListener(listener);
        subscription = find(listener);
    }

    if (stream == Stream::meters)
    {
        subscription->meterRateHz = std::clamp(rateHz, 1, 30);
        subscription->nextMeterTimestamp = 0.0;
    }
    else
    {
        subscription->analyzerRateHz = std::clamp(rateHz, 1, 15);
        subscription->nextAnalyzerTimestamp = 0.0;
    }
    updateCaptureState();
}

void VisualizationService::unsubscribe(Listener& listener, Stream stream) noexcept
{
    const auto subscription = find(listener);
    if (subscription == subscriptions.end())
        return;
    if (stream == Stream::meters)
        subscription->meterRateHz = 0;
    else
        subscription->analyzerRateHz = 0;
    updateCaptureState();
}

std::size_t VisualizationService::getListenerCountForTesting() const noexcept
{
    return subscriptions.size();
}

std::size_t VisualizationService::getSubscriberCountForTesting(Stream stream) const noexcept
{
    return static_cast<std::size_t>(std::count_if(
        subscriptions.begin(),
        subscriptions.end(),
        [stream](const auto& subscription) {
            return stream == Stream::meters
                ? subscription.meterRateHz > 0
                : subscription.analyzerRateHz > 0;
        }));
}

void VisualizationService::dispatchPendingForTesting(double timestamp)
{
    dispatchPending(timestamp);
}

void VisualizationService::timerCallback()
{
    dispatchPending(juce::Time::getMillisecondCounterHiRes());
}

void VisualizationService::dispatchPending(double timestamp)
{
    const auto currentTransport = transport.getSnapshot();
    if (!hasLastTransport || currentTransport != lastTransport)
    {
        lastTransport = currentTransport;
        hasLastTransport = true;
        for (const auto& subscription : subscriptions)
            subscription.listener->transportChanged(currentTransport);
    }

    auto meterDue = false;
    auto analyzerDue = false;
    for (auto& subscription : subscriptions)
    {
        subscription.meterDue = subscription.meterRateHz > 0
            && isDue(timestamp, subscription.nextMeterTimestamp, subscription.meterRateHz);
        subscription.analyzerDue = subscription.analyzerRateHz > 0
            && isDue(timestamp, subscription.nextAnalyzerTimestamp, subscription.analyzerRateHz);
        meterDue = subscription.meterDue || meterDue;
        analyzerDue = subscription.analyzerDue || analyzerDue;
    }

    if (meterDue)
    {
        const auto frame = meters.consume();
        if (frame.hasSamples)
        {
            const auto sequence = ++meterSequence;
            for (const auto& subscription : subscriptions)
                if (subscription.meterDue)
                    subscription.listener->meterFrame(frame, sequence, timestamp);
        }
    }

    if (analyzerDue && analyzer.getWrittenSampleCount() >= analyzerWindowSize)
    {
        const auto frame = calculateAnalyzerFrame();
        if (frame.binCount != 0)
        {
            const auto sequence = ++analyzerSequence;
            for (const auto& subscription : subscriptions)
                if (subscription.analyzerDue)
                    subscription.listener->analyzerFrame(frame, sequence, timestamp);
        }
    }
}

void VisualizationService::updateCaptureState() noexcept
{
    auto metersEnabled = false;
    auto analyzerEnabled = false;
    for (const auto& subscription : subscriptions)
    {
        metersEnabled = metersEnabled || subscription.meterRateHz > 0;
        analyzerEnabled = analyzerEnabled || subscription.analyzerRateHz > 0;
    }
    meterCaptureEnabled.store(metersEnabled, std::memory_order_release);
    analyzerCaptureEnabled.store(analyzerEnabled, std::memory_order_release);
}

VisualizationService::AnalyzerFrame VisualizationService::calculateAnalyzerFrame() const noexcept
{
    auto window = std::array<float, analyzerWindowSize>{};
    if (!analyzer.readLatest(window))
        return {};

    auto frame = AnalyzerFrame{};
    frame.binCount = analyzerBinCount;
    frame.sampleRate = sampleRate.load(std::memory_order_acquire);
    frame.minFrequency = frame.sampleRate / static_cast<double>(analyzerWindowSize);
    frame.maxFrequency = frame.sampleRate * static_cast<double>(analyzerBinCount)
        / static_cast<double>(analyzerWindowSize);

    for (std::size_t bin = 1; bin <= analyzerBinCount; ++bin)
    {
        auto real = 0.0;
        auto imaginary = 0.0;
        for (std::size_t sample = 0; sample < analyzerWindowSize; ++sample)
        {
            const auto phase = -2.0 * std::numbers::pi * static_cast<double>(bin * sample)
                / static_cast<double>(analyzerWindowSize);
            const auto hann = 0.5 - 0.5 * std::cos(
                2.0 * std::numbers::pi * static_cast<double>(sample)
                / static_cast<double>(analyzerWindowSize - 1));
            const auto value = static_cast<double>(window[sample]) * hann;
            real += value * std::cos(phase);
            imaginary += value * std::sin(phase);
        }
        frame.magnitudes[bin - 1] = static_cast<float>(
            4.0 * std::sqrt(real * real + imaginary * imaginary)
            / static_cast<double>(analyzerWindowSize));
    }
    return frame;
}

bool VisualizationService::isDue(double timestamp, double& nextTimestamp, int rateHz) noexcept
{
    if (rateHz <= 0 || timestamp < nextTimestamp)
        return false;
    nextTimestamp = timestamp + 1'000.0 / static_cast<double>(rateHz);
    return true;
}

VisualizationService::SubscriptionIterator VisualizationService::find(Listener& listener) noexcept
{
    return std::find_if(
        subscriptions.begin(),
        subscriptions.end(),
        [&listener](const auto& subscription) { return subscription.listener == &listener; });
}

VisualizationService::ConstSubscriptionIterator VisualizationService::find(const Listener& listener) const noexcept
{
    return std::find_if(
        subscriptions.begin(),
        subscriptions.end(),
        [&listener](const auto& subscription) { return subscription.listener == &listener; });
}
}
