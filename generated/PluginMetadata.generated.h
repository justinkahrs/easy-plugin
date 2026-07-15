// GENERATED FILE. DO NOT EDIT.
// Generated from the plugin manifest.

#pragma once

#include <array>
#include <string_view>

namespace easy_plugin::generated::metadata
{
inline constexpr int schemaVersion = 1;
inline constexpr std::string_view builderMinimumVersion = "0.1.0";
inline constexpr std::string_view projectVersion = "0.1.0";
inline constexpr std::string_view pluginId = "com.example.superfilter";
inline constexpr std::string_view pluginName = "Super Filter";
inline constexpr std::string_view pluginDescription = "Stereo multimode filter";
inline constexpr std::string_view pluginCategory = "Fx";
inline constexpr std::string_view manufacturerName = "Example Audio";
inline constexpr std::string_view manufacturerCode = "ExAu";
inline constexpr std::string_view pluginCode = "SpFl";
inline constexpr std::string_view version = "0.1.0";
inline constexpr int versionMajor = 0;
inline constexpr int versionMinor = 1;
inline constexpr int versionPatch = 0;
inline constexpr std::string_view type = "effect";
inline constexpr bool acceptsMidi = false;
inline constexpr bool producesMidi = false;
inline constexpr bool isMidiEffect = false;
inline constexpr bool isSynth = false;
inline constexpr int stateSchemaVersion = 3;
inline constexpr bool supportsPresets = true;
inline constexpr bool supportsTransport = true;
inline constexpr bool supportsMeters = true;
inline constexpr bool supportsAnalyzer = true;
inline constexpr bool supportsMidi = false;
inline constexpr std::array<std::string_view, 3> formats{{ "au", "standalone", "vst3" }};

struct UiConstraints
{
    int width;
    int height;
    int minWidth;
    int minHeight;
    int maxWidth;
    int maxHeight;
    bool resizable;
    double defaultZoom;
};

inline constexpr UiConstraints ui{
    720,
    480,
    480,
    320,
    1440,
    960,
    true,
    1.0
};
}
