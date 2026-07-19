import { describe, it, expect } from 'vitest';
import { translateCredential, translateSocial, translatePlugins } from '../src/translate.js';

describe('translateCredential', () => {
  it('disables when not declared', () => {
    expect(translateCredential(undefined)).toEqual({ enabled: false });
    expect(translateCredential({})).toEqual({ enabled: false });
  });

  it('enables and forwards options', () => {
    const out = translateCredential({ credential: { minPasswordLength: 8, autoSignIn: true } });
    expect(out).toEqual({ enabled: true, minPasswordLength: 8, maxPasswordLength: undefined, autoSignIn: true });
  });
});

describe('translateSocial', () => {
  it('returns empty when no providers', () => {
    expect(translateSocial(undefined)).toEqual({});
  });

  it('forwards only known social keys', () => {
    const out = translateSocial({
      credential: { minPasswordLength: 6 },
      google: { clientId: 'g-id', clientSecret: 'g-secret' },
      github: { clientId: 'gh-id', clientSecret: 'gh-secret' },
      oidc: { custom: { issuer: 'https://x', clientId: 'a', clientSecret: 'b' } },
    });
    expect(out).toEqual({
      google: { clientId: 'g-id', clientSecret: 'g-secret' },
      github: { clientId: 'gh-id', clientSecret: 'gh-secret' },
    });
  });
});

describe('translatePlugins', () => {
  it('returns empty array when no oidc', () => {
    expect(translatePlugins(undefined)).toEqual([]);
    expect(translatePlugins({ credential: {} })).toEqual([]);
  });

  it('builds genericOAuth with discovery URLs derived from issuer', () => {
    const plugins = translatePlugins({
      oidc: {
        'my-idp': {
          issuer: 'https://idp.example.com',
          clientId: 'app',
          clientSecret: 'secret',
        },
      },
    });
    expect(plugins).toHaveLength(1);
    expect(plugins[0].id).toBe('generic-oauth');
  });
});
