#include "StateMigrationRegistry.h"

#include <algorithm>

namespace easy_plugin
{
void StateMigrationRegistry::add(int fromVersion, Migration migration)
{
    const auto existing = std::find_if(entries.begin(), entries.end(), [fromVersion](const auto& entry) {
        return entry.fromVersion == fromVersion;
    });
    if (fromVersion < 1 || migration == nullptr || existing != entries.end())
        return;

    entries.push_back({fromVersion, migration});
    std::sort(entries.begin(), entries.end(), [](const auto& left, const auto& right) {
        return left.fromVersion < right.fromVersion;
    });
}

StateMigrationRegistry::Result StateMigrationRegistry::migrate(
    juce::var& document,
    int targetVersion) const
{
    auto* object = document.getDynamicObject();
    if (object == nullptr)
        return {"invalid-state-document", "State must be a structured object."};

    const auto versionValue = object->getProperty("schemaVersion");
    if (!versionValue.isInt() && !versionValue.isInt64())
        return {"invalid-schema-version", "State schemaVersion must be an integer."};

    auto version = static_cast<int>(versionValue);
    if (version < 1)
        return {"invalid-schema-version", "State schemaVersion must be at least 1."};
    if (version > targetVersion)
        return {"newer-state-version", "State was created by a newer unsupported schema version."};

    while (version < targetVersion)
    {
        const auto migration = std::find_if(entries.begin(), entries.end(), [version](const auto& entry) {
            return entry.fromVersion == version;
        });
        if (migration == entries.end())
            return {
                "missing-state-migration",
                "No sequential migration is registered from state schema version "
                    + juce::String{version} + "."};

        auto error = juce::String{};
        if (!migration->migration(*object, error))
            return {
                "state-migration-failed",
                error.isEmpty() ? "A state migration failed." : error};

        version += 1;
        object->setProperty("schemaVersion", version);
    }

    return {};
}
}
