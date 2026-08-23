import { invoke } from '@fougere/next';
import Post from '@fronds/blog/entities/Post';

/**
 * A server component reading a Frond directly — no fetch, no endpoint, no route.
 * `invoke` names the call (class + verb) and the runner places it: in memory here,
 * over JSON-RPC the day `remotes: { blog: … }` is uncommented in fougere.config.ts.
 * This page is the server dual of `useQuery(Post, 'list')`.
 */
export default async function PublishedPage() {
  const posts = await invoke<Post[]>(Post, 'list');

  return (
    <main>
      <h1>Published</h1>
      {posts.length === 0 && <p>Nothing published yet.</p>}
      {posts.map((post) => (
        <article key={post.id} style={{ borderBottom: '1px solid #f0f0f0', padding: '0.75rem 0' }}>
          <h2 style={{ fontSize: '1.05rem', margin: 0 }}>{post.title}</h2>
          <p style={{ margin: '0.25rem 0', color: '#555' }}>{post.body}</p>
          <small style={{ color: '#999' }}>{post.status}</small>
        </article>
      ))}
    </main>
  );
}
