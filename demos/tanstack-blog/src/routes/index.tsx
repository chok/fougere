import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@fougere/react';
import Post from '@fronds/blog/entities/Post';

/**
 * The published list. Same hook, same designation, same import as
 * `demos/next-blog/app/drafts/page.tsx` — `@fougere/react` knows nothing about
 * which host renders it.
 */
export const Route = createFileRoute('/')({ component: Published });

function Published() {
  const { items, loading, error } = useQuery<Post>(Post, 'list');

  return (
    <main>
      <h1>Published</h1>
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: '#b00' }}>{error.message}</p>}
      {!loading && items.length === 0 && <p>Nothing published yet.</p>}
      {items.map((post) => (
        <article key={post.id} style={{ borderBottom: '1px solid #f0f0f0', padding: '0.75rem 0' }}>
          <h2 style={{ fontSize: '1.05rem', margin: 0 }}>{post.title}</h2>
          <p style={{ margin: '0.25rem 0', color: '#555' }}>{post.body}</p>
          <small style={{ color: '#999' }}>{post.status}</small>
        </article>
      ))}
    </main>
  );
}
