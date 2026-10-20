# @fougere/state-session
> A caller's state kept in a session

An op reads and writes the caller's state by name (`state: State`); `state:` in `fougere.config.ts`
says how each name is kept. Importing this package makes `session` one of the ways:

```ts
import '@fougere/state-session';

export default defineFougere({
  state: {
    locale: { cookie: {} },     // small, readable: its own cookie
    cart: { session: {} },      // kept server-side
    draft: { session: {} },     // the same row as cart
  },
});
```

The caller holds one cookie, `session`, with a random reference; every name kept in `session` lives in
one `StateSession` row, in the default source like any entity — `fougere migrate` creates its table.
The op does not change: `state.set('cart', …)` whichever way `cart` is kept. A session whose names are
all forgotten is deleted, its cookie with it.
