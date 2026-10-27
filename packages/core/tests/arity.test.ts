/**
 * A frond declared by hand states its dependencies itself, and forgetting one used to hand the
 * constructor `undefined` with nothing said — the boot read "1 handlers" and the first call ran
 * wrong. `Function.length` is a floor: a constructor inherited from a prefab reads 0.
 */
import { describe, it, expect } from 'vitest';
import { createContainer } from '@fougere/container';
import { entity, primary, text } from '@fougere/schema';
import { createApp, Repository, frond, type FrondDeclaration } from '../src/index.js';
import { memory } from './memory.js';

class Post extends entity({ id: primary(), title: text() }) {}

class Clock {
  now(): string {
    return 'noon';
  }
}

class ClockedHandler extends Repository<Post> {
  constructor(readonly clock: Clock) {
    super();
  }
}

class DefaultedHandler extends Repository<Post> {
  constructor(readonly clock = new Clock()) {
    super();
  }
}

const boot = (handlers: FrondDeclaration['handlers']) =>
  createApp({
    fronds: [frond('blog', { entities: [Post], providers: [Clock], handlers })],
    createContainer,
    storageFactory: memory,
  });

describe('a constructor asking for more than it is declared', () => {
  it('refuses the boot, naming the class and what was declared', async () => {
    await expect(boot([{ ctor: ClockedHandler, repository: Post, deps: [] }]))
      .rejects.toThrow(/\[constructor-arity\] ClockedHandler[\s\S]*takes 1 parameter\(s\), but only 0 are typed \(none\)/);
  });

  it('boots once every parameter is declared', async () => {
    await using app = await boot([{ ctor: ClockedHandler, repository: Post, deps: ['Clock'] }]);

    expect(app.fronds.map((one) => one.name)).toContain('blog');
  });

  it('reads an inherited constructor and a defaulted parameter as nothing to ask for', async () => {
    class InheritedHandler extends Repository<Post> {}

    await using inherited = await boot([{ ctor: InheritedHandler, repository: Post }]);
    await using defaulted = await boot([{ ctor: DefaultedHandler, repository: Post, deps: [] }]);

    expect(inherited.fronds).toHaveLength(1);
    expect(defaulted.fronds).toHaveLength(1);
  });
});
