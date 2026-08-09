import { entity, primary, text, auto } from '@fougere/schema';

/**
 * THIS repository's own copy of the contract. It imports nothing from `blog` — there is no
 * `blog` on this disk.
 *
 * Written by hand here, because `fougere sync` cannot fetch it yet: a fact carries no
 * operations, and the identity card only publishes what has a door. That gap is real and
 * this file is standing in for it.
 *
 * The two copies meet on ONE thing: the name. `PostPublished` on both sides becomes the
 * topic `postPublished`, derived and never written.
 */
export default class PostPublished extends entity({
  id: primary(),
  title: text({ min: 1 }),
  at: auto(),
}) {}
