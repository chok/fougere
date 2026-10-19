import { describe, it, expect } from 'vitest';
import { Graph } from '../src/index.js';

const relations = () => new Graph()
  .add('tag')
  .connect('comment', 'post', 'postId')
  .connect('comment', 'user', 'authorId')
  .connect('category', 'category', 'parentId');

describe('Graph', () => {
  it('keeps a node with no edge', () => {
    expect(relations().nodes).toEqual(['tag', 'comment', 'post', 'user', 'category']);
  });

  it('reads an edge from both of its ends', () => {
    const graph = relations();

    expect(graph.outgoing('comment').map((edge) => edge.to)).toEqual(['post', 'user']);
    expect(graph.incoming('post')).toEqual([{ from: 'comment', to: 'post', label: 'postId' }]);
  });

  it('keeps two labels between the same nodes, and the same edge once', () => {
    const graph = new Graph()
      .connect('comment', 'user', 'authorId')
      .connect('comment', 'user', 'approverId')
      .connect('comment', 'user', 'authorId');

    expect(graph.outgoing('comment').map((edge) => edge.label)).toEqual(['authorId', 'approverId']);
    expect(graph.incoming('user')).toHaveLength(2);
  });

  it('answers nothing for a node it does not hold', () => {
    const graph = relations();

    expect(graph.outgoing('nawak')).toEqual([]);
    expect(graph.incoming('nawak')).toEqual([]);
    expect(graph.reachableFrom('nawak')).toEqual([]);
    expect(graph.reaching('nawak')).toEqual([]);
  });

  describe('order', () => {
    it('places a node after what it points to', () => {
      expect(relations().order()).toEqual({ ordered: ['tag', 'post', 'user', 'comment', 'category'], cycle: [] });
    });

    it('takes the first added among the ready, as the seeds always did', () => {
      const graph = new Graph().connect('a', 'c', 'cId').add('b');

      expect(graph.order().ordered).toEqual(['c', 'a', 'b']);
    });

    it('is not held back by a loop', () => {
      const graph = new Graph().connect('category', 'category', 'parentId').connect('post', 'category', 'categoryId');

      expect(graph.order()).toEqual({ ordered: ['category', 'post'], cycle: [] });
    });

    it('leaves out a cycle and what waits on it, in the order they were added', () => {
      const graph = new Graph()
        .connect('c', 'a', 'aId')
        .connect('a', 'b', 'bId')
        .connect('b', 'a', 'aId')
        .add('d');

      expect(graph.order()).toEqual({ ordered: ['d'], cycle: ['c', 'a', 'b'] });
    });
  });

  describe('cycles', () => {
    it('finds none in a graph that has none', () => {
      expect(new Graph().connect('a', 'b', 'x').connect('b', 'c', 'x').connect('a', 'c', 'x').cycles()).toEqual([]);
    });

    it('closes the path it found', () => {
      expect(new Graph().connect('a', 'b', 'x').connect('b', 'c', 'x').connect('c', 'a', 'x').cycles())
        .toEqual([['a', 'b', 'c', 'a']]);
    });

    it('counts a loop', () => {
      expect(relations().cycles()).toEqual([['category', 'category']]);
    });

    it('answers each knot apart, in the order its first node was added', () => {
      const graph = new Graph()
        .connect('x', 'y', 'e')
        .connect('y', 'x', 'e')
        .connect('a', 'b', 'e')
        .connect('b', 'a', 'e')
        .connect('y', 'a', 'e');

      expect(graph.cycles()).toEqual([['x', 'y', 'x'], ['a', 'b', 'a']]);
    });

    it('walks a long chain without exhausting the stack', () => {
      const graph = new Graph<number, string>();
      for (let node = 0; node < 100_000; node++) graph.connect(node, node + 1, 'next');
      graph.connect(100_000, 0, 'back');

      expect(graph.cycles()[0]).toHaveLength(100_002);
    });
  });

  describe('components', () => {
    it('joins nodes whichever way their edges point', () => {
      expect(relations().components()).toEqual([['tag'], ['comment', 'post', 'user'], ['category']]);
    });

    it('reaches what points at a node, after what it points to', () => {
      const graph = new Graph()
        .add('post')
        .connect('comment', 'post', 'postId')
        .connect('post', 'user', 'authorId');

      expect(graph.components()).toEqual([['post', 'user', 'comment']]);
    });
  });

  describe('reach', () => {
    it('follows the edges forward, or back', () => {
      const graph = relations();

      expect(graph.reachableFrom('comment')).toEqual(['comment', 'post', 'user']);
      expect(graph.reaching('post')).toEqual(['post', 'comment']);
    });

    it('stops on a cycle', () => {
      const graph = new Graph()
        .connect('draft', 'review', 'submit')
        .connect('review', 'draft', 'reject')
        .connect('review', 'published', 'approve');

      expect(graph.reachableFrom('draft')).toEqual(['draft', 'review', 'published']);
      expect(graph.reaching('draft')).toEqual(['draft', 'review']);
    });
  });
});
