#include "FrontendAssets.h"

#include <iostream>
#include <string_view>

namespace
{
bool contains(std::string_view haystack, std::string_view needle)
{
    return haystack.find(needle) != std::string_view::npos;
}
}

int main()
{
    const auto index = easy_plugin::frontend_assets::find("/");
    if (!index.has_value())
    {
        std::cerr << "Embedded frontend does not contain /index.html.\n";
        return 1;
    }

    if (index->mimeType != "text/html")
    {
        std::cerr << "Embedded index has the wrong MIME type.\n";
        return 1;
    }

    const auto html = std::string_view{
        reinterpret_cast<const char*>(index->data),
        index->size};
    if (!contains(html, "_app/immutable/") || !contains(html, "Promise.all"))
    {
        std::cerr << "Embedded index does not reference the compiled Svelte application.\n";
        return 1;
    }

    if (contains(html, "localhost:5173") || contains(html, "http://") || contains(html, "https://"))
    {
        std::cerr << "Embedded index contains a network dependency.\n";
        return 1;
    }

    if (easy_plugin::frontend_assets::find("/missing-resource.js").has_value())
    {
        std::cerr << "Missing resources must not return an asset.\n";
        return 1;
    }

    std::cout << "Embedded frontend smoke test passed.\n";
    return 0;
}
