import { createClient } from '@zenstackhq/fetch-client';
import type { Router } from 'express';
import { schema } from '../zenstack/schema.ts';

const blog = createClient(schema, { endpoint: `${process.env.BLOG_URL}/api/model` });

export function digest(router: Router) {
  router.get('/digest/latest', async (_request, response) => {
    const posts = await blog.post.findMany({ where: { publishedAt: { not: null } }, orderBy: { publishedAt: 'desc' }, take: 3 });
    response.json(posts);
  });
}
