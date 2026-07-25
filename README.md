# Easy Plugin

A copy-based starter repository for building JUCE 8 audio plugins with a SvelteKit
editor. The checked-in Super Filter is a complete example that proves the runtime;
replace its identity, parameter schema, DSP, presets, migrations, and presentation
when starting a product.

The template builds VST3 and Standalone targets on macOS and Windows, plus Audio
Unit on macOS. Debug builds load Vite for hot reload. Release builds embed the
frontend and work offline.

## Start a new plugin

Create a branch, fork, or copy of this repository for the new product, then install
dependencies:

```sh
pnpm install --frozen-lockfile
```

Edit `plugin.yaml` before touching generated code. At minimum, replace:

- plugin ID, name, description, type, and version
- manufacturer name and four-character manufacturer code
- four-character plugin code
- formats, buses, parameters, and state fields
- preset extension and user preset directory
- feature flags

Then establish the new compatibility baseline:

```sh
pnpm template:init
```

`template:init` is intentionally one-time. It refuses to run while sample identity
values remain, removes only the shipped sample compatibility lock, and regenerates
the project from `plugin.yaml`. After initialization, always use:

```sh
pnpm generate
```

Next, replace the sample-specific code:

- `native/src/DspProcessor.*` — implement the new DSP and MIDI behavior
- `native/src/FactoryPresets.*` — define factory presets for the new parameters
- `native/src/StateMigrations.*` — keep only migrations relevant to the new product
- `frontend/src/routes/+page.svelte` and `frontend/src/lib/components/` — compose
  the editor

See [Starting a plugin](docs/STARTING_A_PLUGIN.md) for the full checklist.

## Browser UI development

Run the editor with the generated mock bridge:

```sh
pnpm dev
```

Open `http://127.0.0.1:5173`. Branding, parameter controls, feature visibility,
state metadata, and preset configuration come from generated manifest metadata.

## Native development

Keep Vite running in one terminal, then configure and build Debug in another:

```sh
cmake --preset debug
cmake --build --preset debug --parallel 4
ctest --preset debug
```

On macOS, launch the generated Standalone app under:

```text
build/debug/EasyPluginPlugin_artefacts/Debug/Standalone/
```

Debug plugin editors load the development URL declared in `plugin.yaml`.

## Release and validation

Release builds embed the static SvelteKit output into the plugin binary:

```sh
cmake --preset release
cmake --build --preset release --parallel 4
ctest --preset release
```

Run internal checks and the declared format validators:

```sh
pnpm exec plugin validate --build-vst3-validator
```

Validation results are written to `build/validation/report.json`. The first VST3
validation run builds the pinned Steinberg validator. On macOS, validation also
uses `auval`.

## Ownership boundaries

- `plugin.yaml` — product contract and source of truth
- `generated/` — reproducible output; never edit by hand
- `native/src/` — plugin-owned native and DSP code
- `frontend/src/` — plugin-owned editor code
- `runtime/` — reusable JUCE/WebView runtime
- `builder/` — manifest parser, generator, compatibility checks, and validation
- `tests/` — native runtime and plugin behavior tests

Parameter IDs and plugin identity values become permanent once a product is
released. The generated compatibility snapshot protects them from accidental
changes.

## What is implemented

- Manifest validation and deterministic C++/TypeScript/CMake generation
- APVTS parameters, automation gestures, smoothing, and host synchronization
- VST3, Audio Unit, and Standalone targets
- Embedded Release frontend and Debug hot reload
- Versioned state, sequential migrations, factory/user presets, and dirty tracking
- Optional transport, meters, analyzer frames, and MIDI offset preservation
- Editor recreation and multiple-instance isolation
- Native/frontend tests, macOS/Windows CI, VST3 validation, and `auval`

This repository is presently a copy/fork template. The CLI implements `generate`
and `validate`; project creation, packaging, signing, and automatic template
upgrades are not yet exposed as CLI commands.

## Reference

- [Starting a plugin](docs/STARTING_A_PLUGIN.md)
- [Plugin manifest schema](docs/PLUGIN_SCHEMA.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Bridge protocol](docs/BRIDGE_PROTOCOL.md)
- [Construction archive](docs/archive/README.md)
