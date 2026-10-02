# create-fougere

> Scaffold a Fougere workspace

```bash
pnpm create fougere shop --frond blog --app nuxt
```

Everything after the name is read by `fougere new`, so every flag it declares
works here: `--frond`, `--app`, `--bare`, `--force`. With no flags and
a terminal, it asks.

With pnpm, a version published too recently is held back by its `minimum-release-age`. To try the
latest one right away:

```bash
pnpm --config.minimum-release-age=0 create fougere
```

**[Documentation →](https://fougere.dev/)**
