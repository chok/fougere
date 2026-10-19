# @fougere/graph
> Nodes, edges, and four questions

The seeds plant a `Post` before the `Comment` that names it, a deletion asks which rows name the one
it removes, and `fougere graph` groups the entities that name each other. Each is a question asked of
one directed graph. Zero dependencies.

## Installation
```bash
pnpm add @fougere/graph
```

## The graph

```ts
const relations = new Graph<string, string>()
  .add('tag')                                  // a node with no edge still counts
  .connect('comment', 'post', 'postId')        // from, to, label
  .connect('comment', 'user', 'authorId')
  .connect('comment', 'user', 'approverId')    // two labels, two edges
  .connect('category', 'category', 'parentId');

relations.outgoing('comment');     // the three edges leaving it
relations.incoming('post');        // [{ from: 'comment', to: 'post', label: 'postId' }]
```

## The four questions

```ts
relations.order();
// { ordered: ['tag', 'post', 'user', 'comment', 'category'], cycle: [] }
relations.cycles();                // [['category', 'category']]
relations.components();            // [['tag'], ['comment', 'post', 'user'], ['category']]
relations.reachableFrom('comment');   // ['comment', 'post', 'user']
relations.reaching('post');           // ['post', 'comment']
```

- `order()` places each node after the nodes it points to, the first added first among those ready.
  What no order can place — a cycle, and whatever waits on one — comes back as `cycle`. A loop places
  a node against no other, so it orders nothing.
- `cycles()` gives one closed path per group of nodes that reach each other, loops included.
- `components()` joins nodes whichever way their edges point.
- `reachableFrom()` follows the edges, `reaching()` follows them back.

Every answer follows the order the nodes were added in. Whether a cycle is a fault is the caller's to
say: `Category.parentId` is legal, a class asking for itself is not.
