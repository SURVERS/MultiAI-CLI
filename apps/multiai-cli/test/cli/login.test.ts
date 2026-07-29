/**
 * `multiai login`
 *
 * Verifies that the login sub-command is registered on the program and
 * that the action drives `harness.auth.login`, presents authorization details,
 * stderr, and exits with the right code on success / failure.
 */

import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockLogin = vi.fn();
const mockClose = vi.fn();

vi.mock('@multiai/sdk', async () => {
  const actual = await vi.importActual<typeof import('@multiai/sdk')>(
    '@multiai/sdk',
  );
  return {
    ...actual,
    createMultiAIHarness: vi.fn(() => ({
      auth: {
        login: mockLogin,
      },
      close: mockClose,
    })),
  };
});

vi.mock('#/utils/open-url', () => ({ openUrl: vi.fn() }));

import { createMultiAIHarness } from '@multiai/sdk';

import { registerLoginCommand } from '#/cli/sub/login';
import { openUrl } from '#/utils/open-url';

class ExitCalled extends Error {
  constructor(public code: number | string | null | undefined) {
    super(`process.exit(${String(code)})`);
  }
}

describe('multiai login', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockLogin.mockReset();
    mockClose.mockReset();
    mockClose.mockResolvedValue(undefined);
    vi.mocked(openUrl).mockReset();
    vi.mocked(createMultiAIHarness).mockClear();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number | string | null) => {
      throw new ExitCalled(code);
    }) as never);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    exitSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('registers a `login` subcommand on the program', () => {
    const program = new Command('multiai');
    registerLoginCommand(program);

    const login = program.commands.find((c) => c.name() === 'login');
    expect(login).toBeDefined();
    expect(login?.description()).toContain('MultiAI account');
  });

  it('invokes harness.auth.login and exits 0 on success', async () => {
    mockLogin.mockResolvedValue({ providerName: 'managed:multiai', ok: true });

    const program = new Command('multiai').exitOverride();
    registerLoginCommand(program);

    await expect(program.parseAsync(['node', 'multiai', 'login'])).rejects.toThrow(ExitCalled);

    expect(mockLogin).toHaveBeenCalledTimes(1);
    expect(mockLogin).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'browser',
        persistence: 'keyring',
        signal: expect.any(AbortSignal),
        onAuthorization: expect.any(Function),
      }),
    );
    expect(mockClose).toHaveBeenCalledOnce();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('prints a device-code prompt to stderr', async () => {
    mockLogin.mockImplementation(
      async (
        options: {
          onAuthorization?: (data: {
            method: 'device';
            userCode: string;
            verificationUriComplete: string;
            expiresIn: number | null;
          }) => void | Promise<void>;
        },
      ) => {
        await options.onAuthorization?.({
          method: 'device',
          userCode: 'ABCD-EFGH',
          verificationUriComplete: 'https://example.com/v?code=ABCD-EFGH',
          expiresIn: 600,
        });
        return { providerName: 'managed:multiai', ok: true };
      },
    );

    const program = new Command('multiai').exitOverride();
    registerLoginCommand(program);

    await expect(
      program.parseAsync(['node', 'multiai', 'login', '--device']),
    ).rejects.toThrow(ExitCalled);

    const writtenChunks = stderrSpy.mock.calls.map((call: unknown[]) => String(call[0]));
    expect(writtenChunks.some((chunk: string) => chunk.includes('ABCD-EFGH'))).toBe(true);
    expect(writtenChunks.some((chunk: string) => chunk.includes('https://example.com/v'))).toBe(
      true,
    );
    expect(openUrl).toHaveBeenCalledWith('https://example.com/v?code=ABCD-EFGH');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('still prints browser authorization when opening the browser fails', async () => {
    vi.mocked(openUrl).mockImplementation(() => {
      throw new Error('no browser');
    });
    mockLogin.mockImplementation(
      async (
        options: {
          onAuthorization?: (data: {
            method: 'browser';
            authorizationUri: string;
          }) => void | Promise<void>;
        },
      ) => {
        await options.onAuthorization?.({
          method: 'browser',
          authorizationUri: 'https://example.com/authorize',
        });
        return { providerName: 'managed:multiai', ok: true };
      },
    );

    const program = new Command('multiai').exitOverride();
    registerLoginCommand(program);

    await expect(program.parseAsync(['node', 'multiai', 'login'])).rejects.toThrow(ExitCalled);

    const writtenChunks = stderrSpy.mock.calls.map((call: unknown[]) => String(call[0]));
    expect(
      writtenChunks.some((chunk: string) => chunk.includes('https://example.com/authorize')),
    ).toBe(true);
    expect(openUrl).toHaveBeenCalledWith('https://example.com/authorize');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('exits 1 when auth.login throws', async () => {
    mockLogin.mockRejectedValue(new Error('boom'));

    const program = new Command('multiai').exitOverride();
    registerLoginCommand(program);

    await expect(program.parseAsync(['node', 'multiai', 'login'])).rejects.toThrow(ExitCalled);

    const writtenChunks = stderrSpy.mock.calls.map((call: unknown[]) => String(call[0]));
    expect(writtenChunks.some((chunk: string) => chunk.includes('boom'))).toBe(true);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
