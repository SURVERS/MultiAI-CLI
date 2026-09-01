export class MultiAIOAuthError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(code: string, message: string, options?: { readonly status?: number; readonly cause?: unknown }) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'MultiAIOAuthError';
    this.code = code;
    this.status = options?.status;
  }
}

export class MultiAIOAuthLoginRequiredError extends MultiAIOAuthError {
  constructor(message = 'MultiAI login is required.', options?: { readonly cause?: unknown }) {
    super('login_required', message, options);
    this.name = 'MultiAIOAuthLoginRequiredError';
  }
}

export class MultiAISecureStorageUnavailableError extends MultiAIOAuthError {
  constructor(message = 'The operating-system credential store is unavailable.', options?: { readonly cause?: unknown }) {
    super('secure_storage_unavailable', message, options);
    this.name = 'MultiAISecureStorageUnavailableError';
  }
}

export class MultiAIOAuthInsufficientScopeError extends MultiAIOAuthError {
  readonly requiredScope?: string;

  constructor(
    message = 'The MultiAI OAuth application does not have the required scope.',
    requiredScope?: string,
  ) {
    super('insufficient_scope', message, { status: 403 });
    this.name = 'MultiAIOAuthInsufficientScopeError';
    this.requiredScope = requiredScope;
  }
}

export class MultiAIAccountUnavailableError extends MultiAIOAuthError {
  constructor(message = 'The MultiAI account is unavailable.') {
    super('account_unavailable', message, { status: 403 });
    this.name = 'MultiAIAccountUnavailableError';
  }
}

export class MultiAIInsufficientQuotaError extends MultiAIOAuthError {
  readonly topUpUrl: string;

  constructor(
    message = 'The MultiAI balance is insufficient.',
    topUpUrl = 'https://multiai.store/account',
  ) {
    super('insufficient_quota', message, { status: 402 });
    this.name = 'MultiAIInsufficientQuotaError';
    this.topUpUrl = topUpUrl;
  }
}

export class MultiAIRateLimitError extends MultiAIOAuthError {
  readonly retryAfterSeconds?: number;

  constructor(message = 'MultiAI rate limit exceeded.', retryAfterSeconds?: number) {
    super('rate_limited', message, { status: 429 });
    this.name = 'MultiAIRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
