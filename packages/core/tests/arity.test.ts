/**
 * A frond declared by hand states its dependencies itself, and forgetting one used to hand the
 * constructor `undefined` with nothing said — the boot read "1 handlers" and the first call ran
 * wrong. `Function.length` is a floor: a constructor inherited from a prefab reads 0.
 */
import { describe, it, expect } from 'vitest';
import { createContainer } from '@fougere/container';
import { entity, primary, text } from '@fougere/schema';
import { createApp, Crud, frond, type FrondDeclaration } from '../src/index.js';

class Post extends entity({ id: primary(), title: text() }) {}

class Clock {
  now(): string {
    return 'noon';
  }
}

class ClockedHandler extends Crud(Post) {
  constructor(
    posts: never,
    readonly clock: Clock,
  ) {
    super(posts);
  }
}

class DefaultedHandler extends Crud(Post) {
  constructor(
    posts: never,
    readonly clock = new Clock(),
  ) {
    super(posts);
  }
}

const boot = (handlers: FrondDeclaration['handlers']) =>
  createApp({
    fronds: [frond('blog', { entities: [Post], providers: [Clock], handlers })],
    createContainer,
  });

describe('a constructor asking for more than it is declared', () => {
  it('refuses the boot, naming the class and what was declared', async () => {
    await expect(boot([{ ctor: ClockedHandler, deps: ['PostRepository'] }]))
      .rejects.toThrow(/\[constructor-arity\] ClockedHandler[\s\S]*takes 2 parameter\(s\) and 1 dependency is declared \(PostRepository\)/);
  });

  it('boots once every parameter is declared', async () => {
    await using app = await boot([{ ctor: ClockedHandler, deps: ['PostRepository', 'Clock'] }]);

    expect(app.fronds.map((one) => one.name)).toContain('blog');
  });

  it('reads an inherited constructor and a defaulted parameter as nothing to ask for', async () => {
    class InheritedHandler extends Crud(Post) {}

    await using inherited = await boot([InheritedHandler]);
    await using defaulted = await boot([{ ctor: DefaultedHandler, deps: ['PostRepository'] }]);

    expect(inherited.fronds).toHaveLength(1);
    expect(defaulted.fronds).toHaveLength(1);
  });
});
