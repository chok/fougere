'use client';

import { useCommand, useFormFor, useQuery } from '@fougere/react';
import { post } from '@fronds/facade';
import Post from '@fronds/__frond__/entities/Post';

export default function Posts() {
  const { items } = useQuery(post, 'list');
  const { values, setValue, errors, submit } = useFormFor(Post);
  const publish = useCommand(post, 'publish');

  return (
    <main>
      <h1>Posts</h1>
      <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <input value={String(values.title ?? '')} onChange={(event) => setValue('title', event.target.value)} placeholder="Title" />
        {errors.title && <small>{errors.title}</small>}
        <textarea value={String(values.body ?? '')} onChange={(event) => setValue('body', event.target.value)} placeholder="Body" />
        {errors.body && <small>{errors.body}</small>}
        <button>Create draft</button>
      </form>
      <ul>
        {items.map((row) => (
          <li key={row.id}>
            {row.title} — {row.status}{' '}
            {row.status === 'draft' && (
              <button onClick={() => void publish.execute({ params: { id: row.id } }).catch(() => {})}>Publish</button>
            )}
          </li>
        ))}
      </ul>
      {publish.error && <p>{publish.error.message}</p>}
    </main>
  );
}
