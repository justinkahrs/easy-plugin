#include "TransportService.h"

#include <cmath>

namespace easy_plugin
{
namespace
{
constexpr std::uint32_t playingFlag = 1U << 0U;
constexpr std::uint32_t recordingFlag = 1U << 1U;
constexpr std::uint32_t loopingFlag = 1U << 2U;

template <typename Value>
bool finiteOptional(const juce::Optional<Value>& value) noexcept
{
    return value.hasValue() && std::isfinite(static_cast<double>(*value));
}
}

void TransportService::capture(
    const juce::Optional<juce::AudioPlayHead::PositionInfo>& position) noexcept
{
    revision.fetch_add(1, std::memory_order_acq_rel);

    auto available = std::uint32_t{};
    auto status = std::uint32_t{};
    if (position.hasValue())
    {
        status |= position->getIsPlaying() ? playingFlag : 0U;
        status |= position->getIsRecording() ? recordingFlag : 0U;
        status |= position->getIsLooping() ? loopingFlag : 0U;

        const auto hostBpm = position->getBpm();
        if (finiteOptional(hostBpm) && *hostBpm > 0.0)
        {
            bpm.store(*hostBpm, std::memory_order_relaxed);
            available |= bpmAvailable;
        }

        const auto hostPpq = position->getPpqPosition();
        if (finiteOptional(hostPpq))
        {
            ppqPosition.store(*hostPpq, std::memory_order_relaxed);
            available |= ppqAvailable;
        }

        if (const auto hostSamples = position->getTimeInSamples(); hostSamples.hasValue())
        {
            samplePosition.store(*hostSamples, std::memory_order_relaxed);
            available |= samplesAvailable;
        }

        if (const auto signature = position->getTimeSignature();
            signature.hasValue() && signature->numerator > 0 && signature->denominator > 0)
        {
            timeSignatureNumerator.store(signature->numerator, std::memory_order_relaxed);
            timeSignatureDenominator.store(signature->denominator, std::memory_order_relaxed);
            available |= timeSignatureAvailable;
        }

        if (const auto points = position->getLoopPoints();
            points.hasValue() && std::isfinite(points->ppqStart) && std::isfinite(points->ppqEnd))
        {
            loopStartPpq.store(points->ppqStart, std::memory_order_relaxed);
            loopEndPpq.store(points->ppqEnd, std::memory_order_relaxed);
            available |= loopAvailable;
        }
    }

    flags.store(status, std::memory_order_relaxed);
    optionals.store(available, std::memory_order_relaxed);
    revision.fetch_add(1, std::memory_order_release);
}

TransportSnapshot TransportService::getSnapshot() const noexcept
{
    auto result = TransportSnapshot{};
    for (auto attempt = 0; attempt < 8; ++attempt)
    {
        const auto before = revision.load(std::memory_order_acquire);
        if ((before & 1U) != 0U)
            continue;

        const auto available = optionals.load(std::memory_order_relaxed);
        const auto status = flags.load(std::memory_order_relaxed);
        result.playing = (status & playingFlag) != 0U;
        result.recording = (status & recordingFlag) != 0U;
        result.looping = (status & loopingFlag) != 0U;
        result.bpm = (available & bpmAvailable) != 0U
            ? std::optional<double>{bpm.load(std::memory_order_relaxed)}
            : std::nullopt;
        result.ppqPosition = (available & ppqAvailable) != 0U
            ? std::optional<double>{ppqPosition.load(std::memory_order_relaxed)}
            : std::nullopt;
        result.samplePosition = (available & samplesAvailable) != 0U
            ? std::optional<std::int64_t>{samplePosition.load(std::memory_order_relaxed)}
            : std::nullopt;
        result.timeSignature = (available & timeSignatureAvailable) != 0U
            ? std::optional<juce::AudioPlayHead::TimeSignature>{
                {timeSignatureNumerator.load(std::memory_order_relaxed),
                 timeSignatureDenominator.load(std::memory_order_relaxed)}}
            : std::nullopt;
        result.loop = (available & loopAvailable) != 0U
            ? std::optional<juce::AudioPlayHead::LoopPoints>{
                {loopStartPpq.load(std::memory_order_relaxed),
                 loopEndPpq.load(std::memory_order_relaxed)}}
            : std::nullopt;

        const auto after = revision.load(std::memory_order_acquire);
        if (before == after)
            return result;
    }
    return result;
}
}
