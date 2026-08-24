import { describe as group, expect, it } from 'vitest';
import { describe, describeSet } from '../src/card/describe.js';
import { entity } from '../src/entity.js';
import { primary } from '../src/vocabulary/primary.js';
import { text } from '../src/vocabulary/text.js';

class Post extends entity({
  id: primary(),
  title: text(),
  body: text(),
  excerpt: text(),
}) {}

group('bundle registration collisions', () => {
  it('silently keeps the second derivation registered under the same source key', () => {
    const first = Post.pick('id', 'title');
    const second = Post.omit('body');
    const bundle = describeSet([first, second]);

    // Characterization: the second registration silently overwrites the first; this freezes the behavior before collision refusal is installed.
    expect(Object.keys(bundle.$defs)).toEqual(['post']);
    expect(bundle.$defs.post).toEqual(describe(second, 'post'));
    expect(bundle.$defs.post).not.toEqual(describe(first, 'post'));
  });
});
