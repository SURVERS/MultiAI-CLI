import type { MultiAIOAuthConfig } from './multiai-types';
import { MULTIAI_OAUTH_SCOPES } from './multiai-types';

export const MULTIAI_PROVIDER_NAME = 'managed:multiai';
export const MULTIAI_OAUTH_KEY = 'oauth/multiai';
export const MULTIAI_OAUTH_ISSUER = 'https://multiai.store';
export const MULTIAI_API_BASE_URL = 'https://multiai.store/v1';
export const MULTIAI_CALLBACK_PATH = '/oauth/callback';
export const MULTIAI_REGISTERED_REDIRECT_URI = 'http://127.0.0.1:1/oauth/callback';

// OAuth native client IDs are public. The production value is intentionally
// left empty until the owner creates the application in multiai.store.
export const BUILTIN_MULTIAI_OAUTH_CLIENT_ID = '';

export function resolveMultiAIOAuthConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): MultiAIOAuthConfig {
  return {
    issuer: env['MULTIAI_OAUTH_ISSUER'] ?? MULTIAI_OAUTH_ISSUER,
    clientId: env['MULTIAI_OAUTH_CLIENT_ID'] ?? BUILTIN_MULTIAI_OAUTH_CLIENT_ID,
    scopes: MULTIAI_OAUTH_SCOPES,
    callbackPath: MULTIAI_CALLBACK_PATH,
  };
}
