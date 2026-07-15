cmake_minimum_required(VERSION 3.25)

project(
  EasyPlugin
  VERSION 0.1.0
  DESCRIPTION "JUCE 8 and SvelteKit audio plugin bootstrap"
  LANGUAGES C CXX
)

include(CTest)
include(FetchContent)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)
set(FETCHCONTENT_UPDATES_DISCONNECTED ON)

option(EASY_PLUGIN_BUILD_STANDALONE "Build the JUCE plugin formats and standalone application" ON)

find_program(EASY_PLUGIN_NODE_EXECUTABLE NAMES node REQUIRED)
find_program(EASY_PLUGIN_PNPM_EXECUTABLE NAMES pnpm REQUIRED)

set(EASY_PLUGIN_FRONTEND_DIR "${CMAKE_CURRENT_SOURCE_DIR}/frontend")
set(EASY_PLUGIN_GENERATED_DIR "${CMAKE_CURRENT_SOURCE_DIR}/generated")
set(EASY_PLUGIN_EMBED_TOOL "${CMAKE_CURRENT_SOURCE_DIR}/runtime/tools/embed-frontend.mjs")
set(EASY_PLUGIN_EMBED_DIR "${CMAKE_CURRENT_BINARY_DIR}/generated/frontend")
set(EASY_PLUGIN_EMBED_HEADER "${EASY_PLUGIN_EMBED_DIR}/FrontendAssets.h")
set(EASY_PLUGIN_EMBED_SOURCE "${EASY_PLUGIN_EMBED_DIR}/FrontendAssets.cpp")

if(NOT EXISTS "${EASY_PLUGIN_GENERATED_DIR}/PluginMetadata.generated.cmake")
  message(FATAL_ERROR "Generated plugin metadata is missing. Run `pnpm generate` before configuring CMake.")
endif()
include("${EASY_PLUGIN_GENERATED_DIR}/PluginMetadata.generated.cmake")
set_property(
  DIRECTORY
  APPEND
  PROPERTY CMAKE_CONFIGURE_DEPENDS
    "${CMAKE_CURRENT_SOURCE_DIR}/plugin.example.yaml"
    "${EASY_PLUGIN_GENERATED_DIR}/PluginMetadata.generated.cmake"
)

file(
  GLOB_RECURSE EASY_PLUGIN_FRONTEND_INPUTS
  CONFIGURE_DEPENDS
  "${EASY_PLUGIN_FRONTEND_DIR}/src/*"
  "${EASY_PLUGIN_FRONTEND_DIR}/static/*"
)

list(
  APPEND EASY_PLUGIN_FRONTEND_INPUTS
  "${CMAKE_CURRENT_SOURCE_DIR}/package.json"
  "${CMAKE_CURRENT_SOURCE_DIR}/pnpm-lock.yaml"
  "${CMAKE_CURRENT_SOURCE_DIR}/pnpm-workspace.yaml"
  "${EASY_PLUGIN_FRONTEND_DIR}/package.json"
  "${EASY_PLUGIN_FRONTEND_DIR}/svelte.config.js"
  "${EASY_PLUGIN_FRONTEND_DIR}/tsconfig.json"
  "${EASY_PLUGIN_FRONTEND_DIR}/vite.config.ts"
  "${EASY_PLUGIN_GENERATED_DIR}/BridgeTypes.generated.ts"
  "${EASY_PLUGIN_GENERATED_DIR}/ParameterMetadata.generated.ts"
  "${EASY_PLUGIN_GENERATED_DIR}/StateMetadata.generated.ts"
  "${EASY_PLUGIN_GENERATED_DIR}/SvelteParameterMetadata.generated.ts"
  "${EASY_PLUGIN_EMBED_TOOL}"
)

