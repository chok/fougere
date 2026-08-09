/**
 * The one line this repository writes about someone else's fact: **it accepts it**.
 *
 * The SHAPE is no longer here. `fougere sync` fetched it from the blog's identity card
 * (`pnpm sync`) and wrote `.fougere/remotes/blog/entities/PostPublished.ts` — generated,
 * gitignored, regenerated whenever the emitter changes. This file re-exports it into
 * `search`'s own `entities/`, which is what makes the judge apply: the boot judges an
 * arriving fact against an entity of a scanned frond, and a package under `.fougere/`
 * is not one.
 *
 * Until the card published facts, the fields were copied by hand right here — two
 * declarations, nothing comparing them, and a drift nobody would have seen until a
 * payload was silently refused.
 *
 * What the two repositories still meet on is the NAME. `PostPublished` on both sides
 * becomes the topic `postPublished`, derived and never written.
 */
export { default } from '../../../.fougere/remotes/blog/entities/PostPublished.js';
