import { genericOAuth } from 'better-auth/plugins';
import type { BetterAuthOptions, BetterAuthPlugin } from 'better-auth';

/**
 * Fougere-side provider declaration. Mirrors what users write in fougere.config.ts.
 *
 * - `credential`: email + password (better-auth's emailAndPassword)
 * - Standard OAuth keys (google, github, ...): become socialProviders
 * - `oidc`: dictionary of OIDC providers, become genericOAuth plugin entries
 */
export interface FougereProviders {
  credential?: {
    minPasswordLength?: number;
    maxPasswordLength?: number;
    autoSignIn?: boolean;
  };
  google?: { clientId: string; clientSecret: string; scope?: string[] };
  github?: { clientId: string; clientSecret: string; scope?: string[] };
  facebook?: { clientId: string; clientSecret: string; scope?: string[] };
  apple?: { clientId: string; clientSecret: string; scope?: string[] };
  discord?: { clientId: string; clientSecret: string; scope?: string[] };
  microsoft?: { clientId: string; clientSecret: string; scope?: string[] };
  oidc?: Record<string, OIDCProviderConfig>;
}

export interface OIDCProviderConfig {
  /** Provider id used in the URL (e.g. /auth/oauth2/{id}/callback). Defaults to the dict key. */
  id?: string;
  /** OIDC issuer URL — used to derive the discovery URL. */
  issuer: string;
  clientId: string;
  clientSecret: string;
  scopes?: string[];
  /** Pass-through for better-auth's genericOAuth provider config. */
  redirectURI?: string;
  responseType?: string;
}

const SOCIAL_KEYS = new Set(['google', 'github', 'facebook', 'apple', 'discord', 'microsoft']);

export function translateCredential(providers?: FougereProviders): BetterAuthOptions['emailAndPassword'] {
  const cred = providers?.credential;
  if (!cred) return { enabled: false };
  return {
    enabled: true,
    minPasswordLength: cred.minPasswordLength,
    maxPasswordLength: cred.maxPasswordLength,
    autoSignIn: cred.autoSignIn,
  };
}

export function translateSocial(providers?: FougereProviders): BetterAuthOptions['socialProviders'] {
  if (!providers) return {};
  const social: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(providers)) {
    if (SOCIAL_KEYS.has(key)) social[key] = value;
  }
  return social as BetterAuthOptions['socialProviders'];
}

/**
 * Build the plugin list from Fougere provider config.
 * Currently produces:
 * - `genericOAuth` plugin when `providers.oidc` is set (one entry per declared OIDC provider).
 */
export function translatePlugins(providers?: FougereProviders): BetterAuthPlugin[] {
  const plugins: BetterAuthPlugin[] = [];
  if (providers?.oidc) {
    const config = Object.entries(providers.oidc).map(([key, oidc]) => ({
      providerId: oidc.id ?? key,
      discoveryUrl: oidc.issuer.replace(/\/$/, '') + '/.well-known/openid-configuration',
      clientId: oidc.clientId,
      clientSecret: oidc.clientSecret,
      scopes: oidc.scopes ?? ['openid', 'email', 'profile'],
      redirectURI: oidc.redirectURI,
      responseType: oidc.responseType,
    }));
    plugins.push(genericOAuth({ config }));
  }
  return plugins;
}
