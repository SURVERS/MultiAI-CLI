import { ErrorCodes, MultiAIError } from '@multiai/agent-core';
import {
  MultiAIOAuthError,
  MultiAIOAuthLoginRequiredError,
} from '@multiai/oauth';

/**
 * Classify an OAuth token-fetch failure into the public {@link MultiAIError}
 * protocol so callers (turn serialization, SDK clients, ACP) can react on
 * `code` rather than on class identity.
 *
 * Only errors we can positively identify are mapped:
 *  - `MultiAIOAuthLoginRequiredError` → `auth.login_required` (drive the user through
 *    `/login`).
 *  - transient MultiAI OAuth failures →
 *    `provider.connection_error` (transient; the user can retry).
 *
 * Anything else returns `undefined` so the caller rethrows it raw and lets it
 * surface as `internal` with the original message preserved. We deliberately do
 * **not** guess a category for unrecognized errors — masking e.g. a storage or
 * lock failure as `auth.login_required` would send the user down the wrong
 * remediation path.
 */
export function mapOAuthTokenError(error: unknown, providerName: string): MultiAIError | undefined {
  if (error instanceof MultiAIOAuthLoginRequiredError) {
    return new MultiAIError(
      ErrorCodes.AUTH_LOGIN_REQUIRED,
      `OAuth provider "${providerName}" requires login before it can be used.`,
      { cause: error },
    );
  }
  if (
    error instanceof MultiAIOAuthError &&
    ['metadata_unavailable', 'temporarily_unavailable', 'server_error'].includes(error.code)
  ) {
    return new MultiAIError(
      ErrorCodes.PROVIDER_CONNECTION_ERROR,
      `OAuth provider "${providerName}" failed to fetch an access token: ${error.message}`,
      { cause: error },
    );
  }
  return undefined;
}
