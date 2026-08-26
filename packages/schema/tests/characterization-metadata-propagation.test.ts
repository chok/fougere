import { describe, expect, it } from 'vitest';
import { entity } from '../src/entity.js';
import { Schema } from '../src/schema/Schema.js';
import { text } from '../src/vocabulary/text.js';

declare module '../src/Hints.js' {
  interface FougereHints<K extends string> {
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
    hints: {
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
  { hints: { characterization: { summary: { marker: 'summary' } } } },
) {}

describe('metadata propagation across every schema operation', () => {
  describe('pick', () => {
    it('filters hints to picked fields', () => {
      expect(Post.pick('id', 'title').getHints()).toEqual({
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
    it('filters hints to retained fields', () => {
      expect(Post.omit('body').getHints()).toEqual({
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
    it('remaps hint keys to current field names', () => {
      expect(Post.rename({ title: 'headline' }).getHints()).toEqual({
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
    it('keeps hints unchanged', () => {
      expect(Post.partial().getHints()).toEqual({
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
    it('keeps existing hints without adding hints for new fields', () => {
      expect(Post.extend({ summary: text() }).getHints()).toEqual({
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
    it('merges hints from every source', () => {
      expect(Schema.compose(Post.pick('title'), Supplement).getHints()).toEqual({
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
