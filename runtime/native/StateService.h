#pragma once

#include "ParameterService.h"
#include "StateMigrationRegistry.h"

#include <juce_core/juce_core.h>

namespace easy_plugin
{
class StateService final
{
public:
    enum class ChangeSource
    {
        ui,
        preset,
        state,
        native
    };

    struct Result
    {
        juce::String code;
        juce::String message;

        [[nodiscard]] bool succeeded() const noexcept { return code.isEmpty(); }
    };

    class Listener
    {
    public:
        virtual ~Listener() = default;
        virtual void stateFieldChanged(
            const juce::String& fieldId,
            const juce::var& value,
            ChangeSource source) = 0;
        virtual void stateRestored(ChangeSource source) = 0;
    };

    StateService(ParameterService& parameters, StateMigrationRegistry migrations);

    void addListener(Listener& listener);
    void removeListener(Listener& listener);

    [[nodiscard]] juce::var createDocument(bool includeUiState) const;
    [[nodiscard]] juce::String serialise(bool includeUiState) const;
    [[nodiscard]] Result restoreFromText(const juce::String& serialised, ChangeSource source);
    [[nodiscard]] Result applyDocument(const juce::var& document, ChangeSource source);

    [[nodiscard]] Result setField(
        const juce::String& fieldId,
        const juce::var& value,
        ChangeSource source = ChangeSource::ui);
    [[nodiscard]] juce::var getField(const juce::String& fieldId) const;
    [[nodiscard]] juce::var getPluginState() const;
    [[nodiscard]] juce::var getUiState() const;

private:
    [[nodiscard]] static juce::var deepCopy(const juce::var& value);
    [[nodiscard]] static juce::var mergeObjects(const juce::var& defaults, const juce::var& incoming);
    [[nodiscard]] Result validateFields(const juce::var& plugin, const juce::var& ui) const;
    void emitAllFields(ChangeSource source);

    ParameterService& parameters;
    StateMigrationRegistry migrations;
    juce::var pluginState;
    juce::var uiState;
    juce::ListenerList<Listener> listeners;

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(StateService)
};
}
