#include "FactoryPresets.h"

#include <array>

namespace easy_plugin
{
namespace
{
constexpr std::array cleanTags{std::string_view{"transparent"}, std::string_view{"low-pass"}};
constexpr std::array creativeTags{std::string_view{"band-pass"}, std::string_view{"resonant"}};

constexpr std::array factoryPresets{
    FactoryPresetDefinition{
        "factory:clean-low-pass",
        "Clean Low-pass",
        "Clean",
        cleanTags,
        R"json({
          "format": "easy-plugin-state",
          "schemaVersion": 3,
          "parameters": {
            "cutoff": 0.62,
            "mode": 0.0,
            "outputGain": 0.6666667,
            "resonance": 0.0606061
          },
          "pluginState": { "analyzerEnabled": true }
        })json"},
    FactoryPresetDefinition{
        "factory:legacy-resonator",
        "Legacy Resonator",
        "Creative",
        creativeTags,
        R"json({
          "schemaVersion": 1,
          "parameters": {
            "cutoff": 0.43,
            "mode": 1.0,
            "outputGain": 0.5833333,
            "resonance": 0.72
          },
          "pluginState": { "analyzer_on": false },
          "uiState": { "tab": "main" }
        })json"}
};
}

std::span<const FactoryPresetDefinition> getFactoryPresets() noexcept
{
    return factoryPresets;
}
}
