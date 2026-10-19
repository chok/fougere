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
Generators.register('ulid', other);    // refused — Two generators are named 'ulid'
Generators.replace('ulid', other);     // said: standing in its place is the point
```

A host that re-reads a project in the same process re-runs the files that answer, and says so:

```ts
await Registry.reloading(() => boot(), (registry, name) => log.debug(`${registry} '${name}' replaced`));
```

Inside that call, an answer replaces the one it had. The packages the host does not re-run keep
theirs, so a reload loses nothing.

## A term

```ts
export const ulid = Generators.term('ulid', () => …);   // a name and its answer, as a value
ulid.register();                                         // registered where it is used
```

A term is what a project's `vocabulary/` file exports: the statement lists it for the process
(`export const vocabulary = [ulid]` in `fronds.ts`), and the boot registers it. Imported for a value,
it is never dropped by a bundler the way a file imported only to register is.
