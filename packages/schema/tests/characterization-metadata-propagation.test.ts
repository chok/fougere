import { describe, expect, it } from 'vitest';
import { entity, Schema, text } from '../src/index.js';

declare module '../src/entity/EntityAdapters.js' {
  interface FougereEntityAdapters<K extends string> {
    characterization?: Partial<Record<K, { marker?: string }>>;
  }
}

class Post extends entity(
  {
    id: text(),
    title: text(),
    body: text(),
  },
  {
    adapters: {
      characterization: {
        title: { marker: 'title' },
        body: { marker: 'body' },
      },
    },
    previous: { title: 'headline' },
    unique: [['title', 'body']],
  },
) {}

class Supplement extends entity(
  { summary: text(), locale: text() },
  {
    adapters: { characterization: { summary: { marker: 'summary' } } },
    unique: [['summary', 'locale']],
  },
) {}

describe('metadata propagation across every schema operation', () => {
  describe('pick', () => {
    it('filters adapter entries to picked fields', () => {
      expect(Post.pick('id', 'title').getAdapters()).toEqual({
        characterization: { title: { marker: 'title' } },
      });
    });

    it('keeps patch opts from the current schema', () => {
      expect(Post.partial().pick('title').getOpts()).toEqual({ patch: true });
    });

    it('does not propagate previous', () => {
      expect(Post.pick('title').previous).toBeUndefined();
    });

    it('drops a group missing a member, keeps one whose members are all picked', () => {
      expect(Post.pick('id', 'title').getUnique()).toBeUndefined();
      expect(Post.pick('title', 'body').getUnique()).toEqual([['title', 'body']]);
    });
  });

  describe('omit', () => {
    it('filters adapter entries to retained fields', () => {
      expect(Post.omit('body').getAdapters()).toEqual({
        characterization: { title: { marker: 'title' } },
      });
    });

    it('keeps patch opts from the current schema', () => {
      expect(Post.partial().omit('body').getOpts()).toEqual({ patch: true });
    });

    it('does not propagate previous', () => {
      expect(Post.omit('body').previous).toBeUndefined();
    });

    it('drops a group missing a member, keeps one whose members are all retained', () => {
      expect(Post.omit('body').getUnique()).toBeUndefined();
      expect(Post.omit('id').getUnique()).toEqual([['title', 'body']]);
    });
  });

  describe('rename', () => {
    it('remaps adapter entry keys to current field names', () => {
      expect(Post.rename({ title: 'headline' }).getAdapters()).toEqual({
        characterization: {
          headline: { marker: 'title' },
          body: { marker: 'body' },
        },
      });
    });

    it('keeps patch opts from the current schema', () => {
      expect(Post.partial().rename({ title: 'headline' }).getOpts()).toEqual({ patch: true });
    });

    it('does not propagate previous', () => {
      expect(Post.rename({ title: 'headline' }).previous).toBeUndefined();
    });

    it('carries the group under the names the fields take now', () => {
      expect(Post.rename({ title: 'headline' }).getUnique()).toEqual([['headline', 'body']]);
    });
  });

  describe('partial', () => {
    it('keeps adapter entries unchanged', () => {
      expect(Post.partial().getAdapters()).toEqual({
        characterization: {
          title: { marker: 'title' },
          body: { marker: 'body' },
        },
      });
    });

    it('sets patch opts', () => {
      expect(Post.partial().getOpts()).toEqual({ patch: true });
    });

    it('does not propagate previous', () => {
      expect(Post.partial().previous).toBeUndefined();
    });

    it('keeps the group unchanged', () => {
      expect(Post.partial().getUnique()).toEqual([['title', 'body']]);
    });
  });

  describe('extend', () => {
    it('keeps existing entries without adding any for new fields', () => {
      expect(Post.extend({ summary: text() }).getAdapters()).toEqual({
        characterization: {
          title: { marker: 'title' },
          body: { marker: 'body' },
        },
      });
    });

    it('keeps patch opts from the current schema', () => {
      expect(Post.partial().extend({ summary: text() }).getOpts()).toEqual({ patch: true });
    });

    it('does not propagate previous', () => {
      expect(Post.extend({ summary: text() }).previous).toBeUndefined();
    });

    it('keeps the group unchanged, and states none for the added field', () => {
      expect(Post.extend({ summary: text() }).getUnique()).toEqual([['title', 'body']]);
    });
  });

  describe('compose', () => {
    it('merges adapter entries from every source', () => {
      expect(Schema.compose(Post.pick('title'), Supplement).getAdapters()).toEqual({
        characterization: {
          title: { marker: 'title' },
          summary: { marker: 'summary' },
        },
      });
    });

    it('merges patch opts from its sources', () => {
      expect(Schema.compose(Post.partial(), Supplement).getOpts()).toEqual({ patch: true });
    });

    it('does not propagate previous', () => {
      expect(Schema.compose(Post, Supplement).previous).toBeUndefined();
    });

    it('merges the groups of every source, and one group twice stays one', () => {
      expect(Schema.compose(Post, Supplement).getUnique()).toEqual([
        ['title', 'body'],
        ['summary', 'locale'],
      ]);
      expect(Schema.compose(Post, Post).getUnique()).toEqual([['title', 'body']]);
    });
  });
});
