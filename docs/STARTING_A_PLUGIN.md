# Starting a plugin

Use this checklist when turning a fresh copy of the repository into a product.

## 1. Preserve the working sample

Create a branch, fork, or separate copy before changing the Super Filter example.
It is useful as a known-good comparison while the new DSP is taking shape.

Install the pinned workspace dependencies:

```sh
pnpm install --frozen-lockfile
```

## 2. Define the product contract

Edit `plugin.yaml` first.

Choose permanent identity values:

- `plugin.id` — reverse-domain identifier, such as `com.yourcompany.product`
- `plugin.manufacturer.code` — exactly four ASCII characters
- `plugin.pluginCode` — exactly four ASCII characters and unique to the product
- `plugin.type` — effect, instrument, MIDI instrument, analyzer, or sidechain effect

Also replace the sample preset extension and user preset directory so products do
not write into each other's preset locations.

Describe the intended buses and channel layouts. Then define every host-visible
parameter with a stable ID, type, range, default, automation behavior, and
smoothing policy. Put non-automatable persistent data under `state.fields`.

Enable only the features the product needs. The default editor conditionally shows
visualization and preset regions from generated feature metadata.

## 3. Establish the new baseline

After all sample identity placeholders have been replaced:

```sh
pnpm template:init
```

This command:

1. validates `plugin.yaml`;
2. verifies that the existing compatibility snapshot is still the shipped sample;
3. removes that sample compatibility lock; and
4. generates a new lock and source set for the product.

It is not a general reset command. Once initialized, use `pnpm generate`.

## 4. Implement native behavior

Generation changes `generated::dsp::ParameterValues` to match the manifest. Adapt:

- `native/src/DspProcessor.h`
- `native/src/DspProcessor.cpp`

Keep preparation and allocation outside `process()`. Read the generated parameter
snapshot, smooth continuous parameters as declared, preserve MIDI offsets, clear
unsupported output channels, and keep every output sample finite.

Replace the filter-specific JSON in `native/src/FactoryPresets.cpp`. Factory
presets store normalized parameter values, so test them after parameter-range
changes.

For a brand-new product, replace the sample migrations in
`native/src/StateMigrations.cpp` with an empty registry or migrations that belong
to the product's own released state history. Add migrations sequentially whenever
`state.schemaVersion` increases.

## 5. Compose the editor

Generated metadata supplies branding, controls, state types, bridge capabilities,
and preset configuration. Start with:

- `frontend/src/routes/+page.svelte`
- `frontend/src/lib/components/ParameterControl.svelte`
- `frontend/src/lib/components/PresetBrowser.svelte`
- `frontend/src/lib/components/VisualizationPanel.svelte`

The frontend is a view and interaction layer. It must not own authoritative DSP
state or move audio buffers through the bridge.

Develop in a browser:

```sh
pnpm dev
```

The mock bridge derives defaults from generated parameter and state metadata, so
it remains usable after schema changes.

## 6. Verify continuously

Run the fast checks after every manifest, DSP, state, or UI change:

```sh
pnpm generate
pnpm check
pnpm test
cmake --preset debug
cmake --build --preset debug --parallel 4
ctest --preset debug
```

Before sharing a build:

```sh
cmake --preset release
cmake --build --preset release --parallel 4
ctest --preset release
pnpm exec plugin validate --build-vst3-validator
```

Test at least:

- every supported channel layout;
- 44.1, 48, and 96 kHz;
- small, zero-length, and large blocks;
- host automation in both directions;
- save/reload and preset round trips;
- editor close/reopen;
- multiple simultaneous instances;
- operation without the Vite server in Release.

## Compatibility after release

Do not rename plugin identity or released parameter IDs. Do not change a released
parameter's type. Add parameters with new IDs, increment state schema versions,
and provide migrations for persistent state changes.

The compatibility snapshot is generated code, but it is also the release safety
rail. Never delete it to force through a change on an initialized product.
