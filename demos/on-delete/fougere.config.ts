import { defineFougere } from '@fougere/core';

/**
 * ONE line decides who carries out a deletion.
 *
 * With `sources:` commented out, the three entities share a file and a connection: the engine
 * holds every foreign key, and deleting a user is one statement — no read, no walk.
 *
 * Uncomment it and `Comment` moves to its own database. Two databases share no constraint, so
 * the framework walks the tree itself: what names the row goes first, the row last. And
 * because a cascade run by an engine never passes through the framework, ONE hop leaving that
 * engine hands it the WHOLE tree — otherwise the comments of a cascaded post would be left
 * behind with nothing naming them.
 *
 * The entities are not touched between the two. That is the whole demo.
 */
export default defineFougere({
  db: { path: '.data/app.db' },
  // sources: {
  //   archive: { path: '.data/archive.db', entities: ['Comment'] },
  // },
});
