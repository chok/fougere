/**
 * `operations:` names an op the way every other place does — `post.tally`. A bare `tally` used to
 * reach every handler of the frond that had one.
 */
import { describe, expect, it } from 'vitest';
import { Format } from '@fougere/schema';
import { Protocols, Verbs, resolveEffectiveOperations, type FrondDescriptor, type HandlerEntry } from '../src/index.js';

Protocols.register('rest', { format: Format.of('protocol/rest').closed() });

declare module '../src/index.js' {
  interface FougereOperationProtocols {
    rest?: { path?: string };
  }
}

class PostHandler { async tally() { return 0; } }
class CommentHandler { async tally() { return 0; } }

const handlerOf = (ctor: new () => unknown, address: string): HandlerEntry => ({
  name: `${address}Handler`,
  address,
  ctor,
  operations: new Map([['tally', { signature: { name: 'tally', params: [] }, binding: [] }]]),
  deps: [],
  filePath: `/app/fronds/blog/handlers/${ctor.name}.ts`,
  exposed: true,
}) as HandlerEntry;

const post = handlerOf(PostHandler, 'post');
const comment = handlerOf(CommentHandler, 'comment');

const blog = (operationsOverrides: FrondDescriptor['operationsOverrides']): FrondDescriptor => ({
  name: 'blog',
  source: { path: '/app/fronds/blog', package: '@fronds/blog' },
  providers: [], entities: [], handlers: [post, comment], presenters: [], collectors: [], seeds: [], middlewares: [],
  operationsOverrides,
});

const codesOf = (fronds: FrondDescriptor[]) => resolveEffectiveOperations(fronds).diagnostics.map((one) => one.code);

describe('an override names one op of one address', () => {
  it('reaches the address it names, and leaves the other handler of the same op name alone', () => {
    const model = resolveEffectiveOperations([blog({ 'post.tally': { kind: 'query', rest: { path: '/tally' } } })]);

    expect(model.forHandler(post).get('tally')).toMatchObject({ kind: 'query', protocols: { rest: { path: '/tally' } } });
    expect(model.forHandler(comment).get('tally')?.kind).toBe('command');
  });

  it('refuses a bare op name, and says the keys it could have been', () => {
    const [refused] = resolveEffectiveOperations([blog({ tally: { kind: 'query' } })]).diagnostics
      .filter((one) => one.code === 'operation-override-unaddressed');

    expect(refused).toMatchObject({ severity: 'blocking', subject: 'tally', filePath: '/app/fronds/blog/frond.config.ts' });
    expect(refused!.message).toContain("'post.tally' or 'comment.tally'");
  });

  it('refuses an address the frond does not serve, naming what it serves', () => {
    const [refused] = resolveEffectiveOperations([blog({ 'page.tally': { kind: 'query' } })]).diagnostics
      .filter((one) => one.code === 'operation-override-unaddressed');

    expect(refused!.message).toContain("'page'");
    expect(refused!.message).toContain('It serves post, comment.');
  });

  it('carries nothing for a protocol this process does not serve', () => {
    const model = resolveEffectiveOperations([blog({ 'post.tally': { kind: 'query', graphql: 'tallies' } as never })]);

    expect(model.forHandler(post).get('tally')?.protocols).toEqual({});
    expect(codesOf([blog({ 'post.tally': { kind: 'query' }, 'comment.tally': { kind: 'query' } })])).toEqual([]);
  });
});

describe('the kind an op whose name says nothing gets', () => {
  const only = (handler: HandlerEntry): FrondDescriptor => ({ ...blog(undefined), handlers: [handler] });
  const kindOf = (handler: HandlerEntry, name: string) => resolveEffectiveOperations([only(handler)]).forHandler(handler).get(name)?.kind;

  it('is a command, and no refusal is raised', () => {
    expect(kindOf(post, 'tally')).toBe('command');
    expect(resolveEffectiveOperations([only(post)]).diagnostics).toEqual([]);
  });

  it('is a command when the name also carries a write', () => {
    class MixHandler { async getOrCreate() { return 0; } }
    const mixed = { ...handlerOf(MixHandler, 'mix'), operations: new Map([['getOrCreate', { signature: { name: 'getOrCreate', params: [] }, binding: [] }]]) } as HandlerEntry;

    expect(kindOf(mixed, 'getOrCreate')).toBe('command');
  });

  it('is a query once the verb is taught', () => {
    Verbs.register('tally', 'query');

    expect(kindOf(post, 'tally')).toBe('query');
  });
});

describe('a declared binding', () => {
  class InviteHandler { async inviteUser() { return 0; } }
  const invite = {
    ...handlerOf(InviteHandler, 'invite'),
    operations: new Map([['inviteUser', { signature: { name: 'inviteUser', params: [
      { name: 'user', type: { raw: 'User', name: 'User' } },
      { name: 'role', type: { raw: 'string', name: 'string' } },
    ] } }]]),
  } as HandlerEntry;
  const declaring = (binding: unknown): FrondDescriptor =>
    ({ ...blog({ 'invite.inviteUser': { binding } as never }), handlers: [invite] });

  it('states the exception alone, and the other parameters keep what Fougere derives', () => {
    const model = resolveEffectiveOperations([declaring([{ name: 'user', source: { kind: 'input' } }])]);

    expect(model.diagnostics).toEqual([]);
    expect(model.forHandler(invite).get('inviteUser')?.binding.map((one) => [one.name, one.source.kind]))
      .toEqual([['user', 'input'], ['role', 'param']]);
  });

  it('refuses a name that is no parameter', () => {
    expect(codesOf([declaring([{ name: 'usr', source: { kind: 'input' } }])])).toContain('operation-binding-invalid');
  });
});
