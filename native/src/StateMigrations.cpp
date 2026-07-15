#include "StateMigrations.h"

namespace easy_plugin
{
namespace
{
juce::DynamicObject* getOrCreateObject(juce::DynamicObject& document, const juce::Identifier& name)
{
    auto value = document.getProperty(name);
    if (auto* object = value.getDynamicObject(); object != nullptr)
        return object;

    auto replacement = juce::var{new juce::DynamicObject()};
    auto* object = replacement.getDynamicObject();
    document.setProperty(name, replacement);
    return object;
}

bool migrateVersion1To2(juce::DynamicObject& document, juce::String&)
{
    auto* pluginState = getOrCreateObject(document, "pluginState");
    if (pluginState->hasProperty("analyzer_on"))
    {
        pluginState->setProperty("analyzerEnabled", pluginState->getProperty("analyzer_on"));
        pluginState->removeProperty("analyzer_on");
    }
    return true;
}

bool migrateVersion2To3(juce::DynamicObject& document, juce::String&)
{
    auto* uiState = getOrCreateObject(document, "uiState");
    if (uiState->hasProperty("tab"))
    {
        uiState->setProperty("selectedTab", uiState->getProperty("tab"));
        uiState->removeProperty("tab");
    }
    return true;
}
}

StateMigrationRegistry createStateMigrationRegistry()
{
    auto migrations = StateMigrationRegistry{};
    migrations.add(1, migrateVersion1To2);
    migrations.add(2, migrateVersion2To3);
    return migrations;
}
}
