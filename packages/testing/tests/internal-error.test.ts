/**
 * An error nobody wrote for a caller never leaves, whichever door the caller came in by — the rule
 * `toPublicError` states, which GraphQL did not apply: the message below reached the client whole.
 */
import '@fougere/adapter-graphql';
import { describe, expect, it } from 'vitest';
import { executeOn } from '@fougere/adapter-graphql';
import { configureFougere, serveRest, serveRpc, useFougereApp } from '@fougere/app';
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
    const answer = await serveRpc(app, { path: '/_fougere/call', body: { jsonrpc: '2.0', id: 1, method: 'note.boom', params: {} }, state: {} });
    expect(JSON.stringify(answer)).not.toContain(SECRET);
    expect(answer).toMatchObject({ error: { message: 'Internal error' } });
  });

  it('reads Internal error on REST', async () => {
    const answer = await serveRest(app, { method: 'POST', path: '/api/desk/notes/boom', query: {}, state: {} });
    expect(answer).toMatchObject({ kind: 'error', status: 500, body: { message: 'Internal error' } });
  });

  it('reads Internal error on GraphQL', async () => {
    const answer = await executeOn(app as never, { query: 'mutation { boom { id } }' });
    expect(JSON.stringify(answer)).not.toContain(SECRET);
    expect(answer.errors?.map((error) => [error.message, error.extensions?.code])).toEqual([['Internal error', 'INTERNAL_ERROR']]);
  });
});
