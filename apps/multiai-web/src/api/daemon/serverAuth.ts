// apps/multiai-web/src/api/daemon/serverAuth.ts
// Minimal server-transport credential store for the Web UI.
//
// The local server now requires a bearer credential on every non-bypass API
// and WebSocket call (the persistent server token, or the MULTIAI_PASSWORD
// password). The Web UI obtains that credential in one of two ways:
//   1. From the URL fragment (`#token=<...>`) that `multiai web` appends when it
//      opens the browser — read once at boot, then scrubbed from the URL so it
//      does not linger in history or screenshots.
//   2. From a token the user types into the ServerAuthDialog modal.
//
// The credential is held in memory and mirrored to **sessionStorage** — a
// tab-scoped store that never lands in the browser profile on disk and is
// cleared when the tab closes. This deliberately downgrades the earlier
// localStorage mirror (7-day TTL): a security review flagged the persistent
// profile-stored bearer credential as the main exposure. Re-entry after a
// browser restart is the accepted tradeoff; `multiai web` re-launch appends
// a fresh fragment token, so the normal flow does not require typing.
// `multiai web rotate-token` invalidates a stale copy, and the next 401
// clears it here.

const STORAGE_KEY = 'multiai-web.server-credential';
const FRAGMENT_PARAM = 'token';
/** Session-scoped mirror TTL: bounded, well under a browser-session length. */
const CREDENTIAL_TTL_MS = 12 * 60 * 60 * 1000;

interface StoredCredential {
  version: 2;
  credential: string;
  expiresAt: number;
}

let memory: StoredCredential | undefined;

type AuthRequiredListener = () => void;
const listeners = new Set<AuthRequiredListener>();

function readFragmentToken(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const hash = window.location.hash ?? '';
  if (!hash.startsWith('#')) return undefined;
  const params = new URLSearchParams(hash.slice(1));
  const token = params.get(FRAGMENT_PARAM);
  if (!token) return undefined;
  // Scrub the fragment (keep path + query) so the token is not left in the
  // address bar, browser history, or any screenshot of the window.
  const url = new URL(window.location.href);
  url.hash = '';
  window.history.replaceState(
    window.history.state,
    '',
    `${url.pathname}${url.search}`,
  );
  return token;
}

function createStoredCredential(credential: string): StoredCredential {
  return {
    version: 2,
    credential,
    expiresAt: Date.now() + CREDENTIAL_TTL_MS,
  };
}

function encodeStoredCredential(stored: StoredCredential): string {
  return JSON.stringify(stored);
}

function decodeStoredCredential(raw: string): StoredCredential | undefined {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return undefined;
    const record = parsed as Record<string, unknown>;
    if (
      record['version'] !== 2 ||
      typeof record['credential'] !== 'string' ||
      record['credential'].length === 0 ||
      typeof record['expiresAt'] !== 'number' ||
      !Number.isFinite(record['expiresAt'])
    ) {
      return undefined;
    }
    return {
      version: 2,
      credential: record['credential'],
      expiresAt: record['expiresAt'],
    };
  } catch {
    return undefined;
  }
}

function persistCredential(stored: StoredCredential): void {
  // sessionStorage only: tab-scoped, never persisted to the browser profile.
  globalThis.sessionStorage?.setItem(
    STORAGE_KEY,
    encodeStoredCredential(stored),
  );
}

function loadStored(): StoredCredential | undefined {
  try {
    const raw = globalThis.sessionStorage?.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const stored = decodeStoredCredential(raw);
    if (stored === undefined) {
      // Unparseable or legacy (v1) value — drop it rather than adopt it, so
      // nothing written by the old localStorage-era code survives.
      globalThis.sessionStorage?.removeItem(STORAGE_KEY);
      return undefined;
    }
    if (stored.expiresAt > Date.now()) return stored;
    globalThis.sessionStorage?.removeItem(STORAGE_KEY);
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Initialize the credential store. Call once at app boot (before the first
 * API/WS call). Prefers a fragment token over a stored one. Returns true if a
 * credential is available afterwards (so the caller can skip the modal).
 */
export function initServerAuth(): boolean {
  const fragment = readFragmentToken();
  if (fragment) {
    setCredential(fragment);
    return true;
  }
  memory = loadStored();
  return memory !== undefined;
}

/** Current unexpired credential, or undefined if none is available. */
export function getCredential(): string | undefined {
  if (memory === undefined) return undefined;
  if (memory.expiresAt <= Date.now()) {
    clearExpiredCredential(memory);
    return undefined;
  }
  return memory.credential;
}

function clearExpiredCredential(expired: StoredCredential): void {
  memory = undefined;
  try {
    const raw = globalThis.sessionStorage?.getItem(STORAGE_KEY);
    const stored = raw === null || raw === undefined
      ? undefined
      : decodeStoredCredential(raw);
    const matchesExpired = stored !== undefined &&
      stored.credential === expired.credential &&
      stored.expiresAt === expired.expiresAt;
    if (matchesExpired || raw === expired.credential) {
      globalThis.sessionStorage?.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

/** Store a credential in memory and in the tab-scoped sessionStorage mirror. */
export function setCredential(value: string): void {
  const stored = createStoredCredential(value);
  memory = stored;
  try {
    persistCredential(stored);
  } catch {
    // Storage may be unavailable (private mode) — memory still works.
  }
}

/** Drop the credential (memory + sessionStorage). */
export function clearCredential(): void {
  memory = undefined;
  try {
    // sessionStorage is tab-scoped: this tab's mirror cannot hold another
    // tab's rotated token, so an unconditional removal is always safe.
    globalThis.sessionStorage?.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Register a listener invoked when the server rejects our credential (HTTP 401
 * / envelope code 40101). Returns an unsubscribe function.
 */
export function onAuthRequired(listener: AuthRequiredListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Called by the HTTP/WS transport when the server rejects the current
 * credential. Clears it and notifies listeners (the App shows the modal).
 */
export function markAuthRequired(): void {
  clearCredential();
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // a failing listener must not break transport handling
    }
  }
}
