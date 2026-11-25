import '@fougere/adapter-rest';
import '@fougere/adapter-graphql';
import '@fougere/adapter-sql';
import { defineFougere } from '@fougere/core';
import { betterAuth } from '@fougere/auth-better';
import User from './fronds/user/entities/User.js';
import { log } from '@fougere/log';
import { calls } from '@fougere/calls';
import { observability } from '@fougere/observability';

export default defineFougere({
  sources: { main: { type: 'sqlite', path: 'fougere.db' } },
  // Ce que cette app publie. Absent = non servi : le module monte la porte, la
  // config décide si elle sert quelque chose.
  protocols: { rest: { openapi: {} }, graphql: {} },
  platform: [log()],
  fronds: {
    // A frond like any other: the process that runs it starts its engine.
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
  },
  // The blog frond runs in its own process (pnpm dev:blog). Remove these lines and the
  // whole app runs in one process again — the code does not change by a comma. Its process
  // carries a dev panel of its own on :4400, which shows every call this frond executes, the
  // ones that arrived over the wire included — the half a browser's devtools cannot show.
  processes: {
    blog: {
      url: 'http://127.0.0.1:4100',
      fronds: ['blog'],
      platform: [log(), observability({ service: 'blog-host' }), calls({ panel: 4400 })],
    },
  },
});
