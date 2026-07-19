import { defineFougere } from '@fougere/core';
import { betterAuth } from '@fougere/auth-better';
import User from './fronds/user/entities/User';

export default defineFougere({
  // File-backed on purpose: posts and accounts must survive reloads and deploys.
  // Lives under .data/ — the writable-state dir (Nuxt Content uses it too),
  // which is also the single volume to mount when deploying.
  db: { dialect: 'sqlite', path: '.data/site.db' },
  auth: betterAuth({
    user: User,
    secret: process.env.SITE_AUTH_SECRET ?? 'fougere-site-dev-secret-at-least-32-characters!',
    baseUrl: process.env.SITE_URL ?? 'http://localhost:3000',
    basePath: '/auth',
    trustedOrigins: [process.env.SITE_URL ?? 'http://localhost:3000'],
    sessionTtl: 30 * 24 * 60 * 60 * 1000,
    providers: {
      credential: { minPasswordLength: 8, autoSignIn: true },
    },
  }),
});
