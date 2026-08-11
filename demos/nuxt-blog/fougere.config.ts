import { defineFougere } from '@fougere/core';
import { betterAuth } from '@fougere/auth-better';
import User from './fronds/user/entities/User';

export default defineFougere({
  db: 'sqlite',
  // Ce que cette app publie. Absent = non servi : le module monte la porte, la
  // config décide si elle sert quelque chose.
  adapters: { rest: true, graphql: true },
  // La Frond blog vit dans un autre process (pnpm dev:blog). Commenter cette
  // ligne pour la ravoir in-process — le code ne change pas d'une virgule.
  remotes: { blog: 'http://127.0.0.1:4100' },
  auth: betterAuth({
    user: User,
    secret: 'nuxt-blog-demo-secret-at-least-32-characters!',
    baseUrl: process.env.AUTH_URL ?? 'http://localhost:3000',
    basePath: '/auth',
    trustedOrigins: ['http://localhost:3000', 'http://localhost:3001'],
    sessionTtl: 7 * 24 * 60 * 60 * 1000,
    providers: {
      credential: { minPasswordLength: 6, autoSignIn: true },
      // Uncomment + set client credentials to enable Google login:
      // google: { clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! },
    },
  }),
});
