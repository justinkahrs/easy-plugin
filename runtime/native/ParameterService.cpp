#include "ParameterService.h"

#include <cmath>
#include <utility>

namespace easy_plugin
{
ParameterService::ParameterService(
    juce::AudioProcessorValueTreeState& stateIn,
    juce::AudioProcessor& processor)
    : state(stateIn)
{
    const auto& processorParameters = processor.getParameters();
    entries.reserve(static_cast<std::size_t>(processorParameters.size()));

    for (auto* parameter : processorParameters)
    {
        auto* rangedParameter = dynamic_cast<juce::RangedAudioParameter*>(parameter);
        auto* parameterWithId = dynamic_cast<juce::AudioProcessorParameterWithID*>(parameter);
        if (rangedParameter == nullptr || parameterWithId == nullptr)
            continue;

        auto entry = std::make_unique<Entry>();
        entry->id = parameterWithId->paramID;
        entry->parameter = rangedParameter;
        entry->latestNormalizedValue.store(rangedParameter->getValue(), std::memory_order_relaxed);
        state.addParameterListener(entry->id, this);
        entries.push_back(std::move(entry));
    }

    startTimerHz(60);
}

ParameterService::~ParameterService()
{
    stopTimer();
    endAllGestures();
    for (const auto& entry : entries)
        state.removeParameterListener(entry->id, this);
}

void ParameterService::addListener(Listener& listener)
{
    listeners.add(&listener);
}

void ParameterService::removeListener(Listener& listener)
{
    listeners.remove(&listener);
}

ParameterService::CommandResult ParameterService::beginGesture(const juce::String& parameterId)
{
    auto* entry = findEntry(parameterId);
    if (entry == nullptr)
        return unknownParameter(parameterId);
    if (entry->gestureActive)
        return {"gesture-already-active", "A gesture is already active for parameter '" + parameterId + "'."};

    entry->parameter->beginChangeGesture();
    entry->gestureActive = true;
    return {};
}

ParameterService::CommandResult ParameterService::setNormalizedValue(
    const juce::String& parameterId,
    float normalizedValue)
{
    auto* entry = findEntry(parameterId);
    if (entry == nullptr)
        return unknownParameter(parameterId);
    return setNormalizedValue(*entry, normalizedValue, ChangeSource::ui);
}

ParameterService::CommandResult ParameterService::setNormalizedValues(
    std::span<const ParameterValue> values,
    ChangeSource source)
{
    for (const auto& value : values)
    {
        if (findEntry(value.id) == nullptr)
            return unknownParameter(value.id);
        if (!std::isfinite(value.normalizedValue)
            || value.normalizedValue < 0.0f
            || value.normalizedValue > 1.0f)
            return {"invalid-normalized-value", "Normalized parameter values must be finite and within 0..1."};
    }

    for (const auto& value : values)
        static_cast<void>(setNormalizedValue(*findEntry(value.id), value.normalizedValue, source));
    return {};
}

ParameterService::CommandResult ParameterService::setNormalizedValue(
    Entry& entry,
    float normalizedValue,
    ChangeSource source)
{
    if (!std::isfinite(normalizedValue) || normalizedValue < 0.0f || normalizedValue > 1.0f)
        return {"invalid-normalized-value", "Normalized parameter values must be finite and within 0..1."};

    entry.writeSource.store(source, std::memory_order_relaxed);
    entry.writeInProgress.store(true, std::memory_order_release);
    entry.parameter->setValueNotifyingHost(normalizedValue);
    entry.writeInProgress.store(false, std::memory_order_release);

    entry.latestNormalizedValue.store(normalizedValue, std::memory_order_relaxed);
    entry.latestSource.store(source, std::memory_order_relaxed);
    entry.dirty.store(true, std::memory_order_release);
    return {};
}

ParameterService::CommandResult ParameterService::endGesture(const juce::String& parameterId)
{
    auto* entry = findEntry(parameterId);
    if (entry == nullptr)
        return unknownParameter(parameterId);
    if (!entry->gestureActive)
        return {"gesture-not-active", "No gesture is active for parameter '" + parameterId + "'."};

    entry->parameter->endChangeGesture();
    entry->gestureActive = false;
    return {};
}

void ParameterService::endAllGestures()
{
    for (const auto& entry : entries)
    {
        if (!entry->gestureActive)
            continue;
        entry->parameter->endChangeGesture();
        entry->gestureActive = false;
    }
}

std::vector<ParameterService::ParameterValue> ParameterService::getSnapshot() const
{
    auto result = std::vector<ParameterValue>{};
    result.reserve(entries.size());
    for (const auto& entry : entries)
        result.push_back({entry->id, entry->parameter->getValue()});
    return result;
}

int ParameterService::getParameterCount() const noexcept
{
    return static_cast<int>(entries.size());
}

void ParameterService::flushPendingParameterChanges()
{
    for (const auto& entry : entries)
    {
        if (!entry->dirty.exchange(false, std::memory_order_acquire))
            continue;

        const auto value = entry->latestNormalizedValue.load(std::memory_order_relaxed);
        const auto source = entry->latestSource.load(std::memory_order_relaxed);
        listeners.call([&](Listener& listener) {
            listener.parameterChangedFromNative(entry->id, value, source);
        });
    }
}

void ParameterService::parameterChanged(const juce::String& parameterId, float newValue)
{
    auto* entry = findEntry(parameterId);
    if (entry == nullptr)
        return;

    entry->latestNormalizedValue.store(
        entry->parameter->convertTo0to1(newValue),
        std::memory_order_relaxed);
    entry->latestSource.store(
        entry->writeInProgress.load(std::memory_order_acquire)
            ? entry->writeSource.load(std::memory_order_relaxed)
            : ChangeSource::host,
        std::memory_order_relaxed);
    entry->dirty.store(true, std::memory_order_release);
}

void ParameterService::timerCallback()
{
    flushPendingParameterChanges();
}

ParameterService::Entry* ParameterService::findEntry(const juce::String& parameterId) noexcept
{
    for (const auto& entry : entries)
        if (entry->id == parameterId)
            return entry.get();
    return nullptr;
}

const ParameterService::Entry* ParameterService::findEntry(const juce::String& parameterId) const noexcept
{
    for (const auto& entry : entries)
        if (entry->id == parameterId)
            return entry.get();
    return nullptr;
}

ParameterService::CommandResult ParameterService::unknownParameter(const juce::String& parameterId)
{
    return {"unknown-parameter", "Unknown parameter ID '" + parameterId + "'."};
}
}
