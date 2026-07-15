#include "DspParameters.generated.h"
#include "DspProcessor.h"

#include <juce_audio_basics/juce_audio_basics.h>

#include <atomic>
#include <cmath>
#include <cstdlib>
#include <new>

namespace
{
std::atomic<bool> trackAllocations{false};
std::atomic<std::size_t> allocationCount{0};

void recordAllocation() noexcept
{
    if (trackAllocations.load(std::memory_order_relaxed))
        allocationCount.fetch_add(1, std::memory_order_relaxed);
}

easy_plugin::generated::dsp::ParameterValues defaultParameters()
{
    return {1'000.0f, 0, 0.0f, 0.7f};
}

void makeImpulse(juce::AudioBuffer<float>& buffer)
{
    buffer.clear();
    for (auto channel = 0; channel < buffer.getNumChannels(); ++channel)
        if (buffer.getNumSamples() > 0)
            buffer.setSample(channel, 0, 1.0f);
}

bool finiteBuffer(const juce::AudioBuffer<float>& buffer)
{
    for (auto channel = 0; channel < buffer.getNumChannels(); ++channel)
        for (auto sample = 0; sample < buffer.getNumSamples(); ++sample)
            if (!std::isfinite(buffer.getSample(channel, sample)))
                return false;
    return true;
}
}

void* operator new(std::size_t size)
{
    recordAllocation();
    if (auto* memory = std::malloc(size); memory != nullptr)
        return memory;
    throw std::bad_alloc{};
}

void* operator new[](std::size_t size)
{
    return ::operator new(size);
}

void operator delete(void* memory) noexcept
{
    std::free(memory);
}

void operator delete[](void* memory) noexcept
{
    std::free(memory);
}

void operator delete(void* memory, std::size_t) noexcept
{
    std::free(memory);
}

void operator delete[](void* memory, std::size_t) noexcept
{
    std::free(memory);
}

int main()
{
    using easy_plugin::DspProcessSpec;
    using easy_plugin::DspProcessor;
    using easy_plugin::generated::dsp::ParameterSmoothers;

    const auto parameters = defaultParameters();
    auto first = DspProcessor{};
    auto second = DspProcessor{};
    first.prepare(DspProcessSpec{48'000.0, 128, 2}, parameters);
    second.prepare(DspProcessSpec{48'000.0, 128, 2}, parameters);

    auto firstAudio = juce::AudioBuffer<float>{2, 128};
    auto secondAudio = juce::AudioBuffer<float>{2, 128};
    auto midi = juce::MidiBuffer{};
    makeImpulse(firstAudio);
    makeImpulse(secondAudio);
    first.process(firstAudio, midi, parameters);
    second.process(secondAudio, midi, parameters);
    if (firstAudio.getSample(0, 0) <= 0.0f || firstAudio.getSample(0, 0) >= 0.1f)
        return 1;
    for (auto channel = 0; channel < 2; ++channel)
        for (auto sample = 0; sample < 128; ++sample)
            if (std::abs(firstAudio.getSample(channel, sample) - secondAudio.getSample(channel, sample)) > 1.0e-7f)
                return 2;

    auto smoothers = ParameterSmoothers{};
    auto low = parameters;
    low.cutoff = 100.0f;
    low.outputGain = -24.0f;
    low.resonance = 0.1f;
    auto high = low;
    high.cutoff = 10'000.0f;
    high.outputGain = 12.0f;
    high.resonance = 10.0f;
    smoothers.prepare(48'000.0, low);
    smoothers.setTargets(high);
    const auto firstSmoothed = smoothers.getNext();
    if (!(firstSmoothed.cutoff > low.cutoff && firstSmoothed.cutoff < high.cutoff))
        return 3;
    if (!(firstSmoothed.outputGain > low.outputGain && firstSmoothed.outputGain < high.outputGain))
        return 4;
    for (auto sample = 1; sample < 1'440; ++sample)
        static_cast<void>(smoothers.getNext());
    const auto settled = smoothers.getNext();
    if (std::abs(settled.cutoff - high.cutoff) > 0.01f
        || std::abs(settled.outputGain - high.outputGain) > 0.001f
        || std::abs(settled.resonance - high.resonance) > 0.001f)
        return 5;

    auto zeroSamples = juce::AudioBuffer<float>{2, 0};
    first.process(zeroSamples, midi, parameters);

    auto silence = juce::AudioBuffer<float>{2, 64};
    silence.clear();
    first.reset();
    first.process(silence, midi, parameters);
    if (silence.getMagnitude(0, silence.getNumSamples()) != 0.0f)
        return 6;

    auto random = juce::Random{0x51a7e};
    auto randomAudio = juce::AudioBuffer<float>{2, 257};
    for (auto iteration = 0; iteration < 300; ++iteration)
    {
        auto randomized = parameters;
        randomized.cutoff = 20.0f + random.nextFloat() * 19'980.0f;
        randomized.resonance = 0.1f + random.nextFloat() * 9.9f;
        randomized.outputGain = -24.0f + random.nextFloat() * 36.0f;
        randomized.mode = random.nextInt(3);
        for (auto channel = 0; channel < randomAudio.getNumChannels(); ++channel)
            for (auto sample = 0; sample < randomAudio.getNumSamples(); ++sample)
                randomAudio.setSample(channel, sample, random.nextFloat() * 2.0f - 1.0f);
        first.process(randomAudio, midi, randomized);
        if (!finiteBuffer(randomAudio))
            return 7;
    }

    first.prepare(DspProcessSpec{44'100.0, 32, 2}, parameters);
    first.prepare(DspProcessSpec{96'000.0, 2'048, 2}, parameters);
    makeImpulse(firstAudio);
    first.process(firstAudio, midi, parameters);
    const auto resetReference = firstAudio.getSample(0, 0);
    first.reset();
    makeImpulse(firstAudio);
    first.process(firstAudio, midi, parameters);
    if (std::abs(firstAudio.getSample(0, 0) - resetReference) > 1.0e-7f)
        return 8;

    allocationCount.store(0, std::memory_order_relaxed);
    trackAllocations.store(true, std::memory_order_release);
    first.process(firstAudio, midi, parameters);
    trackAllocations.store(false, std::memory_order_release);
    if (allocationCount.load(std::memory_order_relaxed) != 0)
        return 9;

    return 0;
}
