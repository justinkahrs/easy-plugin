foreach(
  required_variable
  IN ITEMS
    EASY_PLUGIN_PNPM_EXECUTABLE
    EASY_PLUGIN_NODE_EXECUTABLE
    EASY_PLUGIN_FRONTEND_DIR
    EASY_PLUGIN_EMBED_TOOL
    EASY_PLUGIN_EMBED_DIR
    EASY_PLUGIN_EMBED_HEADER
    EASY_PLUGIN_EMBED_SOURCE
)
  if(NOT DEFINED ${required_variable} OR "${${required_variable}}" STREQUAL "")
    message(FATAL_ERROR "Missing required variable ${required_variable}.")
  endif()
endforeach()

file(MAKE_DIRECTORY "${EASY_PLUGIN_EMBED_DIR}")

execute_process(
  COMMAND
    "${EASY_PLUGIN_PNPM_EXECUTABLE}"
    --dir "${EASY_PLUGIN_FRONTEND_DIR}"
    build
  RESULT_VARIABLE frontend_build_result
  COMMAND_ECHO STDOUT
)
if(NOT frontend_build_result EQUAL 0)
  message(FATAL_ERROR "Frontend build failed with exit code ${frontend_build_result}.")
endif()

execute_process(
  COMMAND
    "${EASY_PLUGIN_NODE_EXECUTABLE}"
    "${EASY_PLUGIN_EMBED_TOOL}"
    --input "${EASY_PLUGIN_FRONTEND_DIR}/build"
    --header "${EASY_PLUGIN_EMBED_HEADER}"
    --source "${EASY_PLUGIN_EMBED_SOURCE}"
  RESULT_VARIABLE frontend_embed_result
  COMMAND_ECHO STDOUT
)
if(NOT frontend_embed_result EQUAL 0)
  message(FATAL_ERROR "Frontend embedding failed with exit code ${frontend_embed_result}.")
endif()
