import { describe, expect, it } from 'vitest';
import { describe as describeSchema, email, entity, oneOf, primary, readOnly, text } from '@fougere/schema';
import type { CardOp, IdentityCard } from '@fougere/core/contract';
import { applyAdminExtensions, defineAdminExtension, type AdminExtension } from '../src/extensions.js';
import { actionsOf } from '../src/resources.js';
import { resourcesOf } from '../src/resources.js';

class Post extends entity({
  id: primary(),
  title: text({ min: 1 }),
  status: oneOf('draft', 'published'),
  internalNote: readOnly(text()),
}) {}

class Author extends entity({ id: primary(), name: text() }) {}
class User extends entity({ id: primary(), name: text(), email: email(), role: oneOf('admin', 'editor') }) {}

const ops = (...names: string[]): CardOp[] => names.map((name) => ({
  name,
  kind: name === 'list' || name === 'findById' ? 'query' : 'command',
}));

const card: IdentityCard = {
  fronds: [{
    name: 'blog',
    doors: [
      {
        name: 'post',
        schema: describeSchema(Post, 'post'),
        ops: ops('list', 'findById', 'create', 'update', 'delete', 'publish'),
      },
      {
        name: 'author',
        schema: describeSchema(Author, 'author'),
        ops: ops('list', 'findById'),
      },
      {
        name: 'user',
        schema: describeSchema(User, 'user'),
        ops: ops('list', 'findById', 'create', 'update'),
      },
      { name: 'health', ops: ops('get') },
    ],
    facts: [],
  }],
};

describe('resourcesOf', () => {
  it('derives resources, CRUD capabilities and custom operations from the card', () => {
    const resources = resourcesOf(card);
    expect(resources.map((resource) => resource.name)).toEqual(['post', 'author', 'user']);

    const post = resources[0]!;
    expect(post).toMatchObject({
      name: 'post',
      label: 'Post',
      frond: 'blog',
      primary: 'id',
      can: { list: true, show: true, create: true, edit: true, delete: true },
    });
    expect(post.operations.map(({ name, label }) => [name, label])).toContainEqual(['publish', 'Publish']);
    expect(post.fields.map((field) => field.name)).not.toContain('internalNote');
    expect(post.columns.map((column) => column.name)).toContain('internalNote');
  });

  it('infers no facet, however suggestive the field names are', () => {
    // `post` carries `title` and a `status` enum whose members are literally 'draft'
    // and 'published'; `user` carries `name`, `email` and `role`. An earlier version
    // read exactly those words and answered an `editorial` and a `users` facet.
    //
    // It was removed because the words are the wrong evidence: a field is recognised
    // by its FORM, and `oneOf('draft','published')` states that the set is closed —
    // never what a member MEANS. The same entity spelling `titre` or `brouillon` got
    // nothing, silently, which is worse than getting nothing loudly.
    for (const resource of resourcesOf(card)) expect(resource.facets).toEqual({});
  });

  it('does not turn a schema-less door into fake furniture', () => {
    expect(resourcesOf(card).map((resource) => resource.name)).not.toContain('health');
  });
});

describe('additive extensions', () => {
  it('changes only named details and keeps every unmentioned derived field', () => {
    const resources = applyAdminExtensions(resourcesOf(card), [
      defineAdminExtension({
        resource: 'post',
        label: 'Articles',
        fields: {
          title: { label: 'Headline' },
          internalNote: { hidden: true },
        },
        operations: { publish: { label: 'Publish now', confirm: 'Publish this article?' } },
        facets: {
          editorial: {
            title: 'title',
            updatedAt: 'publishedAt',
            state: { field: 'status', draft: ['draft'], published: ['published'] },
          },
          media: { cover: 'coverImage' },
        },
      }),
    ]);

    const post = resources.find((resource) => resource.name === 'post')!;
    expect(post.label).toBe('Articles');
    expect(post.fields.find((field) => field.name === 'title')?.label).toBe('Headline');
    expect(post.columns.find((field) => field.name === 'title')?.label).toBe('Headline');
    expect(post.columns.map((field) => field.name)).not.toContain('internalNote');
    expect(post.fields.map((field) => field.name)).toContain('status');
    expect(post.operations.find((operation) => operation.name === 'publish')).toMatchObject({
      label: 'Publish now',
      confirm: 'Publish this article?',
    });
    expect(post.facets.editorial).toMatchObject({
      title: 'title',
      updatedAt: 'publishedAt',
      state: { field: 'status', draft: ['draft'], published: ['published'] },
    });
    expect(post.facets.media).toEqual({ cover: 'coverImage' });
    expect(resources.find((resource) => resource.name === 'author')).toEqual(resourcesOf(card)[1]);
  });

  it('composes ordered patches and can restore an earlier boolean decision', () => {
    const [post] = applyAdminExtensions(resourcesOf(card), [
      { resource: 'post', fields: { status: { hidden: true } } },
      { resource: 'post', fields: { status: { hidden: false } } },
    ]);

    expect(post!.fields.map((field) => field.name)).toContain('status');
    expect(post!.can.edit).toBe(true);
  });

  it('cannot remove a resource or an operation — a surface says that, not a flag', () => {
    // Both used to carry `hidden`, which hid in the browser what the façade still
    // served. What a door serves to one audience is what a named surface states, and
    // the card then answers restricted — so there is nothing left for a flag to do,
    // and nothing that reads as a permission while enforcing none.
    const extension = { resource: 'author', fields: {} } as AdminExtension;
    expect('hidden' in extension).toBe(false);

    const resources = applyAdminExtensions(resourcesOf(card), [extension]);
    expect(resources.map((resource) => resource.name)).toEqual(['post', 'author', 'user']);
    expect(resources.find((r) => r.name === 'post')!.can.edit).toBe(true);
  });
});

describe('what a door serves beyond CRUD', () => {
  it('separates the five verbs from the business operations', () => {
    // The only thing this panel has that a generic CRUD admin has not — and until
    // `actionsOf` existed, `AdminResource.operations` fed a stats widget and nothing
    // else, so `publish` was announced by the card and had no button anywhere.
    const post = resourcesOf(card).find((r) => r.name === 'post')!;
    expect(actionsOf(post.operations).map((op) => op.name)).toEqual(['publish']);
  });

  it('a door serving only CRUD has no actions, and says so with an empty list', () => {
    const author = resourcesOf(card).find((r) => r.name === 'author')!;
    expect(actionsOf(author.operations)).toEqual([]);
  });
});
