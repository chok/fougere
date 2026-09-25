import { api, APIError } from 'encore.dev/api';
import type { MaxLen, MinLen } from 'encore.dev/validate';
import { randomUUID } from 'node:crypto';
import { db } from './db';

export interface Post {
  id: string;
  title: string;
  body: string;
  createdAt: Date;
  publishedAt: Date | null;
}

interface CreatePost {
  title: string & MinLen<1> & MaxLen<200>;
  body: string;
}

const columns = 'id, title, body, created_at AS "createdAt", published_at AS "publishedAt"';

export const create = api({ expose: true, method: 'POST', path: '/posts' }, async (input: CreatePost): Promise<Post> => {
  return (await db.rawQueryRow<Post>(
    `INSERT INTO posts (id, title, body) VALUES ($1, $2, $3) RETURNING ${columns}`,
    randomUUID(), input.title, input.body,
  ))!;
});

export const list = api({ expose: true, method: 'GET', path: '/posts' }, async (): Promise<{ posts: Post[] }> => {
  const posts: Post[] = [];
  for await (const post of db.rawQuery<Post>(`SELECT ${columns} FROM posts`)) posts.push(post);

  return { posts };
});

export const publish = api({ expose: true, method: 'POST', path: '/posts/:id/publish' }, async ({ id }: { id: string }): Promise<Post> => {
  const post = await db.rawQueryRow<Post>(`SELECT ${columns} FROM posts WHERE id = $1`, id);
  if (!post) throw APIError.notFound(`Post '${id}' not found`);
  if (post.publishedAt) throw APIError.failedPrecondition('Already published');

  return (await db.rawQueryRow<Post>(`UPDATE posts SET published_at = now() WHERE id = $1 RETURNING ${columns}`, id))!;
});
