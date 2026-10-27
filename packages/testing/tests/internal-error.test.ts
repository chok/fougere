/**
 * An error nobody wrote for a caller never leaves, whichever door the caller came in by — the rule
 * `toPublicError` states, which GraphQL did not apply: the message below reached the client whole.
 */
import '@fougere/adapter-graphql';
import { describe, expect, it } from 'vitest';
import { executeOn } from '@fougere/adapter-graphql';
import { configureFougere, useFougereApp } from '@fougere/app';
import { answered, called } from './web.js';
import { frond } from '@fougere/core';
import { entity, primary, text } from '@fougere/schema';

const SECRET = 'secret at /etc/db.sqlite';

class Note extends entity({ id: primary(), title: text() }) {}
class NoteHandler {
  find(id: string): Note { return { id, title: 'kept' } as Note; }
  boom(): Note { throw new Error(SECRET); }
}

configureFougere({
  migrates: true,
  config: { protocols: { rest: {}, graphql: {} } },
  fronds: [frond('desk', {
    entities: [Note],
    handlers: [{ ctor: NoteHandler, operations: {
      find: { params: { id: [Note, 'id'] }, output: Note },
      boom: { params: {}, output: Note },
    } }],
  })],
});
const app = await useFougereApp();

describe('an accidental error, at every door', () => {
  it('reads Internal error on JSON-RPC', async () => {
    const answer = (await called(app, 'note.boom')).body;
    expect(JSON.stringify(answer)).not.toContain(SECRET);
    expect(answer).toMatchObject({ error: { message: 'Internal error' } });
  });

  it('reads Internal error on REST', async () => {
    expect(await answered(app, 'POST', '/api/desk/notes/boom')).toMatchObject({ status: 500, body: { message: 'Internal error' } });
  });

  it('reads Internal error on GraphQL', async () => {
    const answer = await executeOn(app as never, { query: 'mutation { boom { id } }' });
    expect(JSON.stringify(answer)).not.toContain(SECRET);
    expect(answer.errors?.map((error) => [error.message, error.extensions?.code])).toEqual([['Internal error', 'INTERNAL_ERROR']]);
  });
});
