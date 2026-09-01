import { createHash } from 'node:crypto';

import { MultiAISecureStorageUnavailableError } from './multiai-errors';
import type { PersistedOAuthSession } from './multiai-types';

export interface VersionedSession {
  readonly revision: number;
  readonly value: PersistedOAuthSession;
}

export interface SecureSessionStorage {
  load(key: string): Promise<VersionedSession | undefined>;
  compareAndSwap(
    key: string,
    expectedRevision: number | undefined,
    next: PersistedOAuthSession,
  ): Promise<boolean>;
  remove(key: string): Promise<void>;
}

function accountName(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

function parseSession(raw: string | null): VersionedSession | undefined {
  if (raw === null || raw.length === 0) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (value === null || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  if (
    record['schemaVersion'] !== 1 ||
    typeof record['revision'] !== 'number' ||
    typeof record['issuer'] !== 'string' ||
    typeof record['clientId'] !== 'string' ||
    typeof record['subject'] !== 'string' ||
    !Array.isArray(record['scopes']) ||
    typeof record['refreshToken'] !== 'string'
  ) {
    return undefined;
  }
  const session = record as unknown as PersistedOAuthSession;
  return { revision: session.revision, value: session };
}

type KeyringEntry = {
  getPassword(): string | null;
  setPassword(password: string): void;
  deletePassword(): boolean;
};

type KeyringEntryConstructor = new (service: string, account: string) => KeyringEntry;

let keyringEntryPromise: Promise<KeyringEntryConstructor> | undefined;

async function loadKeyringEntry(): Promise<KeyringEntryConstructor> {
  keyringEntryPromise ??= import('@napi-rs/keyring')
    .then(({ Entry }) => Entry as KeyringEntryConstructor)
    .catch((error: unknown) => {
      keyringEntryPromise = undefined;
      throw new MultiAISecureStorageUnavailableError(undefined, { cause: error });
    });
  return keyringEntryPromise;
}

export class KeyringSessionStorage implements SecureSessionStorage {
  constructor(private readonly service = 'MultiAI CLI OAuth') {}

  async load(key: string): Promise<VersionedSession | undefined> {
    try {
      const Entry = await loadKeyringEntry();
      return parseSession(new Entry(this.service, accountName(key)).getPassword());
    } catch (error) {
      throw new MultiAISecureStorageUnavailableError(undefined, { cause: error });
    }
  }

  async compareAndSwap(
    key: string,
    expectedRevision: number | undefined,
    next: PersistedOAuthSession,
  ): Promise<boolean> {
    try {
      const Entry = await loadKeyringEntry();
      const entry = new Entry(this.service, accountName(key));
      const current = parseSession(entry.getPassword());
      if (current?.revision !== expectedRevision) return false;
      entry.setPassword(JSON.stringify(next));
      return true;
    } catch (error) {
      throw new MultiAISecureStorageUnavailableError(undefined, { cause: error });
    }
  }

  async remove(key: string): Promise<void> {
    try {
      const Entry = await loadKeyringEntry();
      new Entry(this.service, accountName(key)).deletePassword();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/no entry|not found/i.test(message)) return;
      throw new MultiAISecureStorageUnavailableError(undefined, { cause: error });
    }
  }
}

export class MemorySessionStorage implements SecureSessionStorage {
  private readonly entries = new Map<string, PersistedOAuthSession>();

  async load(key: string): Promise<VersionedSession | undefined> {
    const value = this.entries.get(key);
    return value === undefined ? undefined : { revision: value.revision, value };
  }

  async compareAndSwap(
    key: string,
    expectedRevision: number | undefined,
    next: PersistedOAuthSession,
  ): Promise<boolean> {
    const current = this.entries.get(key);
    if (current?.revision !== expectedRevision) return false;
    this.entries.set(key, next);
    return true;
  }

  async remove(key: string): Promise<void> {
    this.entries.delete(key);
  }
}