add_custom_command(
  OUTPUT "${EASY_PLUGIN_EMBED_HEADER}" "${EASY_PLUGIN_EMBED_SOURCE}"
  COMMAND "${CMAKE_COMMAND}" -E make_directory "${EASY_PLUGIN_EMBED_DIR}"
  COMMAND "${EASY_PLUGIN_PNPM_EXECUTABLE}" --dir "${EASY_PLUGIN_FRONTEND_DIR}" build
  COMMAND
    "${EASY_PLUGIN_NODE_EXECUTABLE}"
    "${EASY_PLUGIN_EMBED_TOOL}"
    --input "${EASY_PLUGIN_FRONTEND_DIR}/build"
    --header "${EASY_PLUGIN_EMBED_HEADER}"
    --source "${EASY_PLUGIN_EMBED_SOURCE}"
  DEPENDS ${EASY_PLUGIN_FRONTEND_INPUTS}
  COMMENT "Building and embedding the static SvelteKit frontend"
  VERBATIM
)

add_library(
  easy_plugin_frontend_assets
  STATIC
  "${EASY_PLUGIN_EMBED_HEADER}"
  "${EASY_PLUGIN_EMBED_SOURCE}"
)
target_include_directories(easy_plugin_frontend_assets PUBLIC "${EASY_PLUGIN_EMBED_DIR}")
target_compile_features(easy_plugin_frontend_assets PUBLIC cxx_std_20)
set_target_properties(
  easy_plugin_frontend_assets
  PROPERTIES
    POSITION_INDEPENDENT_CODE ON
    COMPILE_WARNING_AS_ERROR "${EASY_PLUGIN_WARNINGS_AS_ERRORS}"
)

if(EASY_PLUGIN_BUILD_STANDALONE)
  FetchContent_Declare(
    JUCE
    GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
    # JUCE 8.0.14, pinned to the tag commit for reproducible builds.
    GIT_TAG 2cdfca8feb300fb424002ba2c2751569e5bacb64
  )
  FetchContent_MakeAvailable(JUCE)

  set(EASY_PLUGIN_PLATFORM_FORMATS ${EASY_PLUGIN_FORMATS})
  if(NOT APPLE)
    list(REMOVE_ITEM EASY_PLUGIN_PLATFORM_FORMATS AU)
  endif()

  juce_add_plugin(
    EasyPluginPlugin
    VERSION "${EASY_PLUGIN_VERSION}"
    COMPANY_NAME "${EASY_PLUGIN_MANUFACTURER_NAME}"
    BUNDLE_ID "${EASY_PLUGIN_BUNDLE_ID}"
    PLUGIN_MANUFACTURER_CODE "${EASY_PLUGIN_MANUFACTURER_CODE}"
    PLUGIN_CODE "${EASY_PLUGIN_PLUGIN_CODE}"
    DESCRIPTION "${EASY_PLUGIN_DESCRIPTION}"
    IS_SYNTH "${EASY_PLUGIN_IS_SYNTH}"
    NEEDS_MIDI_INPUT "${EASY_PLUGIN_MIDI_INPUT}"
    NEEDS_MIDI_OUTPUT "${EASY_PLUGIN_MIDI_OUTPUT}"
    IS_MIDI_EFFECT "${EASY_PLUGIN_MIDI_EFFECT}"
    EDITOR_WANTS_KEYBOARD_FOCUS TRUE
    COPY_PLUGIN_AFTER_BUILD FALSE
    NEEDS_WEB_BROWSER TRUE
    NEEDS_WEBVIEW2 TRUE
    NEEDS_CURL FALSE
    VST3_CATEGORIES "${EASY_PLUGIN_CATEGORY}"
    FORMATS ${EASY_PLUGIN_PLATFORM_FORMATS}
    PRODUCT_NAME "${EASY_PLUGIN_PRODUCT_NAME}"
  )

  target_sources(
    EasyPluginPlugin
    PRIVATE
      native/src/DspProcessor.cpp
      native/src/DspProcessor.h
      native/src/FactoryPresets.cpp
      native/src/FactoryPresets.h
      native/src/PluginEditor.cpp
      native/src/PluginEditor.h
      native/src/PluginProcessor.cpp
      native/src/PluginProcessor.h
      native/src/StateMigrations.cpp
      native/src/StateMigrations.h
      generated/BusLayouts.generated.cpp
      generated/BusLayouts.generated.h
      generated/DspParameters.generated.cpp
      generated/DspParameters.generated.h
      generated/Parameters.generated.cpp
      generated/Parameters.generated.h
      generated/PluginMetadata.generated.h
      generated/StateMetadata.generated.cpp
      generated/StateMetadata.generated.h
      runtime/native/BridgeDispatcher.cpp
      runtime/native/BridgeDispatcher.h
      runtime/native/ParameterService.cpp
      runtime/native/ParameterService.h
      runtime/native/PresetService.cpp
      runtime/native/PresetService.h
      runtime/native/PluginWebView.cpp
      runtime/native/PluginWebView.h
      runtime/native/StateMigrationRegistry.cpp
      runtime/native/StateMigrationRegistry.h
      runtime/native/StateService.cpp
      runtime/native/StateService.h
      runtime/native/TransportService.cpp
      runtime/native/TransportService.h
      runtime/native/VisualizationService.cpp
      runtime/native/VisualizationService.h
  )
  target_include_directories(
    EasyPluginPlugin
    PRIVATE
      "${EASY_PLUGIN_GENERATED_DIR}"
      "${CMAKE_CURRENT_SOURCE_DIR}/native/src"
      "${CMAKE_CURRENT_SOURCE_DIR}/runtime/native"
  )
  target_compile_definitions(
    EasyPluginPlugin
    PUBLIC
      JUCE_WEB_BROWSER=1
      JUCE_USE_CURL=0
      JUCE_USE_WIN_WEBVIEW2=1
      JUCE_VST3_CAN_REPLACE_VST2=0
      JUCE_REPORT_APP_USAGE=0
    PRIVATE
      $<$<CONFIG:Debug>:EASY_PLUGIN_DEVELOPMENT_BUILD=1>
      $<$<CONFIG:Debug>:EASY_PLUGIN_DEVELOPMENT_URL="${EASY_PLUGIN_DEVELOPMENT_URL}">
  )
  target_compile_features(EasyPluginPlugin PRIVATE cxx_std_20)
  target_link_libraries(
    EasyPluginPlugin
    PRIVATE
      easy_plugin_frontend_assets
      juce::juce_audio_utils
      juce::juce_gui_extra
    PUBLIC
      juce::juce_recommended_config_flags
      juce::juce_recommended_warning_flags
  )
  if(EASY_PLUGIN_ENABLE_LTO_IN_RELEASE)
    target_link_libraries(EasyPluginPlugin PUBLIC juce::juce_recommended_lto_flags)
  endif()
  set_target_properties(
    EasyPluginPlugin
    PROPERTIES COMPILE_WARNING_AS_ERROR "${EASY_PLUGIN_WARNINGS_AS_ERRORS}"
  )
