# Builder

The builder owns manifest parsing, validation, compatibility checks, and deterministic source generation.

From the repository root:

```sh
pnpm generate
```

The workspace command builds the TypeScript CLI and runs `plugin generate` against `plugin.yaml` when present, otherwise `plugin.example.yaml`. The generator may replace `generated/` and never writes to `native/src/` or `frontend/src/`.

