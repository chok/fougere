/**
 * What an app hosts — what it states, each frond its own copy: the boot writes on a frond, and a
 * statement handed to a second boot must not arrive carrying the first one's answers.
 */
import { describe, it, expect } from 'vitest';
import { entity, primary, text } from '@fougere/schema';
import { frond } from '../src/index.js';
import { hostedBy } from '../src/boot/hosted.js';

class Post extends entity({ id: primary(), title: text() }) {}
class PostHandler { list() { return []; } }

describe('what an app hosts', () => {
  it('takes the stated fronds, and reads no disk', () => {
    expect(hostedBy([frond('blog', { entities: [Post] })]).entityNames()).toEqual(['post']);
  });

  it('hands each boot its own copy of a frond and of its handlers', () => {
    const blog = frond('blog', { entities: [Post], handlers: [PostHandler] });
    const [hosted] = hostedBy([blog]);

    hosted!.extends = 'shop';
    hosted!.handlers[0]!.deps.push('Stamped');

    expect(blog.extends).toBeUndefined();
    expect(hosted!.handlers[0]).not.toBe(blog.handlers[0]);
  });
});
