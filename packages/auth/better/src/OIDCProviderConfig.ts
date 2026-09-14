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
