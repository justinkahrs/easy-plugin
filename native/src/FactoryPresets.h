#pragma once

#include <span>
#include <string_view>

namespace easy_plugin
{
struct FactoryPresetDefinition
{
    std::string_view id;
    std::string_view name;
    std::string_view category;
    std::span<const std::string_view> tags;
    std::string_view stateJson;
};

[[nodiscard]] std::span<const FactoryPresetDefinition> getFactoryPresets() noexcept;
}
