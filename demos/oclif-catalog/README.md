# oclif-catalog — a frond, as a terminal

One entity and one handler. Neither mentions a command line.

```ts
export default class Product extends entity({
  sku: text({ min: 3, max: 20, description: 'Warehouse reference' }),
  cents: number({ description: 'Price, in cents' }),
  state: optional(oneOf('draft', 'listed', 'archived', { default: 'draft' })),
}) {}

export default class ProductHandler extends Crud(Product) {}
```

```
$ fougere product:create --help
USAGE
  $ product:create SKU --name <value> --cents <value> [--state draft|listed|archived]

ARGUMENTS
  SKU  Warehouse reference

FLAGS
  --cents=<value>   (required) Price, in cents
  --state=<option>  [default: draft]
                    <options: draft|listed|archived>
```

Every word above was read off the entity. `SKU` is positional because it is the first
required string — the rule `fougere graph <root>` already follows. `--cents` is an integer
because the shape is a number, `(required)` because the `lifecycle` axis says a caller writes
it, `[default: draft]` because `oneOf` was given one, and the three legal values are listed
because the shape names them:

```
$ fougere product:create A-1 --name Chair --cents 1 --state retired
 ›   Error: Expected --state=retired to be one of: draft, listed, archived
```

The topic `product` forms itself: a command is identified `address:op`, and oclif groups on
the part before the colon. Nothing registers it.

## Why oclif here and citty in `@fougere/cli`

`@fougere/cli` is Fougere's own tool: fifteen flat commands, one operation each, and nothing
that wants a topic. This is a HOST, at the same rank as `@fougere/nuxt` — what it serves is
whatever frond it is pointed at, so it wants the machinery around a command line: topics,
plugins, `--json`, an autocompletion it does not have to write.

One thing to know, and it is the risk this package carries. oclif discovers commands in FILES
at build time; a frond's are known only after the scan. They are inserted through
`insertLegacyPlugins`, which works, is the only entry that takes commands nobody read from
disk, and whose name says `legacy` — it exists for Heroku's older plugins, and it is typed
private.

## The database is the one thing a terminal changes

```ts
db: { dialect: 'sqlite', path: '.fougere/catalog.db' }
```

A command is a process that starts and stops, so an in-memory row would die between
`product:create` and `product:list`. It is stated in `fougere.config.ts` and nowhere else.
