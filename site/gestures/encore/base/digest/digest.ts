import { api } from 'encore.dev/api';
import { blog } from '~encore/clients';
import type { Post } from '../blog/posts';

export const latest = api({ expose: true, method: 'GET', path: '/digest/latest' }, async (): Promise<{ posts: Post[] }> => {
  const { posts } = await blog.list();

  return {
    posts: posts
      .filter((post) => post.publishedAt)
      .sort((a, b) => +new Date(b.publishedAt!) - +new Date(a.publishedAt!))
      .slice(0, 3),
  };
});
