import { describe, expect, it } from 'vitest';
import { entity } from '../src/entity.js';
import { Schema } from '../src/Schema.js';
import { text } from '../src/vocabulary/text.js';

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
  },
) {}

class Supplement extends entity(
  { summary: text() },
  { adapters: { characterization: { summary: { marker: 'summary' } } } },
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
  });
});
