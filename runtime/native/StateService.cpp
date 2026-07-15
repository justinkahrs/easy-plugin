#include "StateService.h"

#include "StateMetadata.generated.h"

#include <cmath>
#include <utility>
#include <vector>

namespace easy_plugin
{
namespace
{
juce::Identifier identifier(std::string_view value)
{
    return juce::Identifier{juce::String::fromUTF8(value.data(), static_cast<int>(value.size()))};
}

bool isNormalizedNumber(const juce::var& value)
{
    if (!value.isInt() && !value.isInt64() && !value.isDouble())
        return false;
    const auto number = static_cast<double>(value);
    return std::isfinite(number) && number >= 0.0 && number <= 1.0;
}
}

StateService::StateService(
    ParameterService& parametersIn,
    StateMigrationRegistry migrationsIn)
    : parameters(parametersIn),
      migrations(std::move(migrationsIn)),
      pluginState(generated::state::createDefaultPluginState()),
      uiState(generated::state::createDefaultUiState())
{
}

void StateService::addListener(Listener& listener)
{
    listeners.add(&listener);
}

void StateService::removeListener(Listener& listener)
{
    listeners.remove(&listener);
}

juce::var StateService::createDocument(bool includeUiState) const
{
    auto parameterValues = juce::var{new juce::DynamicObject()};
    auto* parameterObject = parameterValues.getDynamicObject();
    for (const auto& parameter : parameters.getSnapshot())
        parameterObject->setProperty(parameter.id, parameter.normalizedValue);

    auto document = juce::var{new juce::DynamicObject()};
    auto* object = document.getDynamicObject();
    object->setProperty("format", "easy-plugin-state");
    object->setProperty("schemaVersion", generated::state::schemaVersion);
    object->setProperty("parameters", std::move(parameterValues));
    object->setProperty("pluginState", deepCopy(pluginState));
    if (includeUiState)
        object->setProperty("uiState", deepCopy(uiState));
    return document;
}

juce::String StateService::serialise(bool includeUiState) const
{
    return juce::JSON::toString(createDocument(includeUiState), true);
}

StateService::Result StateService::restoreFromText(
    const juce::String& serialised,
    ChangeSource source)
{
    auto parsed = juce::JSON::parse(serialised);
    if (parsed.isVoid() || parsed.isUndefined())
        return {"invalid-state-json", "State data is not valid JSON."};
    return applyDocument(parsed, source);
}

StateService::Result StateService::applyDocument(
    const juce::var& document,
    ChangeSource source)
{
    auto working = deepCopy(document);
    const auto migrationResult = migrations.migrate(working, generated::state::schemaVersion);
    if (!migrationResult.succeeded())
        return {migrationResult.code, migrationResult.message};

    auto* object = working.getDynamicObject();
    if (object == nullptr)
        return {"invalid-state-document", "State must be a structured object."};

    if (object->hasProperty("format")
        && object->getProperty("format").toString() != "easy-plugin-state")
        return {"invalid-state-format", "State format identifier is not supported."};

    const auto parametersValue = object->getProperty("parameters");
    const auto* parameterObject = parametersValue.getDynamicObject();
    if (parameterObject == nullptr)
        return {"invalid-state-parameters", "State parameters must be an object."};

    auto restoredParameters = std::vector<ParameterService::ParameterValue>{};
    const auto currentParameters = parameters.getSnapshot();
    restoredParameters.reserve(currentParameters.size());
    for (const auto& parameter : currentParameters)
    {
        if (!parameterObject->hasProperty(parameter.id))
            return {"missing-state-parameter", "State is missing parameter '" + parameter.id + "'."};
        const auto value = parameterObject->getProperty(parameter.id);
        if (!isNormalizedNumber(value))
            return {"invalid-state-parameter", "State parameter '" + parameter.id + "' is not normalized."};
        restoredParameters.push_back({parameter.id, static_cast<float>(value)});
    }

    const auto incomingPlugin = object->getProperty("pluginState");
    if (incomingPlugin.getDynamicObject() == nullptr)
        return {"invalid-plugin-state", "pluginState must be an object."};
    const auto incomingUi = object->hasProperty("uiState")
        ? object->getProperty("uiState")
        : generated::state::createDefaultUiState();
    if (incomingUi.getDynamicObject() == nullptr)
        return {"invalid-ui-state", "uiState must be an object when present."};

    auto nextPlugin = mergeObjects(generated::state::createDefaultPluginState(), incomingPlugin);
    auto nextUi = mergeObjects(generated::state::createDefaultUiState(), incomingUi);
    const auto validation = validateFields(nextPlugin, nextUi);
    if (!validation.succeeded())
        return validation;

    const auto parameterSource = source == ChangeSource::preset
        ? ParameterService::ChangeSource::preset
        : ParameterService::ChangeSource::state;
    const auto parameterResult = parameters.setNormalizedValues(restoredParameters, parameterSource);
    if (!parameterResult.succeeded())
        return {parameterResult.code, parameterResult.message};

    pluginState = std::move(nextPlugin);
    uiState = std::move(nextUi);
    emitAllFields(source);
    listeners.call([source](Listener& listener) { listener.stateRestored(source); });
    return {};
}

StateService::Result StateService::setField(
    const juce::String& fieldId,
    const juce::var& value,
    ChangeSource source)
{
    const auto* field = generated::state::findField(fieldId.toStdString());
    if (field == nullptr)
        return {"unknown-state-field", "Unknown state field '" + fieldId + "'."};
    if (!generated::state::validateValue(*field, value))
        return {"invalid-state-field", "State field '" + fieldId + "' has an invalid value."};

    auto& target = field->persistence == generated::state::Persistence::plugin ? pluginState : uiState;
    target.getDynamicObject()->setProperty(fieldId, deepCopy(value));
    listeners.call([&](Listener& listener) {
        listener.stateFieldChanged(fieldId, value, source);
    });
    return {};
}

juce::var StateService::getField(const juce::String& fieldId) const
{
    const auto* field = generated::state::findField(fieldId.toStdString());
    if (field == nullptr)
        return {};
    const auto& source = field->persistence == generated::state::Persistence::plugin
        ? pluginState
        : uiState;
    return deepCopy(source.getDynamicObject()->getProperty(fieldId));
}

juce::var StateService::getPluginState() const
{
    return deepCopy(pluginState);
}

juce::var StateService::getUiState() const
{
    return deepCopy(uiState);
}

juce::var StateService::deepCopy(const juce::var& value)
{
    if (value.isVoid() || value.isUndefined())
        return value;
    return juce::JSON::fromString(juce::JSON::toString(value, true));
}

juce::var StateService::mergeObjects(const juce::var& defaults, const juce::var& incoming)
{
    auto result = deepCopy(defaults);
    auto* target = result.getDynamicObject();
    const auto* source = incoming.getDynamicObject();
    if (target == nullptr || source == nullptr)
        return result;

    const auto& properties = source->getProperties();
    for (auto index = 0; index < properties.size(); ++index)
        target->setProperty(properties.getName(index), deepCopy(properties.getValueAt(index)));
    return result;
}

StateService::Result StateService::validateFields(
    const juce::var& plugin,
    const juce::var& ui) const
{
    for (const auto& field : generated::state::getFieldDefinitions())
    {
        const auto& source = field.persistence == generated::state::Persistence::plugin ? plugin : ui;
        const auto* object = source.getDynamicObject();
        const auto name = identifier(field.id);
        if (object == nullptr || !object->hasProperty(name))
            return {"missing-state-field", "State is missing field '" + juce::String{field.id.data()} + "'."};
        if (!generated::state::validateValue(field, object->getProperty(name)))
            return {"invalid-state-field", "State field '" + juce::String{field.id.data()} + "' has an invalid value."};
    }
    return {};
}

void StateService::emitAllFields(ChangeSource source)
{
    for (const auto& field : generated::state::getFieldDefinitions())
    {
        const auto fieldId = juce::String::fromUTF8(field.id.data(), static_cast<int>(field.id.size()));
        const auto value = getField(fieldId);
        listeners.call([&](Listener& listener) {
            listener.stateFieldChanged(fieldId, value, source);
        });
    }
}
}
