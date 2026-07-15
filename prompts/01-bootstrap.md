# Milestone Prompt: Repository Bootstrap

Implement Milestones 0 and 1 from `IMPLEMENTATION_PLAN.md`.

Read these files first:

1. `AGENTS.md`
2. `PRODUCT_SPEC.md`
3. `ARCHITECTURE.md`
4. `PLUGIN_SCHEMA.md`
5. `BRIDGE_PROTOCOL.md`
6. `ACCEPTANCE_TESTS.md`
7. `IMPLEMENTATION_PLAN.md`
8. `plugin.example.yaml`

## Scope

Create:

- Repository layout
- CMake configuration
- JUCE dependency configuration
- SvelteKit frontend
- pnpm workspace
- Native standalone target
- JUCE `WebBrowserComponent`
- Development frontend loading
- Embedded release frontend loading
- Browser mock bridge
- Minimal native and frontend smoke tests
- CI skeleton

## Constraints

- Use C++20.
- Use TypeScript strict mode.
- Use SvelteKit static output.
- Do not use a Node runtime in the shipped application.
- Do not require an internet connection in release mode.
- Do not implement manifest-driven parameter generation yet.
- Do not add Web Audio or Web MIDI.
- Do not place user code in generated directories.
- Do not leave release builds dependent on localhost.

## Completion criteria

- CMake configures from a clean checkout.
- The standalone target builds and launches.
- Debug mode can load the Vite development server.
- Release mode loads embedded frontend assets.
- Release mode works with networking disabled.
- The Svelte frontend runs in a normal browser with a mock bridge.
- One native smoke test passes.
- One frontend test passes.
- CI executes the available tests.
- Exact build and development commands are documented.

## Final report

Report:

- Files created
- Commands run
- Tests run
- Acceptance tests passed
- Acceptance tests not passed
- Known limitations
- Next milestone
