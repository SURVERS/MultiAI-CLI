import type { MultiAIErrorCode } from './codes';

export interface MultiAIErrorOptions {
  /** JSON-serializable structured details. */
  readonly details?: Record<string, unknown>;
  /** Original error or value. Local-only; never serialized to the wire. */
  readonly cause?: unknown;
}

/**
 * The single MultiAI error class.
 *
 * Discrimination is always by `code`. Cross-process consumers receive
 * `MultiAIErrorPayload` and must branch on `code` rather than class identity.
 */
export class MultiAIError extends Error {
  readonly code: MultiAIErrorCode;
  readonly details?: Record<string, unknown>;
  override readonly cause?: unknown;

  constructor(code: MultiAIErrorCode, message: string, options: MultiAIErrorOptions = {}) {
    super(message);
    this.name = 'MultiAIError';
    this.code = code;
    this.details = options.details;
    this.cause = options.cause;
  }
}
