import { describe as group, expect, it } from 'vitest';
import { Bundle, entity, primary, text } from '../src/index.js';

class Post extends entity({
  id: primary(),
  title: text(),
  body: text(),
  excerpt: text(),
}) {}

group('bundle registration collisions', () => {
  it('refuses two derivations registered under the same source key', () => {
    const first = Post.pick('id', 'title');
    const second = Post.omit('body');

    // Refusing protects both derivations from being silently replaced under their shared root key.
    expect(() => Bundle.fromSchemas([first, second])).toThrow(
      "Schemas 'Post' and 'Post' both claim bundle key 'post'",
    );
  });
});
