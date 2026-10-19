# @fougere/state-cookie
> A caller's state, kept in a cookie

An op reads and writes the caller's state by name (`state: State`); `state:` in `fougere.config.ts`
says how each name is kept. Importing this package makes `cookie` one of the ways:

```ts
import '@fougere/state-cookie';

export default defineFougere({
  state: { cart: { cookie: { maxAge: 604800 } } },   // HttpOnly, SameSite=Lax, Path=/ unless said otherwise
});
```

Core signs every value before it leaves (`FOUGERE_STATE_KEY`): the caller can read its cookie, and a
changed one reads as absent. Every HTTP door carries it — REST, GraphQL, and the envelope a page calls.
