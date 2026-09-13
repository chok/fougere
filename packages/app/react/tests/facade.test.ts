/**
 * What a page may ask a facade for, read by the compiler rather than at the first call.
 *
 * The claims here come from the HANDLER's own type, not from the generated `.d.ts`: a page
 * names its facade once, and which operations exist — and what each answers — follows from the
 * class that serves them. That is what removes the row shapes pages write by hand: 13 of them
 * across this repo today, five incompatible versions of one Post among them.
 */
import { describe, it, expect } from 'vitest';
import { ErrorCode } from '@fougere/core/contract';
import { facade } from '@fougere/app/client';
import { useQuery, useCommand } from '../src/useFougereData.js';

interface PostHandler {
  list(): Promise<{ id: string; title: string }[]>;
  findById(): Promise<{ id: string; slug: string } | undefined>;
  publish(): Promise<{ id: string; slug: string }>;
  delete(): Promise<boolean>;
}

interface AuthorHandler {
  list(): Promise<{ id: string; name: string }[]>;
}

declare module '@fougere/core/contract' {
  interface FougereOperations {
    'post.list': { kind: 'query'; errors: never };
    'post.publish': { kind: 'command'; errors: ErrorCode.CONFLICT | ErrorCode.FORBIDDEN };
    'author.list': { kind: 'query'; errors: never };
  }
  interface FougereHandlers {
    post: PostHandler;
    author: AuthorHandler;
  }
}

const posts = facade('post');

/**
 * Never called — a hook outside a render has nothing to hold. What it holds is the compiler's
 * answer, which is the whole subject: `typecheck` reads this file, vitest erases it.
 */
export function pinned(): void {
  const one = useQuery(posts, 'findById');
  const rows = useQuery(posts, 'list');
  const publish = useCommand(posts, 'publish');
  const remove = useCommand(posts, 'delete');

  const slug: string | undefined = one.data?.slug;
  const first: { id: string; title: string } | undefined = rows.items[0];
  const published: Promise<{ id: string; slug: string }> = publish.execute();
  const gone: Promise<boolean> = remove.execute();

  void [slug, first, published, gone];

  // The refusals come from the generated keys, not from the class: TypeScript records
  // nothing about what a function throws, so only the scan's walk can say.
  const refused: ErrorCode.CONFLICT | ErrorCode.FORBIDDEN | undefined = publish.error?.code;
  void refused;

  // @ts-expect-error — `publsh` is not an operation of PostHandler.
  useQuery(posts, 'publsh');

  // @ts-expect-error — no facade of this app answers at 'ledger'.
  facade('ledger');

  // @ts-expect-error — an entity class is not a facade: a page names the handler that answers.
  useQuery(class Post {}, 'list');
}

describe('the facade a page names', () => {
  it('is a claim the compiler holds, not one a run can make', () => {
    expect(typeof pinned).toBe('function');
  });
});
