#pragma once

#include "FactoryPresets.h"
#include "ParameterService.h"
#include "StateService.h"

#include <juce_core/juce_core.h>

#include <optional>
#include <span>
#include <vector>

namespace easy_plugin
{
class PresetService final : private ParameterService::Listener,
                            private StateService::Listener
{
public:
    struct PresetInfo
    {
        juce::String id;
        juce::String name;
        juce::String category;
        juce::StringArray tags;
        bool factory{};
    };

    struct CurrentPreset
    {
        juce::String id;
        juce::String name;
        bool dirty{};

        [[nodiscard]] bool hasPreset() const noexcept { return id.isNotEmpty(); }
    };

    struct Result
    {
        juce::String code;
        juce::String message;
        PresetInfo preset;

        [[nodiscard]] bool succeeded() const noexcept { return code.isEmpty(); }
    };

    class Listener
    {
    public:
        virtual ~Listener() = default;
        virtual void presetDirtyChanged(bool dirty) = 0;
    };

    PresetService(
        StateService& state,
        ParameterService& parameters,
        juce::File userDirectory,
        std::span<const FactoryPresetDefinition> factoryPresets);
    ~PresetService() override;

    void addListener(Listener& listener);
    void removeListener(Listener& listener);

    [[nodiscard]] std::vector<PresetInfo> listPresets() const;
    [[nodiscard]] Result loadPreset(const juce::String& presetId);
    [[nodiscard]] Result savePreset(
        const juce::String& name,
        const juce::String& category,
        const juce::StringArray& tags);
    [[nodiscard]] Result deletePreset(const juce::String& presetId);
    [[nodiscard]] CurrentPreset getCurrentPreset() const;

private:
    struct UserPreset
    {
        PresetInfo info;
        juce::File file;
        juce::var stateDocument;
    };

    void parameterChangedFromNative(
        const juce::String& parameterId,
        float normalizedValue,
        ParameterService::ChangeSource source) override;
    void stateFieldChanged(
        const juce::String& fieldId,
        const juce::var& value,
        StateService::ChangeSource source) override;
    void stateRestored(StateService::ChangeSource source) override;

    [[nodiscard]] Result validateSaveRequest(
        const juce::String& name,
        const juce::String& category,
        const juce::StringArray& tags) const;
    [[nodiscard]] std::vector<UserPreset> readUserPresets() const;
    [[nodiscard]] static std::optional<UserPreset> parseUserPreset(const juce::File& file);
    [[nodiscard]] const FactoryPresetDefinition* findFactoryPreset(const juce::String& id) const;
    void setCurrent(const PresetInfo& preset, bool dirty);
    void markDirty();

    StateService& state;
    ParameterService& parameters;
    juce::File userDirectory;
    std::span<const FactoryPresetDefinition> factoryPresets;
    CurrentPreset current;
    bool suppressDirtyTracking{};
    juce::ListenerList<Listener> listeners;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(PresetService)
};

[[nodiscard]] juce::File getDefaultUserPresetDirectory();
}
