import { describe, it, expect } from 'vitest';
import { entity, primary, ref, text, type Entity } from '@fougere/schema';
import { buildGraph, clusterEntities, suggestSplit } from '../src/DomainCluster.js';
import type { EntityEntry } from '../src/descriptor/EntityEntry.js';
import type { FrondDescriptor } from '../src/descriptor/FrondDescriptor.js';

class Tag extends entity({ id: primary(), label: text() }) {}
class User extends entity({ id: primary(), name: text() }) {}
class Post extends entity({ id: primary(), title: text(), author: ref(User), tag: ref(Tag) }) {}
class Comment extends entity({ id: primary(), body: text(), post: ref(Post), author: ref(User) }) {}
class Invoice extends entity({ id: primary(), total: text() }) {}
class Line extends entity({ id: primary(), invoice: ref(Invoice) }) {}
class Category extends entity({ id: primary(), parent: ref((): Entity => Category) }) {}

class BlogAuthor extends entity({ id: primary(), name: text() }) {}
class Article extends entity({ id: primary(), author: ref(BlogAuthor) }) {}

function frond(entities: Record<string, unknown>): FrondDescriptor {
  return {
    name: 'blog',
    source: { path: '/blog' } as FrondDescriptor['source'],
    providers: [], handlers: [], presenters: [], collectors: [], seeds: [],
    entities: Object.entries(entities).map(([name, entityClass]) => ({ name, entityClass, filePath: `${name}.ts` })) as EntityEntry[],
  };
}

const domains = frond({ tag: Tag, user: User, post: Post, comment: Comment, invoice: Invoice, line: Line, category: Category });

describe('the entity graph', () => {
  it('reads each ref() both ways', () => {
    expect(Object.fromEntries(buildGraph([domains]))).toEqual({
      tag: { name: 'tag', frond: 'blog', refs: [], referencedBy: ['post'] },
      user: { name: 'user', frond: 'blog', refs: [], referencedBy: ['post', 'comment'] },
      post: { name: 'post', frond: 'blog', refs: ['user', 'tag'], referencedBy: ['comment'] },
      comment: { name: 'comment', frond: 'blog', refs: ['post', 'user'], referencedBy: [] },
      invoice: { name: 'invoice', frond: 'blog', refs: [], referencedBy: ['line'] },
      line: { name: 'line', frond: 'blog', refs: ['invoice'], referencedBy: [] },
      category: { name: 'category', frond: 'blog', refs: ['category'], referencedBy: ['category'] },
    });
  });

  it('groups what a ref() joins, named by the most referenced', () => {
    expect(clusterEntities(buildGraph([domains]))).toEqual([
      { name: 'user', entities: ['tag', 'post', 'user', 'comment'], crossRefs: [] },
      { name: 'invoice', entities: ['invoice', 'line'], crossRefs: [] },
      { name: 'category', entities: ['category'], crossRefs: [] },
    ]);
  });

  it('cuts one group at its roots when asked to split', () => {
    const connected = frond({ tag: Tag, user: User, post: Post, comment: Comment });

    expect(suggestSplit(buildGraph([connected]))).toEqual([
      { name: 'tag', entities: ['tag', 'post'], crossRefs: [{ from: 'post', to: 'user', targetCluster: 'user' }] },
      { name: 'user', entities: ['user', 'comment'], crossRefs: [{ from: 'comment', to: 'post', targetCluster: 'tag' }] },
    ]);
  });

  it('joins an entity whose name is two words to what names it', () => {
    const nodes = buildGraph([frond({ blogAuthor: BlogAuthor, article: Article })]);

    expect(nodes.get('blogAuthor')!.referencedBy).toEqual(['article']);
    expect(clusterEntities(nodes)).toHaveLength(1);
  });
});
