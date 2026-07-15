#include "BridgeDispatcher.h"

#include "PluginMetadata.generated.h"

#include <cmath>
#include <utility>

namespace easy_plugin
{
namespace
{
juce::var makeObject()
{
    return juce::var{new juce::DynamicObject()};
}

bool isNumeric(const juce::var& value)
{
    return value.isInt() || value.isInt64() || value.isDouble();
}
}

BridgeDispatcher::BridgeDispatcher(
    juce::String instanceIdIn,
    ParameterService& parametersIn,
    StateService& stateIn,
    PresetService& presetsIn,
    TransportService& transportIn,
    VisualizationService& visualizationIn,
    BridgeEventSink& eventSinkIn)
    : instanceId(std::move(instanceIdIn)),
      parameters(parametersIn),
      state(stateIn),
      presets(presetsIn),
      transport(transportIn),
      visualization(visualizationIn),
      eventSink(eventSinkIn)
{
    parameters.addListener(*this);
    state.addListener(*this);
    presets.addListener(*this);
    visualization.addListener(*this);
}

BridgeDispatcher::~BridgeDispatcher()
{
    visualization.removeListener(*this);
    presets.removeListener(*this);
    state.removeListener(*this);
    parameters.removeListener(*this);
    parameters.endAllGestures();
}

void BridgeDispatcher::frontendLoaded()
{
    emitReady();
}

void BridgeDispatcher::handleCommand(const juce::var& command)
{
    const auto* envelope = command.getDynamicObject();
    if (envelope == nullptr)
    {
        emitError({}, "bridge", "invalid-envelope", "Bridge commands must use an object envelope.");
        return;
    }

    const auto requestId = envelope->getProperty("requestId").toString();
    const auto version = envelope->getProperty("protocolVersion");
    if (!isNumeric(version) || static_cast<int>(version) != protocolVersion)
    {
        emitError(requestId, "bridge", "unsupported-protocol", "The frontend protocol version is not supported.");
        return;
    }
    if (envelope->getProperty("instanceId").toString() != instanceId)
    {
        emitError(requestId, "bridge", "instance-mismatch", "The bridge command belongs to another plugin instance.");
        return;
    }

    const auto payloadValue = envelope->getProperty("payload");
    const auto* payload = payloadValue.getDynamicObject();
    if (payload == nullptr)
    {
        emitError(requestId, "bridge", "invalid-payload", "Bridge command payloads must be objects.");
        return;
    }

    const auto type = payload->getProperty("type").toString();
    if (type == "bridge.ping")
    {
        const auto timestamp = payload->getProperty("timestamp");
        if (!isNumeric(timestamp) || !std::isfinite(static_cast<double>(timestamp)))
        {
            emitError(requestId, "bridge", "invalid-timestamp", "bridge.ping requires a finite numeric timestamp.");
            return;
        }
        emitPong(requestId, static_cast<double>(timestamp));
        return;
    }
    if (type == "state.requestSnapshot")
    {
        emitSnapshot(requestId);
        return;
    }
    if (type == "state.setField")
    {
        handleStateCommand(*payload, requestId);
        return;
    }
    if (type == "transport.requestSnapshot")
    {
        emitTransportSnapshot(transport.getSnapshot(), requestId);
        return;
    }
    if (type.startsWith("visualization."))
    {
        handleVisualizationCommand(type, *payload, requestId);
        return;
    }
    if (type.startsWith("preset."))
    {
        handlePresetCommand(type, *payload, requestId);
        return;
    }
    if (type.startsWith("parameter."))
    {
        handleParameterCommand(type, *payload, requestId);
        return;
    }

    emitError(requestId, "bridge", "unknown-command", "Unknown bridge command '" + type + "'.");
}

void BridgeDispatcher::parameterChangedFromNative(
    const juce::String& parameterId,
    float normalizedValue,
    ParameterService::ChangeSource source)
{
    auto payload = makeObject();
    auto* object = payload.getDynamicObject();
    object->setProperty("type", "parameter.changed");
    object->setProperty("parameterId", parameterId);
    object->setProperty("normalizedValue", normalizedValue);
    object->setProperty(
        "source",
        source == ParameterService::ChangeSource::ui
            ? "ui"
            : source == ParameterService::ChangeSource::preset
                ? "preset"
                : source == ParameterService::ChangeSource::state ? "state" : "host");
    emitPayload(std::move(payload));
}

void BridgeDispatcher::stateFieldChanged(
    const juce::String& fieldId,
    const juce::var& value,
    StateService::ChangeSource source)
{
    auto payload = makeObject();
    auto* object = payload.getDynamicObject();
    object->setProperty("type", "state.fieldChanged");
    object->setProperty("fieldId", fieldId);
    object->setProperty("value", value);
    object->setProperty(
        "source",
        source == StateService::ChangeSource::ui
            ? "ui"
            : source == StateService::ChangeSource::preset
                ? "preset"
                : source == StateService::ChangeSource::state ? "state" : "native");
    emitPayload(std::move(payload));
}

void BridgeDispatcher::stateRestored(StateService::ChangeSource)
{
}

void BridgeDispatcher::presetDirtyChanged(bool dirty)
{
    auto payload = makeObject();
    auto* object = payload.getDynamicObject();
    object->setProperty("type", "preset.dirtyChanged");
    object->setProperty("dirty", dirty);
    emitPayload(std::move(payload));
}

void BridgeDispatcher::transportChanged(const TransportSnapshot& snapshot)
{
    emitTransportSnapshot(snapshot);
}

void BridgeDispatcher::meterFrame(
    const MeterAccumulator::Frame& frame,
    std::uint64_t sequence,
    double timestamp)
{
    auto peakValues = juce::Array<juce::var>{};
    auto rmsValues = juce::Array<juce::var>{};
    peakValues.ensureStorageAllocated(static_cast<int>(frame.channelCount));
    rmsValues.ensureStorageAllocated(static_cast<int>(frame.channelCount));
    for (std::size_t channel = 0; channel < frame.channelCount; ++channel)
    {
        peakValues.add(frame.peaks[channel]);
        rmsValues.add(frame.rms[channel]);
    }

    auto payload = makeObject();
    auto* object = payload.getDynamicObject();
    object->setProperty("type", "meter.frame");
    object->setProperty("sequence", static_cast<juce::int64>(sequence));
    object->setProperty("timestamp", timestamp);
    object->setProperty("peaks", juce::var{std::move(peakValues)});
    object->setProperty("rms", juce::var{std::move(rmsValues)});
    emitPayload(std::move(payload));
}

void BridgeDispatcher::analyzerFrame(
    const VisualizationService::AnalyzerFrame& frame,
    std::uint64_t sequence,
    double timestamp)
{
    const auto byteCount = frame.binCount * sizeof(float);
    auto payload = makeObject();
    auto* object = payload.getDynamicObject();
    object->setProperty("type", "analyzer.frame");
    object->setProperty("sequence", static_cast<juce::int64>(sequence));
    object->setProperty("timestamp", timestamp);
    object->setProperty("sampleRate", frame.sampleRate);
    object->setProperty("minFrequency", frame.minFrequency);
    object->setProperty("maxFrequency", frame.maxFrequency);
    object->setProperty("encoding", "f32-base64");
    object->setProperty("binCount", static_cast<int>(frame.binCount));
    object->setProperty("data", juce::Base64::toBase64(frame.magnitudes.data(), byteCount));
    emitPayload(std::move(payload));
}

void BridgeDispatcher::emitPayload(juce::var payload, const juce::String& requestId)
{
    auto envelope = makeObject();
    auto* object = envelope.getDynamicObject();
    object->setProperty("protocolVersion", protocolVersion);
    object->setProperty("instanceId", instanceId);
    if (requestId.isNotEmpty())
        object->setProperty("requestId", requestId);
    object->setProperty("payload", std::move(payload));
    eventSink.emitBridgeEvent(envelope);
}

void BridgeDispatcher::emitReady()
{
    auto capabilities = makeObject();
    auto* capabilityObject = capabilities.getDynamicObject();
    capabilityObject->setProperty("presets", generated::metadata::supportsPresets);
    capabilityObject->setProperty("transport", generated::metadata::supportsTransport);
    capabilityObject->setProperty("meters", generated::metadata::supportsMeters);
    capabilityObject->setProperty("analyzer", generated::metadata::supportsAnalyzer);
    capabilityObject->setProperty("midi", generated::metadata::supportsMidi);

    auto payload = makeObject();
    auto* object = payload.getDynamicObject();
    object->setProperty("type", "bridge.ready");
    object->setProperty("protocolVersion", protocolVersion);
    object->setProperty("capabilities", std::move(capabilities));
    emitPayload(std::move(payload));
}

void BridgeDispatcher::emitSnapshot(const juce::String& requestId)
{
    auto parameterValues = makeObject();
    auto* parameterObject = parameterValues.getDynamicObject();
    for (const auto& parameter : parameters.getSnapshot())
        parameterObject->setProperty(parameter.id, parameter.normalizedValue);

    auto payload = makeObject();
    auto* object = payload.getDynamicObject();
    object->setProperty("type", "state.snapshot");
    object->setProperty("schemaVersion", generated::metadata::stateSchemaVersion);
    object->setProperty("parameters", std::move(parameterValues));
    object->setProperty("pluginState", state.getPluginState());
    object->setProperty("uiState", state.getUiState());
    const auto currentPreset = presets.getCurrentPreset();
    auto preset = makeObject();
    auto* presetObject = preset.getDynamicObject();
    if (currentPreset.id.isNotEmpty())
        presetObject->setProperty("id", currentPreset.id);
    if (currentPreset.name.isNotEmpty())
        presetObject->setProperty("name", currentPreset.name);
    presetObject->setProperty("dirty", currentPreset.dirty);
    object->setProperty("preset", std::move(preset));
    emitPayload(std::move(payload), requestId);
}

void BridgeDispatcher::emitPong(const juce::String& requestId, double timestamp)
{
    auto payload = makeObject();
    auto* object = payload.getDynamicObject();
    object->setProperty("type", "bridge.pong");
    object->setProperty("timestamp", timestamp);
    emitPayload(std::move(payload), requestId);
}

void BridgeDispatcher::emitPresetList(const juce::String& requestId)
{
    auto values = juce::Array<juce::var>{};
    for (const auto& preset : presets.listPresets())
    {
        auto value = makeObject();
        auto* object = value.getDynamicObject();
        object->setProperty("id", preset.id);
        object->setProperty("name", preset.name);
        if (preset.category.isNotEmpty())
            object->setProperty("category", preset.category);
        if (!preset.tags.isEmpty())
        {
            auto tags = juce::Array<juce::var>{};
            for (const auto& tag : preset.tags)
                tags.add(tag);
            object->setProperty("tags", juce::var{std::move(tags)});
        }
        object->setProperty("factory", preset.factory);
        values.add(std::move(value));
    }

    auto payload = makeObject();
    auto* object = payload.getDynamicObject();
    object->setProperty("type", "preset.list");
    object->setProperty("presets", juce::var{std::move(values)});
    emitPayload(std::move(payload), requestId);
}

void BridgeDispatcher::emitPresetEvent(
    const juce::String& type,
    const PresetService::PresetInfo& preset,
    const juce::String& requestId)
{
    auto payload = makeObject();
    auto* object = payload.getDynamicObject();
    object->setProperty("type", type);
    object->setProperty("presetId", preset.id);
    if (type != "preset.deleted")
        object->setProperty("name", preset.name);
    emitPayload(std::move(payload), requestId);
}

void BridgeDispatcher::emitTransportSnapshot(
    const TransportSnapshot& snapshot,
    const juce::String& requestId)
{
    auto payload = makeObject();
    auto* object = payload.getDynamicObject();
    object->setProperty("type", "transport.changed");
    object->setProperty("playing", snapshot.playing);
    object->setProperty("recording", snapshot.recording);
    object->setProperty("looping", snapshot.looping);
    if (snapshot.bpm.has_value())
        object->setProperty("bpm", *snapshot.bpm);
    if (snapshot.ppqPosition.has_value())
        object->setProperty("ppqPosition", *snapshot.ppqPosition);
    if (snapshot.samplePosition.has_value())
        object->setProperty("samplePosition", static_cast<juce::int64>(*snapshot.samplePosition));
    if (snapshot.timeSignature.has_value())
    {
        auto signature = makeObject();
        signature.getDynamicObject()->setProperty("numerator", snapshot.timeSignature->numerator);
        signature.getDynamicObject()->setProperty("denominator", snapshot.timeSignature->denominator);
        object->setProperty("timeSignature", std::move(signature));
    }
    if (snapshot.loop.has_value())
    {
        auto loop = makeObject();
        loop.getDynamicObject()->setProperty("startPpq", snapshot.loop->ppqStart);
        loop.getDynamicObject()->setProperty("endPpq", snapshot.loop->ppqEnd);
        object->setProperty("loop", std::move(loop));
    }
    emitPayload(std::move(payload), requestId);
}

void BridgeDispatcher::emitError(
    const juce::String& requestId,
    const juce::String& category,
    const juce::String& code,
    const juce::String& message)
{
    auto payload = makeObject();
    auto* object = payload.getDynamicObject();
    object->setProperty("type", "error");
    object->setProperty("category", category);
    object->setProperty("code", code);
    object->setProperty("message", message);
    object->setProperty("recoverable", true);
    if (requestId.isNotEmpty())
        object->setProperty("requestId", requestId);
    emitPayload(std::move(payload), requestId);
}

void BridgeDispatcher::handleParameterCommand(
    const juce::String& type,
    const juce::DynamicObject& payload,
    const juce::String& requestId)
{
    const auto parameterId = payload.getProperty("parameterId").toString();
    if (parameterId.isEmpty())
    {
        emitError(requestId, "parameter", "missing-parameter-id", "A parameterId is required.");
        return;
    }

    auto result = ParameterService::CommandResult{};
    if (type == "parameter.beginGesture")
    {
        result = parameters.beginGesture(parameterId);
    }
    else if (type == "parameter.endGesture")
    {
        result = parameters.endGesture(parameterId);
    }
    else if (type == "parameter.setNormalized")
    {
        const auto value = payload.getProperty("value");
        if (!isNumeric(value) || !std::isfinite(static_cast<double>(value)))
        {
            emitError(requestId, "parameter", "invalid-normalized-value", "A finite normalized value is required.");
            return;
        }
        result = parameters.setNormalizedValue(parameterId, static_cast<float>(value));
    }
    else
    {
        emitError(requestId, "parameter", "unknown-parameter-command", "Unknown parameter command '" + type + "'.");
        return;
    }

    if (!result.succeeded())
        emitError(requestId, "parameter", result.code, result.message);
}

void BridgeDispatcher::handleStateCommand(
    const juce::DynamicObject& payload,
    const juce::String& requestId)
{
    const auto field = payload.getProperty("fieldId");
    if (!field.isString() || field.toString().isEmpty())
    {
        emitError(requestId, "state", "missing-state-field", "state.setField requires a fieldId.");
        return;
    }
    if (!payload.hasProperty("value"))
    {
        emitError(requestId, "state", "missing-state-value", "state.setField requires a value.");
        return;
    }

    const auto result = state.setField(
        field.toString(),
        payload.getProperty("value"),
        StateService::ChangeSource::ui);
    if (!result.succeeded())
        emitError(requestId, "state", result.code, result.message);
}

void BridgeDispatcher::handlePresetCommand(
    const juce::String& type,
    const juce::DynamicObject& payload,
    const juce::String& requestId)
{
    if (type == "preset.list")
    {
        emitPresetList(requestId);
        return;
    }

    if (type == "preset.load" || type == "preset.delete")
    {
        const auto presetId = payload.getProperty("presetId");
        if (!presetId.isString() || presetId.toString().isEmpty() || presetId.toString().length() > 128)
        {
            emitError(requestId, "preset", "invalid-preset-id", "A valid presetId is required.");
            return;
        }
        const auto result = type == "preset.load"
            ? presets.loadPreset(presetId.toString())
            : presets.deletePreset(presetId.toString());
        if (!result.succeeded())
        {
            emitError(requestId, "preset", result.code, result.message);
            return;
        }
        emitPresetEvent(type == "preset.load" ? "preset.loaded" : "preset.deleted", result.preset, requestId);
        if (type == "preset.delete")
            emitPresetList();
        return;
    }

    if (type == "preset.save")
    {
        const auto name = payload.getProperty("name");
        const auto category = payload.getProperty("category");
        const auto tagValue = payload.getProperty("tags");
        if (!name.isString())
        {
            emitError(requestId, "preset", "invalid-preset-name", "A preset name is required.");
            return;
        }
        if (!category.isVoid() && !category.isUndefined() && !category.isString())
        {
            emitError(requestId, "preset", "invalid-preset-category", "Preset category must be a string.");
            return;
        }

        auto tags = juce::StringArray{};
        if (!tagValue.isVoid() && !tagValue.isUndefined())
        {
            const auto* array = tagValue.getArray();
            if (array == nullptr)
            {
                emitError(requestId, "preset", "invalid-preset-tags", "Preset tags must be an array.");
                return;
            }
            for (const auto& tag : *array)
            {
                if (!tag.isString())
                {
                    emitError(requestId, "preset", "invalid-preset-tags", "Every preset tag must be a string.");
                    return;
                }
                tags.add(tag.toString());
            }
        }

        const auto result = presets.savePreset(name.toString(), category.toString(), tags);
        if (!result.succeeded())
        {
            emitError(requestId, "preset", result.code, result.message);
            return;
        }
        emitPresetEvent("preset.saved", result.preset, requestId);
        emitPresetList();
        return;
    }

    emitError(requestId, "preset", "unknown-preset-command", "Unknown preset command '" + type + "'.");
}

void BridgeDispatcher::handleVisualizationCommand(
    const juce::String& type,
    const juce::DynamicObject& payload,
    const juce::String& requestId)
{
    const auto streamName = payload.getProperty("stream").toString();
    const auto isMeters = streamName == "meters";
    const auto isAnalyzer = streamName == "analyzer";
    if (!isMeters && !isAnalyzer)
    {
        emitError(
            requestId,
            "visualization",
            "invalid-stream",
            "Visualization stream must be 'meters' or 'analyzer'.");
        return;
    }

    const auto stream = isMeters
        ? VisualizationService::Stream::meters
        : VisualizationService::Stream::analyzer;
    if (type == "visualization.unsubscribe")
    {
        visualization.unsubscribe(*this, stream);
        return;
    }
    if (type != "visualization.subscribe")
    {
        emitError(
            requestId,
            "visualization",
            "unknown-visualization-command",
            "Unknown visualization command '" + type + "'.");
        return;
    }

    const auto rateValue = payload.getProperty("rateHz");
    const auto defaultRate = isMeters ? 30 : 15;
    const auto maximumRate = defaultRate;
    auto rate = defaultRate;
    if (!rateValue.isVoid() && !rateValue.isUndefined())
    {
        if (!isNumeric(rateValue)
            || !std::isfinite(static_cast<double>(rateValue))
            || static_cast<double>(rateValue) < 1.0
            || static_cast<double>(rateValue) > static_cast<double>(maximumRate))
        {
            emitError(
                requestId,
                "visualization",
                "invalid-rate",
                "The " + streamName + " rate must be between 1 and "
                    + juce::String{maximumRate} + " Hz.");
            return;
        }
        rate = static_cast<int>(std::round(static_cast<double>(rateValue)));
    }
    visualization.subscribe(*this, stream, rate);
}
}
