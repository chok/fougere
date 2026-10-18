# @fougere/registry
> One answer per name

`Sources` says which source type is `'sqlite'`, `Generators` which generator is `'ulid'`, `Protocols`
which adapter serves `'graphql'`. Each is a registry: a package answers a question by NAME, and a name
has one answer. Zero dependencies. (A question answered by TYPE — a class that extends a port — is
the other form of the same extension point, read off the class hierarchy at boot.)

## Installation
```bash
pnpm add @fougere/registry
```

## The rule

```ts
const Generators = new Registry<() => string>('generator');

Generators.register('ulid', ulid);     // the answer
Generators.register('ulid', ulid);     // the same answer again: nothing happens
Generators.register('ulid', other);    // refused — 'ulid' is answered twice for generator
Generators.replace('ulid', other);     // said: standing in its place is the point
```

A host that re-reads a project in the same process re-runs the files that answer, and says so:

```ts
await Registry.reloading(() => boot(), (registry, name) => log.debug(`${registry} '${name}' replaced`));
```

Inside that call, an answer replaces the one it had. The packages the host does not re-run keep
theirs, so a reload loses nothing.
