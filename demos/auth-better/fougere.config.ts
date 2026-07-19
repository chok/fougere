import { defineFougere } from '@fougere/core';
import { betterAuth } from '@fougere/auth-better';
import { User } from './src/entities.js';

export default defineFougere({
  db: 'sqlite',
  auth: betterAuth({
    user: User,
    secret: 'demo-secret-must-be-at-least-32-characters-long!',
    baseUrl: 'http://localhost:3000',
    basePath: '/auth',
    trustedOrigins: ['http://localhost:3000'],
    sessionTtl: 7 * 24 * 60 * 60 * 1000,
    providers: {
      credential: { minPasswordLength: 6, autoSignIn: true },
      // google: { clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! },
      // oidc: { 'my-idp': { issuer: 'http://localhost:9000', clientId: 'fougere-demo', clientSecret: 'demo-secret', scopes: ['openid', 'email', 'profile'] } },
    },
  }),
});
