/**
 * `multiai acp`
 *
 * Verifies that the ACP sub-command is registered on the program and
 * that the action wires the harness into `@multiai/acp-adapter`'s
 * `runAcpServer` (the real server is stubbed so the test doesn't
 * actually take over stdio).
 */

import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@multiai/acp-adapter', () => ({
  ACP_BUILTIN_SLASH_COMMANDS: [],
  runAcpServer: vi.fn(async () => undefined),
}));

import { runAcpServer } from '@multiai/acp-adapter';

import { registerAcpCommand } from '#/cli/sub/acp';

class ExitCalled extends Error {
  constructor(public code: number | string | null | undefined) {
    super(`process.exit(${String(code)})`);
  }
}

describe('multiai acp', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.mocked(runAcpServer).mockClear();
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number | string | null) => {
      throw new ExitCalled(code);
    }) as never);
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    exitSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it('registers an `acp` subcommand on the program', () => {
    const program = new Command('multiai');
    registerAcpCommand(program);

    const acp = program.commands.find((c) => c.name() === 'acp');
    expect(acp).toBeDefined();
    expect(acp?.description()).toMatch(/Agent Client Protocol/);
  });

  it('invokes runAcpServer with a constructed harness and exits 0 on success', async () => {
    const program = new Command('multiai').exitOverride();
    registerAcpCommand(program);

    await expect(program.parseAsync(['node', 'multiai', 'acp'])).rejects.toThrow(ExitCalled);

    expect(runAcpServer).toHaveBeenCalledTimes(1);
    const harnessArg = vi.mocked(runAcpServer).mock.calls[0]?.[0];
    expect(harnessArg).toBeDefined();
    const optsArg = vi.mocked(runAcpServer).mock.calls[0]?.[1];
    expect(optsArg).toEqual(
      expect.objectContaining({
        agentInfo: { name: 'MultiAI CLI', version: expect.any(String) },
      }),
    );
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('forwards MULTIAI_HOME to terminalAuthEnv when set', async () => {
    const previous = process.env['MULTIAI_HOME'];
    process.env['MULTIAI_HOME'] = '/tmp/multiai-debug';
    try {
      const program = new Command('multiai').exitOverride();
      registerAcpCommand(program);

      await expect(program.parseAsync(['node', 'multiai', 'acp'])).rejects.toThrow(ExitCalled);

      const optsArg = vi.mocked(runAcpServer).mock.calls[0]?.[1];
      expect(optsArg).toEqual(
        expect.objectContaining({
          terminalAuthEnv: { MULTIAI_HOME: '/tmp/multiai-debug' },
        }),
      );
    } finally {
      if (previous === undefined) {
        delete process.env['MULTIAI_HOME'];
      } else {
        process.env['MULTIAI_HOME'] = previous;
      }
    }
  });

  it('omits terminalAuthEnv when MULTIAI_HOME is unset', async () => {
    const previous = process.env['MULTIAI_HOME'];
    delete process.env['MULTIAI_HOME'];
    try {
      const program = new Command('multiai').exitOverride();
      registerAcpCommand(program);

      await expect(program.parseAsync(['node', 'multiai', 'acp'])).rejects.toThrow(ExitCalled);

      const optsArg = vi.mocked(runAcpServer).mock.calls[0]?.[1] as {
        terminalAuthEnv?: unknown;
      };
      expect(optsArg.terminalAuthEnv).toBeUndefined();
    } finally {
      if (previous !== undefined) {
        process.env['MULTIAI_HOME'] = previous;
      }
    }
  });

  it('forwards process.argv[1] as terminalAuthLegacyCommand', async () => {
    const program = new Command('multiai').exitOverride();
    registerAcpCommand(program);

    await expect(program.parseAsync(['node', 'multiai', 'acp'])).rejects.toThrow(ExitCalled);

    const optsArg = vi.mocked(runAcpServer).mock.calls[0]?.[1] as {
      terminalAuthLegacyCommand?: string;
    };
    // process.argv[1] points at the test runner entry — non-empty
    // absolute-ish path, exactly what we want forwarded.
    expect(typeof optsArg.terminalAuthLegacyCommand).toBe('string');
    expect((optsArg.terminalAuthLegacyCommand ?? '').length).toBeGreaterThan(0);
    expect(optsArg.terminalAuthLegacyCommand).toBe(process.argv[1]);
  });

  it('exits without starting the ACP server when --login is passed', async () => {
    // Stub the harness module so runLoginFlow doesn't hit a real OAuth
    // endpoint: harness.auth.login resolves immediately and triggers exit 0.
    // `importOriginal` preserves the other named exports (`ErrorCodes`, etc.)
    // that constant/app.ts depends on at module load.
    const loginStub = vi.fn(async () => ({ providerName: 'managed:multiai' }));
    vi.doMock(import('@multiai/sdk'), async (importOriginal) => {
      const actual = await importOriginal();
      return {
        ...actual,
        createMultiAIHarness: () =>
          ({
            auth: { login: loginStub },
            close: async () => undefined,
          }) as unknown as ReturnType<typeof actual.createMultiAIHarness>,
      };
    });
    vi.resetModules();
    const { registerAcpCommand: freshRegister } = await import('#/cli/sub/acp');
    try {
      const program = new Command('multiai').exitOverride();
      freshRegister(program);

      await expect(program.parseAsync(['node', 'multiai', 'acp', '--login'])).rejects.toThrow(
        ExitCalled,
      );

      expect(loginStub).toHaveBeenCalledTimes(1);
      expect(runAcpServer).not.toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(0);
    } finally {
      vi.doUnmock('@multiai/sdk');
      vi.resetModules();
    }
  });
});
