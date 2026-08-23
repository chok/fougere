import { useQuery, useCommand } from '@fougere/react';
import Post from '../../fronds/blog/entities/Post';

/**
 * The couple, unchanged from the Next and TanStack demos — same import, same
 * designation. `@fougere/react` does not know which of the three renders it.
 */
export default function Drafts() {
  const { items, loading, error, refresh } = useQuery<Post>(Post, 'listDrafts');
  const publish = useCommand(Post, 'publish');

  return (
    <main>
      <h1>Drafts</h1>
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: '#b00' }}>{error.message}</p>}
      {!loading && items.length === 0 && <p>No drafts left — everything is published.</p>}
      {items.map((post) => (
        <article key={post.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid #f0f0f0', padding: '0.75rem 0' }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '1.05rem', margin: 0 }}>{post.title}</h2>
            <small style={{ color: '#999' }}>{post.status}</small>
          </div>
          <button type="button" disabled={publish.loading} onClick={() => publish.execute({ params: { id: post.id } })}>
            Publish
          </button>
        </article>
      ))}
      {publish.error && <p style={{ color: '#b00' }}>{publish.error.message}</p>}
      <button type="button" onClick={() => void refresh()} style={{ marginTop: '1rem' }}>Refresh</button>
    </main>
  );
}
