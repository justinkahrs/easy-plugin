#include "PresetService.h"

#include "PluginMetadata.generated.h"
#include "StateMetadata.generated.h"

#include <algorithm>
#include <utility>

namespace easy_plugin
{
namespace
{
juce::String toString(std::string_view value)
{
    return juce::String::fromUTF8(value.data(), static_cast<int>(value.size()));
}

PresetService::PresetInfo toInfo(const FactoryPresetDefinition& preset)
{
    auto tags = juce::StringArray{};
    for (const auto tag : preset.tags)
        tags.add(toString(tag));
    return {toString(preset.id), toString(preset.name), toString(preset.category), std::move(tags), true};
}

juce::StringArray parseTags(const juce::var& value)
{
    auto result = juce::StringArray{};
    if (const auto* array = value.getArray(); array != nullptr)
        for (const auto& tag : *array)
            if (tag.isString())
                result.add(tag.toString());
    return result;
}

juce::var createTags(const juce::StringArray& tags)
{
    auto values = juce::Array<juce::var>{};
    values.ensureStorageAllocated(tags.size());
    for (const auto& tag : tags)
        values.add(tag);
    return juce::var{std::move(values)};
}
}

PresetService::PresetService(
    StateService& stateIn,
    ParameterService& parametersIn,
    juce::File userDirectoryIn,
    std::span<const FactoryPresetDefinition> factoryPresetsIn)
    : state(stateIn),
      parameters(parametersIn),
      userDirectory(std::move(userDirectoryIn)),
      factoryPresets(factoryPresetsIn)
{
    parameters.addListener(*this);
    state.addListener(*this);
}

PresetService::~PresetService()
{
    state.removeListener(*this);
    parameters.removeListener(*this);
}

void PresetService::addListener(Listener& listener)
{
    listeners.add(&listener);
}

void PresetService::removeListener(Listener& listener)
{
    listeners.remove(&listener);
}

std::vector<PresetService::PresetInfo> PresetService::listPresets() const
{
    auto result = std::vector<PresetInfo>{};
    result.reserve(factoryPresets.size());
    for (const auto& preset : factoryPresets)
        result.push_back(toInfo(preset));
    for (auto& preset : readUserPresets())
        result.push_back(std::move(preset.info));
    std::sort(result.begin(), result.end(), [](const auto& left, const auto& right) {
        if (left.factory != right.factory)
            return left.factory > right.factory;
        return left.name.compareIgnoreCase(right.name) < 0;
    });
    return result;
}

PresetService::Result PresetService::loadPreset(const juce::String& presetId)
{
    parameters.flushPendingParameterChanges();
    auto info = PresetInfo{};
    auto document = juce::var{};
    if (const auto* factory = findFactoryPreset(presetId); factory != nullptr)
    {
        info = toInfo(*factory);
        document = juce::JSON::parse(toString(factory->stateJson));
    }
    else
    {
        auto userPresets = readUserPresets();
        const auto preset = std::find_if(userPresets.begin(), userPresets.end(), [&](const auto& item) {
            return item.info.id == presetId;
        });
        if (preset == userPresets.end())
            return {"preset-not-found", "Preset '" + presetId + "' was not found.", {}};
        info = preset->info;
        document = preset->stateDocument;
    }

    suppressDirtyTracking = true;
    const auto restore = state.applyDocument(document, StateService::ChangeSource::preset);
    suppressDirtyTracking = false;
    if (!restore.succeeded())
        return {restore.code, restore.message, {}};

    setCurrent(info, false);
    return {{}, {}, std::move(info)};
}

PresetService::Result PresetService::savePreset(
    const juce::String& name,
    const juce::String& category,
    const juce::StringArray& tags)
{
    parameters.flushPendingParameterChanges();
    const auto validation = validateSaveRequest(name, category, tags);
    if (!validation.succeeded())
        return validation;

    const auto directoryResult = userDirectory.createDirectory();
    if (directoryResult.failed())
        return {"preset-directory-failed", directoryResult.getErrorMessage(), {}};

    const auto uuid = juce::Uuid{}.toString();
    const auto id = "user:" + uuid;
    const auto file = userDirectory.getChildFile(uuid + "." + toString(generated::state::presetExtension));

    auto wrapper = juce::var{new juce::DynamicObject()};
    auto* object = wrapper.getDynamicObject();
    object->setProperty("format", "easy-plugin-preset");
    object->setProperty("presetVersion", 1);
    object->setProperty("id", id);
    object->setProperty("name", name.trim());
    if (category.isNotEmpty())
        object->setProperty("category", category);
    object->setProperty("tags", createTags(tags));
    object->setProperty(
        "state",
        state.createDocument(generated::state::presetsIncludeUiState));

    if (!file.replaceWithText(juce::JSON::toString(wrapper, true)))
        return {"preset-write-failed", "The user preset could not be written.", {}};

    auto info = PresetInfo{id, name.trim(), category, tags, false};
    setCurrent(info, false);
    return {{}, {}, std::move(info)};
}

PresetService::Result PresetService::deletePreset(const juce::String& presetId)
{
    if (findFactoryPreset(presetId) != nullptr)
        return {"factory-preset-protected", "Factory presets cannot be deleted.", {}};

    auto presets = readUserPresets();
    const auto preset = std::find_if(presets.begin(), presets.end(), [&](const auto& item) {
        return item.info.id == presetId;
    });
    if (preset == presets.end())
        return {"preset-not-found", "Preset '" + presetId + "' was not found.", {}};
    if (!preset->file.deleteFile())
        return {"preset-delete-failed", "The user preset could not be deleted.", {}};

    auto info = preset->info;
    if (current.id == presetId)
        current = {};
    return {{}, {}, std::move(info)};
}

PresetService::CurrentPreset PresetService::getCurrentPreset() const
{
    return current;
}

void PresetService::parameterChangedFromNative(
    const juce::String&,
    float,
    ParameterService::ChangeSource source)
{
    if (source != ParameterService::ChangeSource::preset
        && source != ParameterService::ChangeSource::state)
        markDirty();
}

void PresetService::stateFieldChanged(
    const juce::String& fieldId,
    const juce::var&,
    StateService::ChangeSource source)
{
    if (source == StateService::ChangeSource::preset || source == StateService::ChangeSource::state)
        return;
    const auto* field = generated::state::findField(fieldId.toStdString());
    if (field != nullptr
        && (field->persistence == generated::state::Persistence::plugin
            || generated::state::presetsIncludeUiState))
        markDirty();
}

void PresetService::stateRestored(StateService::ChangeSource source)
{
    if (source == StateService::ChangeSource::state)
    {
        current = {};
        listeners.call([](Listener& listener) { listener.presetDirtyChanged(false); });
    }
}

PresetService::Result PresetService::validateSaveRequest(
    const juce::String& name,
    const juce::String& category,
    const juce::StringArray& tags) const
{
    const auto trimmedName = name.trim();
    if (trimmedName.isEmpty() || trimmedName.length() > 80)
        return {"invalid-preset-name", "Preset names must contain 1 to 80 characters.", {}};
    if (category.length() > 40)
        return {"invalid-preset-category", "Preset categories may contain at most 40 characters.", {}};
    if (category.isNotEmpty())
    {
        const auto known = std::any_of(
            generated::state::presetCategories.begin(),
            generated::state::presetCategories.end(),
            [&](std::string_view value) { return category == toString(value); });
        if (!known)
            return {"invalid-preset-category", "Preset category is not declared by the manifest.", {}};
    }
    if (tags.size() > 16)
        return {"invalid-preset-tags", "A preset may contain at most 16 tags.", {}};
    for (const auto& tag : tags)
        if (tag.trim().isEmpty() || tag.length() > 32)
            return {"invalid-preset-tags", "Preset tags must contain 1 to 32 characters.", {}};
    return {};
}

std::vector<PresetService::UserPreset> PresetService::readUserPresets() const
{
    auto result = std::vector<UserPreset>{};
    if (!userDirectory.isDirectory())
        return result;
    const auto pattern = "*." + toString(generated::state::presetExtension);
    for (const auto& file : userDirectory.findChildFiles(juce::File::findFiles, false, pattern))
        if (auto preset = parseUserPreset(file); preset.has_value())
            result.push_back(std::move(*preset));
    return result;
}

std::optional<PresetService::UserPreset> PresetService::parseUserPreset(const juce::File& file)
{
    const auto parsed = juce::JSON::parse(file.loadFileAsString());
    const auto* object = parsed.getDynamicObject();
    if (object == nullptr || object->getProperty("format").toString() != "easy-plugin-preset")
        return {};
    const auto id = object->getProperty("id").toString();
    const auto name = object->getProperty("name").toString();
    const auto stateDocument = object->getProperty("state");
    if (!id.startsWith("user:") || name.isEmpty() || stateDocument.getDynamicObject() == nullptr)
        return {};
    return UserPreset{
        {id, name, object->getProperty("category").toString(), parseTags(object->getProperty("tags")), false},
        file,
        stateDocument};
}

const FactoryPresetDefinition* PresetService::findFactoryPreset(const juce::String& id) const
{
    const auto preset = std::find_if(factoryPresets.begin(), factoryPresets.end(), [&](const auto& item) {
        return id == toString(item.id);
    });
    return preset == factoryPresets.end() ? nullptr : &*preset;
}

void PresetService::setCurrent(const PresetInfo& preset, bool dirty)
{
    current = {preset.id, preset.name, dirty};
    listeners.call([dirty](Listener& listener) { listener.presetDirtyChanged(dirty); });
}

void PresetService::markDirty()
{
    if (suppressDirtyTracking || !current.hasPreset() || current.dirty)
        return;
    current.dirty = true;
    listeners.call([](Listener& listener) { listener.presetDirtyChanged(true); });
}

juce::File getDefaultUserPresetDirectory()
{
    return juce::File::getSpecialLocation(juce::File::userApplicationDataDirectory)
        .getChildFile(toString(generated::metadata::manufacturerName))
        .getChildFile(toString(generated::state::userPresetDirectoryName))
        .getChildFile("Presets");
}
}
