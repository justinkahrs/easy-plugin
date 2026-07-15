# Easy Plugin

A schema-driven JUCE 8 audio-plugin template with a SvelteKit editor. The current implementation includes manifest generation, native VST3/AU/Standalone targets, host-visible APVTS parameters, and a disposable WebView editor.

## What works now

- JUCE 8 VST3 and plugin Standalone targets on macOS and Windows
- Audio Unit target on macOS
- Vite development server loaded by Debug builds
- SvelteKit static output embedded into Release binaries
- In-memory JUCE resource provider with no Release network dependency
- Versioned, instance-scoped JUCE/Svelte bridge with ready, ping, parameter, error, and state-snapshot messages
- Strict YAML manifest model with path-specific validation errors
- Released-identity, parameter-ID/type, and state compatibility snapshots
- Deterministic C++, TypeScript, Svelte metadata, bus, bridge-type, and CMake generation
- APVTS-authoritative parameter service with host automation gestures and message-thread WebView delivery
- Generated Svelte controls, normalized value conversion, host-to-frontend synchronization, and browser mock mode
- Generated atomic DSP parameter snapshots and linear/multiplicative smoothing helpers
- User-owned deterministic state-variable filter DSP with real-time allocation instrumentation
- Versioned JSON state documents with plugin/UI separation and sequential user-owned migrations
- Embedded factory presets, file-backed user presets, factory protection, and dirty-state tracking
- Svelte preset browser and persistent-state controls backed by the same native/mock bridge contract
- Optional host transport snapshots, MIDI-offset preservation, throttled peak/RMS meters, and packed bounded analyzer frames
- Editor destroy/recreate, state restoration, automation, instance isolation, bus-layout, offline render, DSP, migration, preset, and native runtime tests
- Pinned Steinberg VST3 validator, Apple `auval`, JSON validation reports, and macOS/Windows CI integration

## Prerequisites

- CMake 3.25 or newer
- A C++20 compiler and platform SDK
- Node.js 22.20.0
- pnpm 10.30.1
- Git, used by CMake to fetch the pinned JUCE 8.0.14 source
- WebView2 Runtime on Windows

JUCE is a build dependency. The shipped Release application embeds its frontend and does not need Node.js, pnpm, a development server, or internet access.

## Install and test the frontend

From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm generate
pnpm check
pnpm test
pnpm build
```

`pnpm generate` builds the workspace CLI and runs `plugin generate`. It reads `plugin.yaml` when present, otherwise the checked-in `plugin.example.yaml`. Explicit paths are also supported:

```sh
pnpm builder:build
pnpm exec plugin generate --manifest plugin.example.yaml --output generated
```

Generation validates the complete manifest before replacing `generated/`. If a previous compatibility snapshot exists, released plugin identity and parameter IDs/types are checked before any output is written.

## Browser development

Run the frontend with the mock bridge:

```sh
pnpm dev
```

Open `http://127.0.0.1:5173`. The diagnostics panel reports `Browser mock` and its ping action is fully functional.

## Native development with hot reload

Start Vite in one terminal:

```sh
pnpm dev
```

Configure and build the Debug standalone application in another:

```sh
cmake --preset debug
cmake --build --preset debug
```

Launch `build/debug/EasyPluginPlugin_artefacts/Debug/Standalone/Super Filter.app` on macOS. Windows produces the equivalent Standalone executable under the same artifact tree. Debug editors load the manifest-configured development URL; edits hot reload through Vite.

## Offline Release build

The native target builds the static frontend first and converts every output asset into a deterministic C++ resource table:

```sh
cmake --preset release
cmake --build --preset release
ctest --preset release
```

Release artifacts are written under `build/release/EasyPluginPlugin_artefacts/Release`, grouped into `VST3`, `AU` on macOS, and `Standalone`. Release editors use JUCE's in-memory resource provider and contain no development-server URL.

## Plugin validation

Run the internal acceptance suite plus the declared format validators after a Release build:

```sh
pnpm exec plugin validate --build-vst3-validator
```

The first run clones and builds the official Steinberg VST3 SDK validator pinned to
`v3.8.0_build_66`. On macOS the command temporarily stages the built component,
refreshes Audio Unit discovery, and runs `auval`. Results are written to
`build/validation/report.json`; missing tools and artifacts are failures with remediation text.

## Ownership boundaries

- `native/src/` and `frontend/src/` are user-owned.
- `runtime/` contains reusable framework runtime code and build tools.
- `generated/` contains reproducible manifest-generated source and may be replaced in full.
- Build-time embedded assets are generated under the CMake build directory, never in user-owned source directories.

## Current scope

The example DSP is a deterministic mono/stereo state-variable filter using the generated cutoff, resonance, mode, and output-gain contract. Packaging, project upgrade migrations, and the remaining CLI command suite are assigned to later milestones in `IMPLEMENTATION_PLAN.md`.
