# @fougere/container
> Fougere's DI container
Resolution **by type**, never by parameter name: the AST scan reads the constructor
signature and wires what it asks for. Nested scopes, one per frond. Zero dependencies.

It is small on purpose. The scan already knows the graph — every class and every
dependency is read from source before boot — so there is almost nothing left to bind
late: a Map with a parent chain, a scope, and a resolver of last resort for a frond
that lives in another process.

## Installation
```bash
pnpm add @fougere/container
```

## What the alternatives ask of a class

Measured at the tarball on 2026-09-11, not read off a README.

| | where a dependency is declared | what the class carries | deps | unpacked |
|---|---|---|---|---|
| [InversifyJS 8.2.3](https://www.npmjs.com/package/inversify) | a decorator | `@injectable()`, `@inject(TOKEN)` | 3 | 36 KB, plus its three |
| [tsyringe 4.10.0](https://www.npmjs.com/package/tsyringe) | a decorator, read through `Reflect` | `@injectable()`, and `import 'reflect-metadata'` at the entry point — it throws at load without one | `tslib` | 148 KB |
| [TypeDI 0.10.0](https://www.npmjs.com/package/typedi) | a decorator | `@Service()` | 0 | last published 2022-12-09 |
| [typed-inject 5.0.0](https://www.npmjs.com/package/typed-inject) | a static field | `static inject = tokens('logger')` | 0 | 102 KB |
| [Awilix 13.0.5](https://www.npmjs.com/package/awilix) | the parameter's NAME (`CLASSIC`), or the destructured property's (`PROXY`) | nothing — but the name becomes the contract | `fast-glob` | 326 KB |
| [didi 11.0.0](https://www.npmjs.com/package/didi) | the parameter's name, or `Car.$inject = ['engine']` | nothing, or the static | 0 | 49 KB |
| `@fougere/container` | the parameter's TYPE | nothing | 0 | 220 lines |

Every row but the last makes the class name the container. `@injectable()`, `static inject`
and `$inject` are the dependency written a second time, next to the signature that already
states it. A parameter name is the same thing spelled shorter, and it is the one a bundler
may rewrite — which is why didi ships `$inject` as the "minification safe manner", and why
`ProviderEntry.name` is written down here rather than read off `ctor.name` at boot.

Here the signature IS the declaration. `constructor(private users: UserRepository)` is read
by the scan (`depKeyOf`, `@fougere/compiler`), which hands the boot `deps:
['UserRepository']`. So `register` receives the graph already resolved and this container
infers nothing — which is the whole reason it fits in 220 lines. What these libraries exist
to answer is answered before they would run.

## What they have that this does not

- **typed-inject** resolves type-safely — `resolve<Token extends keyof TContext>` refuses at
  compile time a token the injector cannot answer. Here `resolve<T>(name: string): T` is an
  unchecked cast, and a wrong name is a boot error instead.
- **Awilix** has a third lifetime (`SCOPED`, one instance per scope), `aliasTo`, a disposer
  per registration, and `loadModules`. This has two lifetimes, and disposes what it built.

And one thing none of them has: a resolver of last resort. `setFallback` has a single
caller — the boot, fabricating a façade for a frond declared in `remotes:`. Such a frond
registers nothing here, because it runs in another process.

## This one, measured the same way

`0.8.4-alpha.0` — 21 KB unpacked, zero dependencies, 220 lines, one test file. Seven
methods, two lifetimes, a parent chain consulted upward on every miss.

The holes, probed rather than assumed:

- **A transient is never disposed**, deliberately — the container disposes what it KEEPS and
  hands a transient over. Nothing says so where it is registered.
- **A second `register` of one name overwrites, silently.** `Bundle` refuses a duplicate
  registration key, `serveRpc` a second reading, `portBindings` two implementations of a
  port. This does not.
- `RegisterOptions` and `Disposable` are named by `Container` but not exported from the
  entry, so a caller cannot spell the options object it passes.

## Why not didi

It is the closest of the six, so it gets the measurement rather than a position.
`annotate(['engine', 'license'], Car)` puts the dependency list OUTSIDE the class — exactly
the shape the scan produces, and the class carries nothing, as here. `createChild` nests.
`get(name, false)` answers `null` instead of throwing. 49 KB, zero dependencies, published
2025-12-11.

Two things stop it. **It has no disposal at all** — no `dispose`, `teardown`, `destroy` or
`close`, in its API, its code or its README — and `container.dispose()` is the middle of the
three levels `app.dispose()` runs in reverse of construction. And its unit is a
`ModuleDeclaration` carrying `__init__`, `__depends__` and `__exports__`: a second notion of
module beside the frond, onto which every frond would have to be projected.

Reading it paid anyway. Its `currentlyResolving` stack is the shape used here, and naming
the descent in EVERY refusal — not only in a cycle — is its idea: `'Zzz' is not registered
(resolving: A → B → Zzz)`. Two things were changed on the way in. Its `pop()` sits outside a
`finally` (didi 11.0.0, `dist/index.js`), so a constructor that throws leaves the name on the
stack and the next resolution of it reports a cycle that is not there — measured, and the
reason this one pops in a `finally`. And its stack belongs to one injector, where this one
shares it down the tree, which is what lets a path that continues in a parent be named whole.

The day this container needs less than it does — no disposal to run, no scope filled after
it is created — didi is the one to take.


---

Part of [Fougere](https://github.com/chok/fougere) — one schema, a gradient from
monolith to distributed, the same user code.
Reference documentation: [the site](https://fougere.dev/) (en/fr).
