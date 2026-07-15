#include "TransportService.h"
#include "VisualizationService.h"

#include <juce_events/juce_events.h>

#include <cmath>
#include <cstdint>

namespace
{
class Collector final : public easy_plugin::VisualizationService::Listener
{
public:
    void transportChanged(const easy_plugin::TransportSnapshot& snapshot) override
    {
        transport = snapshot;
        ++transportCount;
    }

    void meterFrame(
        const easy_plugin::MeterAccumulator::Frame& frame,
        std::uint64_t sequence,
        double) override
    {
        meter = frame;
        lastMeterSequence = sequence;
        ++meterCount;
    }

    void analyzerFrame(
        const easy_plugin::VisualizationService::AnalyzerFrame& frame,
        std::uint64_t sequence,
        double) override
    {
        analyzer = frame;
        lastAnalyzerSequence = sequence;
        ++analyzerCount;
    }

    easy_plugin::TransportSnapshot transport;
    easy_plugin::MeterAccumulator::Frame meter;
    easy_plugin::VisualizationService::AnalyzerFrame analyzer;
    std::uint64_t lastMeterSequence{};
    std::uint64_t lastAnalyzerSequence{};
    int transportCount{};
    int meterCount{};
    int analyzerCount{};
};

void fillSignal(juce::AudioBuffer<float>& audio, float amplitude)
{
    for (auto channel = 0; channel < audio.getNumChannels(); ++channel)
        for (auto sample = 0; sample < audio.getNumSamples(); ++sample)
            audio.setSample(
                channel,
                sample,
                amplitude * std::sin(
                    2.0f * juce::MathConstants<float>::pi * static_cast<float>(sample) / 32.0f));
}
}

int main()
{
    const auto initialiseGui = juce::ScopedJuceInitialiser_GUI{};

    auto transport = easy_plugin::TransportService{};
    transport.capture({});
    const auto missing = transport.getSnapshot();
    if (missing.playing || missing.recording || missing.looping
        || missing.bpm.has_value() || missing.ppqPosition.has_value()
        || missing.samplePosition.has_value() || missing.timeSignature.has_value()
        || missing.loop.has_value())
        return 1;

    auto position = juce::AudioPlayHead::PositionInfo{};
    position.setIsPlaying(true);
    position.setIsRecording(true);
    position.setIsLooping(true);
    position.setBpm(127.5);
    position.setPpqPosition(48.25);
    position.setTimeInSamples(123'456);
    position.setTimeSignature(juce::AudioPlayHead::TimeSignature{7, 8});
    position.setLoopPoints(juce::AudioPlayHead::LoopPoints{32.0, 64.0});
    transport.capture(position);
    const auto populated = transport.getSnapshot();
    if (!populated.playing || !populated.recording || !populated.looping
        || populated.bpm != 127.5 || populated.ppqPosition != 48.25
        || populated.samplePosition != 123'456
        || populated.timeSignature->numerator != 7
        || populated.timeSignature->denominator != 8
        || populated.loop->ppqStart != 32.0 || populated.loop->ppqEnd != 64.0)
        return 2;

    auto meterAccumulator = easy_plugin::MeterAccumulator{};
    auto audio = juce::AudioBuffer<float>{2, 512};
    fillSignal(audio, 0.5f);
    meterAccumulator.capture(audio);
    const auto meter = meterAccumulator.consume();
    if (!meter.hasSamples || meter.channelCount != 2
        || std::abs(meter.peaks[0] - 0.5f) > 0.001f
        || std::abs(meter.rms[0] - 0.353553f) > 0.002f)
        return 3;
    if (meterAccumulator.consume().hasSamples)
        return 4;

    auto ring = easy_plugin::AnalyzerBuffer{};
    for (auto block = 0; block < 20; ++block)
        ring.capture(audio);
    auto latest = std::array<float, 512>{};
    if (!ring.readLatest(latest) || ring.getWrittenSampleCount() != 10'240)
        return 5;
    auto oversized = std::array<float, easy_plugin::AnalyzerBuffer::capacity + 1>{};
    if (ring.readLatest(oversized))
        return 6;

    auto visualization = easy_plugin::VisualizationService{transport};
    visualization.prepare(48'000.0);
    auto collector = Collector{};
    visualization.addListener(collector);
    visualization.subscribe(collector, easy_plugin::VisualizationService::Stream::meters, 30);
    visualization.subscribe(collector, easy_plugin::VisualizationService::Stream::analyzer, 15);
    for (auto block = 0; block < 12; ++block)
        visualization.captureAudio(audio);
    visualization.dispatchPendingForTesting(0.0);
    if (collector.transportCount != 1 || collector.meterCount != 1 || collector.analyzerCount != 1
        || collector.meter.channelCount != 2 || collector.analyzer.binCount != 128
        || collector.analyzer.sampleRate != 48'000.0 || collector.lastMeterSequence != 1
        || collector.lastAnalyzerSequence != 1)
        return 7;

    for (auto block = 0; block < 100; ++block)
        visualization.captureAudio(audio);
    visualization.dispatchPendingForTesting(1.0);
    visualization.dispatchPendingForTesting(20.0);
    if (collector.meterCount != 1 || collector.analyzerCount != 1)
        return 8;
    visualization.dispatchPendingForTesting(34.0);
    if (collector.meterCount != 2 || collector.analyzerCount != 1)
        return 9;
    visualization.dispatchPendingForTesting(67.0);
    if (collector.meterCount != 2 || collector.analyzerCount != 2)
        return 10;

    visualization.removeListener(collector);
    if (visualization.getListenerCountForTesting() != 0
        || visualization.getSubscriberCountForTesting(easy_plugin::VisualizationService::Stream::meters) != 0)
        return 11;
    visualization.captureAudio(audio);
    visualization.dispatchPendingForTesting(200.0);
    if (collector.meterCount != 2 || collector.analyzerCount != 2)
        return 12;

    auto otherTransport = easy_plugin::TransportService{};
    auto otherVisualization = easy_plugin::VisualizationService{otherTransport};
    auto otherCollector = Collector{};
    otherVisualization.addListener(otherCollector);
    otherVisualization.subscribe(otherCollector, easy_plugin::VisualizationService::Stream::meters, 30);
    otherVisualization.captureAudio(audio);
    otherVisualization.dispatchPendingForTesting(0.0);
    if (otherCollector.meterCount != 1 || collector.meterCount != 2)
        return 13;

    return 0;
}
