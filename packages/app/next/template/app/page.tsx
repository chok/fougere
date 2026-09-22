import type { Page } from '@fougere/core';
import { invoke } from '@fougere/next';
// Replace with an entity your own frond declares.
import Post from '@fronds/blog/entities/Post';

/**
 * A server component reading a Frond directly — no fetch, no endpoint, no route.
 *
 * `invoke` names the call and the runner places it: in memory here, over JSON-RPC the day
 * `remotes:` names the frond in `fougere.config.ts`. A page that needs reactivity uses
 * `useQuery` from `@fougere/react` instead, with a facade from `@fronds/facade`.
 */
export default async function Home() {
  const { items: rows } = await invoke<Page<Post>>(Post, 'list');

  return (
    <main style={{ maxWidth: 720, margin: '3rem auto', fontFamily: 'system-ui' }}>
      <h1>Fougere</h1>
      {rows.map((row) => <pre key={row.id}>{JSON.stringify(row, null, 2)}</pre>)}
    </main>
  );
}
