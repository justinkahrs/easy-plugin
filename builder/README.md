# Builder

The builder validates `plugin.yaml`, checks released compatibility, generates the
manifest-owned source set, and runs plugin validation.

From the repository root:

```sh
pnpm generate
```

Generation may replace `generated/`. It never writes to `native/src/` or
`frontend/src/`.

The CLI currently exposes:

```sh
pnpm exec plugin generate
pnpm exec plugin validate
```

Run `pnpm exec plugin help` for options. New copies of the repository should use
the root `pnpm template:init` workflow once before ordinary generation.