endif()

if(BUILD_TESTING)
  add_executable(easy_plugin_native_smoke tests/native/FrontendAssetsSmokeTest.cpp)
  target_compile_features(easy_plugin_native_smoke PRIVATE cxx_std_20)
  target_link_libraries(easy_plugin_native_smoke PRIVATE easy_plugin_frontend_assets)
  set_target_properties(
    easy_plugin_native_smoke
    PROPERTIES COMPILE_WARNING_AS_ERROR "${EASY_PLUGIN_WARNINGS_AS_ERRORS}"
  )

  add_test(NAME native.frontend-assets COMMAND easy_plugin_native_smoke)

  if(EASY_PLUGIN_BUILD_STANDALONE)
    add_executable(
      easy_plugin_generated_smoke
      tests/native/GeneratedCodeSmokeTest.cpp
      generated/BusLayouts.generated.cpp
      generated/DspParameters.generated.cpp
      generated/Parameters.generated.cpp
      generated/StateMetadata.generated.cpp
    )
    target_include_directories(easy_plugin_generated_smoke PRIVATE "${EASY_PLUGIN_GENERATED_DIR}")
    target_compile_features(easy_plugin_generated_smoke PRIVATE cxx_std_20)
    target_link_libraries(
      easy_plugin_generated_smoke
      PRIVATE
        juce::juce_audio_processors
        juce::juce_recommended_config_flags
        juce::juce_recommended_warning_flags
    )
    set_target_properties(
      easy_plugin_generated_smoke
      PROPERTIES COMPILE_WARNING_AS_ERROR "${EASY_PLUGIN_WARNINGS_AS_ERRORS}"
    )
    add_test(NAME native.generated-code COMMAND easy_plugin_generated_smoke)

    add_executable(easy_plugin_runtime_tests tests/native/NativeRuntimeTest.cpp)
    target_include_directories(
      easy_plugin_runtime_tests
      PRIVATE
        "${EASY_PLUGIN_GENERATED_DIR}"
        "${CMAKE_CURRENT_SOURCE_DIR}/native/src"
        "${CMAKE_CURRENT_SOURCE_DIR}/runtime/native"
    )
    target_compile_features(easy_plugin_runtime_tests PRIVATE cxx_std_20)
    target_link_libraries(
      easy_plugin_runtime_tests
      PRIVATE
        EasyPluginPlugin
        juce::juce_audio_utils
        juce::juce_gui_extra
    )
    set_target_properties(
      easy_plugin_runtime_tests
      PROPERTIES COMPILE_WARNING_AS_ERROR "${EASY_PLUGIN_WARNINGS_AS_ERRORS}"
    )
    add_test(NAME native.runtime COMMAND easy_plugin_runtime_tests)

    add_executable(tests_dsp_runtime tests/native/DspRuntimeTest.cpp)
    target_include_directories(
      tests_dsp_runtime
      PRIVATE
        "${EASY_PLUGIN_GENERATED_DIR}"
        "${CMAKE_CURRENT_SOURCE_DIR}/native/src"
    )
    target_compile_features(tests_dsp_runtime PRIVATE cxx_std_20)
    target_link_libraries(
      tests_dsp_runtime
      PRIVATE
        EasyPluginPlugin
        juce::juce_audio_basics
    )
    set_target_properties(
      tests_dsp_runtime
      PROPERTIES COMPILE_WARNING_AS_ERROR "${EASY_PLUGIN_WARNINGS_AS_ERRORS}"
    )
    add_test(NAME native.dsp-runtime COMMAND tests_dsp_runtime)

    add_executable(
      tests_transport_visualization
      tests/native/TransportVisualizationTest.cpp
    )
    target_include_directories(
      tests_transport_visualization
      PRIVATE
        "${CMAKE_CURRENT_SOURCE_DIR}/runtime/native"
    )
    target_compile_features(tests_transport_visualization PRIVATE cxx_std_20)
    target_link_libraries(
      tests_transport_visualization
      PRIVATE
        EasyPluginPlugin
        juce::juce_audio_utils
    )
    set_target_properties(
      tests_transport_visualization
      PROPERTIES COMPILE_WARNING_AS_ERROR "${EASY_PLUGIN_WARNINGS_AS_ERRORS}"
    )
    add_test(NAME native.transport-visualization COMMAND tests_transport_visualization)

    add_executable(tests_state_presets tests/native/StatePresetTest.cpp)
    target_include_directories(
      tests_state_presets
      PRIVATE
        "${EASY_PLUGIN_GENERATED_DIR}"
        "${CMAKE_CURRENT_SOURCE_DIR}/native/src"
        "${CMAKE_CURRENT_SOURCE_DIR}/runtime/native"
    )
    target_compile_features(tests_state_presets PRIVATE cxx_std_20)
    target_link_libraries(
      tests_state_presets
      PRIVATE
        EasyPluginPlugin
        juce::juce_audio_utils
        juce::juce_gui_extra
    )
    set_target_properties(
      tests_state_presets
      PROPERTIES COMPILE_WARNING_AS_ERROR "${EASY_PLUGIN_WARNINGS_AS_ERRORS}"
    )
    add_test(NAME native.state-presets COMMAND tests_state_presets)

    if("Standalone" IN_LIST EASY_PLUGIN_PLATFORM_FORMATS)
      add_test(
        NAME native.release-has-no-development-url
        COMMAND
          "${EASY_PLUGIN_NODE_EXECUTABLE}"
          "${CMAKE_CURRENT_SOURCE_DIR}/runtime/tools/assert-no-development-url.mjs"
          --configuration "$<CONFIG>"
          --path "$<TARGET_FILE:EasyPluginPlugin_Standalone>"
      )
    endif()
  endif()
endif()
