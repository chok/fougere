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
    expect(model.forHandler(comment).has('tally')).toBe(false);
    expect(model.diagnostics.find((one) => one.subject === 'CommentHandler.tally')?.code).toBe('operation-kind-unknown');
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

describe('the refusal of an op whose kind nothing tells', () => {
  const only = (handler: HandlerEntry): FrondDescriptor => ({ ...blog(undefined), handlers: [handler] });
  const refusalOf = (handler: HandlerEntry) => resolveEffectiveOperations([only(handler)]).diagnostics
    .find((one) => one.code.startsWith('operation-kind-'))!;

  it('hands over the three remedies, each with the line to write and where', () => {
    const { message } = refusalOf(post);

    expect(message).toContain("'tally' leads with no known verb.");
    expect(message).toContain('Rename it to lead with a known verb:');
    expect(message).toContain(`in /app/fronds/blog/frond.config.ts:\n    operations: { 'post.tally': { kind: 'query' } },   // or 'command'`);
    expect(message).toContain(`in /app/fronds/blog/vocabulary/verbs.ts:\n    Verbs.register('tally', 'query');`);
  });

  it('offers only the declaration when the name carries both kinds', () => {
    class MixHandler { async getOrCreate() { return 0; } }
    const mixed = { ...handlerOf(MixHandler, 'mix'), operations: new Map([['getOrCreate', { signature: { name: 'getOrCreate', params: [] }, binding: [] }]]) } as HandlerEntry;
    const { code, message } = refusalOf(mixed);

    expect(code).toBe('operation-kind-ambiguous');
    expect(message).toContain(`operations: { 'mix.getOrCreate': { kind: 'command' } },   // or 'query'`);
    expect(message).not.toContain('Rename');
    expect(message).not.toContain('Verbs.register');
  });

  it('is not raised once the verb is taught', () => {
    Verbs.register('tally', 'query');

    expect(resolveEffectiveOperations([only(post)]).forHandler(post).get('tally')?.kind).toBe('query');
  });
});
