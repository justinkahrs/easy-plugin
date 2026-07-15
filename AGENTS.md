# Agent Instructions

## Objective

Build a reusable, schema-driven audio plugin template that generates working JUCE plugins with a SvelteKit user interface.

The system must support:

- VST3
- Audio Unit on macOS
- Standalone application
- JUCE 8
- C++20
- CMake
- SvelteKit
- TypeScript
- Vite
- pnpm
- Embedded production frontend assets
- Development frontend hot reload
- Typed communication between Svelte and JUCE
- Schema-generated parameters
- Host automation
- State persistence
- State migration
- Plugin validation
- Cross-platform CI

## Core principles

1. The plugin manifest is the source of truth.
2. Generated files must never contain user-authored code.
3. Users must not edit generated files.
4. Parameter identifiers must remain stable after release.
5. Native code owns all audio-affecting state.
6. The frontend owns presentation-only state.
7. Audio buffers must never cross the WebView bridge.
8. No allocations, locks, logging, file I/O, JSON parsing, or frontend calls may occur on the audio thread.
9. The Svelte editor must be disposable and reconstruct itself from native state whenever opened.
10. Production plugins must function without internet access.
11. Every generated project must include automated validation.
12. Generated projects must be upgradeable without overwriting user code.

## Required architecture

```text
plugin.yaml
    |
schema validator
    |
code generator
    |-- C++ parameter declarations
    |-- TypeScript parameter declarations
    |-- bridge bindings
    |-- CMake metadata
    |-- default Svelte controls
    |-- validation tests
    |-- CI configuration
    |
SvelteKit editor
    |
JUCE WebBrowserComponent bridge
    |
JUCE AudioProcessor and APVTS
    |
user-owned DSP implementation
```

## Repository ownership boundaries

Generated code belongs in:

```text
generated/
```

User-authored code belongs in:

```text
native/src/
frontend/src/
```

Framework runtime code belongs in:

```text
runtime/
```

The generator may replace files under `generated/`.

The generator must not replace user-owned files.

## Coding rules

- Use C++20.
- Use TypeScript strict mode.
- Use explicit error handling.
- Avoid global mutable state.
- Every plugin instance must have isolated state.
- Use deterministic code generation.
- Sort generated output consistently.
- Generated files must include a warning that they are generated.
- Keep transport, parameters, state, UI, and DSP as separate modules.
- Treat host-supplied transport fields as optional.
- Preserve MIDI sample offsets.
- Smooth continuous parameters where configured.
- Reject unsupported channel layouts.
- Support multiple simultaneous plugin instances.
- Use binary or packed numeric transport for high-frequency visual data where practical.
- Do not send analyzer buffers as large JSON object graphs.

## Required developer commands

```text
plugin create
plugin generate
plugin dev
plugin build
plugin test
plugin validate
plugin package
plugin doctor
plugin upgrade
```

## Definition of done

A task is not complete until:

- The code builds from a clean checkout.
- Tests pass.
- Generated output is deterministic.
- The standalone target opens.
- The WebView loads the embedded Svelte frontend.
- Parameter updates work in both directions.
- Parameter gestures are visible to the host.
- State survives save and reload.
- The plugin editor can close and reopen.
- Multiple plugin instances remain isolated.
- Release builds contain no development-server dependency.
- Validation commands produce actionable failures.
