#pragma once

#include <juce_core/juce_core.h>

#include <vector>

namespace easy_plugin
{
class StateMigrationRegistry final
{
public:
    using Migration = bool (*)(juce::DynamicObject& document, juce::String& error);

    struct Result
    {
        juce::String code;
        juce::String message;

        [[nodiscard]] bool succeeded() const noexcept { return code.isEmpty(); }
    };

    void add(int fromVersion, Migration migration);
    [[nodiscard]] Result migrate(juce::var& document, int targetVersion) const;

private:
    struct Entry
    {
        int fromVersion{};
        Migration migration{};
    };

    std::vector<Entry> entries;
};
}
