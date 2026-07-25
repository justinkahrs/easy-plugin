# Agent Instructions — Audio Plugin Template

## Repository role

This repository is a starting point for one new audio plugin. Treat the checked-in
Super Filter as a working example to replace, not as the product being maintained.

The template already provides the JUCE/Svelte runtime, generation pipeline, state,
presets, visualization transport, validation, and CI foundation. Do not resume the
archived construction roadmap unless the user explicitly asks to develop the
template framework itself.

The available project CLI commands are currently:

```text
plugin generate
plugin validate
```

Do not claim that `plugin create`, `package`, `doctor`, or `upgrade` exist.

## Starting a new plugin

When the manifest still uses `com.example.superfilter`, help the user define and
replace the sample identity and schema before adapting DSP or UI code.

1. Edit `plugin.yaml`.
2. Replace the sample plugin name, reverse-domain ID, manufacturer name and
   four-character code, plugin four-character code, preset extension, and preset
   directory.
3. Define buses, parameters, state fields, feature flags, and build formats.
4. Run `pnpm template:init` exactly once to release the shipped sample
   compatibility baseline and generate the new plugin baseline.
5. Adapt the user-owned DSP, presets, migrations, and UI.

After initialization, use `pnpm generate`; do not run `pnpm template:init` again.

## Source of truth and ownership

`plugin.yaml` is the source of truth for identity, formats, buses, parameters,
state fields, UI constraints, presets, and feature flags.

Generated code lives in:

```text
generated/
```

The generator may replace that directory. Never hand-edit generated files.

Plugin-specific, user-owned code lives in:

```text
native/src/
frontend/src/
```

The most important customization points are:

- `native/src/DspProcessor.*` — audio and MIDI behavior
- `native/src/FactoryPresets.*` — factory preset definitions
- `native/src/StateMigrations.*` — migrations for released state schemas
- `frontend/src/routes/+page.svelte` — editor composition
- `frontend/src/lib/components/` — plugin-specific controls and views

Reusable framework code lives in:

```text
runtime/
builder/
```

Change framework code only when the requested behavior is broadly reusable or the
plugin cannot be implemented safely in user-owned files.

## Compatibility rules

- Treat plugin ID, manufacturer code, plugin code, parameter IDs, and released
  parameter types as permanent after the new baseline is established.
- Add new parameters instead of renaming released parameter IDs.
- Increase state schema versions and add sequential migrations when persistent
  state changes.
- Regenerate immediately after every manifest change.
- Generated TypeScript branding and feature metadata must drive generic UI labels;
  do not hard-code the sample product identity into reusable components.

## Runtime boundaries

- Native code owns all audio-affecting state.
- The frontend owns presentation-only state.
- The editor is disposable and must reconstruct itself from native state.
- Audio and MIDI buffers never cross the WebView bridge.
- Preserve MIDI sample offsets.
- Treat host transport fields as optional.
- Keep plugin instances isolated.
- Release builds must work without a development server or internet connection.

The audio thread must not allocate, lock, log, access files, parse JSON, call the
frontend, or perform blocking work.

## Normal workflow

```sh
pnpm install --frozen-lockfile
pnpm generate
pnpm check
pnpm test

cmake --preset debug
cmake --build --preset debug
ctest --preset debug
```

For frontend hot reload:

```sh
pnpm dev
```

For an offline production build:

```sh
cmake --preset release
cmake --build --preset release
ctest --preset release
pnpm exec plugin validate --build-vst3-validator
```

## Definition of done for plugin work

A plugin change is complete only when:

- `plugin.yaml` accurately describes the product.
- Generated output is current and deterministic.
- User-authored code remains outside `generated/`.
- Frontend checks and tests pass.
- Native Debug or Release targets build as appropriate.
- Native tests pass.
- DSP remains finite and real-time safe across supported layouts, sample rates,
  and block sizes.
- Parameter changes work in both UI-to-host and host-to-UI directions.
- State and presets survive save/reload and editor recreation.
- Multiple instances remain isolated.
- Release validation reports no development-server dependency.
