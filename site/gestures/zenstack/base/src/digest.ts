import type { Router } from 'express';
import { db } from './db.ts';

export function digest(router: Router) {
  router.get('/digest/latest', async (_request, response) => {
    const posts = await db.post.findMany({ where: { publishedAt: { not: null } }, orderBy: { publishedAt: 'desc' }, take: 3 });
    response.json(posts);
  });
}
