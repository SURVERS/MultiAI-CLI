/**
 * Unexpected-error reporting hook (`onUnexpectedError`) used by the Emitter to
 * surface exceptions thrown by listener callbacks.
 */

export type UnexpectedErrorHandler = (err: unknown) => void;

const defaultHandler: UnexpectedErrorHandler = (err) => {
  // eslint-disable-next-line no-console
  console.error('[unexpected]', err);
};

let currentHandler: UnexpectedErrorHandler = defaultHandler;

export function setUnexpectedErrorHandler(handler: UnexpectedErrorHandler): void {
  currentHandler = handler;
}

export function resetUnexpectedErrorHandler(): void {
  currentHandler = defaultHandler;
}

export function onUnexpectedError(err: unknown): void {
  try {
    currentHandler(err);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[unexpected] handler threw', error, 'while reporting', err);
  }
}

export function safelyCallListener(listener: () => void): void {
  try {
    listener();
  } catch (error) {
    onUnexpectedError(error);
  }
}
