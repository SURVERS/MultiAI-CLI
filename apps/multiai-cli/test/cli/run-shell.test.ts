/**
 * Interactive CLI contracts: engine selection, harness/TUI construction,
 * startup input, lifecycle cleanup, and managed MultiAI OAuth callbacks.
 */

import { execSync } from 'node:child_process';

import type { createMultiAIDeviceId as createMultiAIDeviceIdFn } from '@multiai/oauth';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { runShell } from '#/cli/run-shell';

import { captureProcessWrite, ExitCalled, mockProcessExit } from '../helpers/process';

type CreateMultiAIDeviceId = typeof createMultiAIDeviceIdFn;

const mocks = vi.hoisted(() => {
  type TuiConfigFallback = {
    theme: 'dark' | 'light' | 'auto';
    editorCommand: string | null;
    notifications: { enabled: boolean; condition: 'unfocused' | 'always' };
  };

  class TuiConfigParseError extends Error {
    readonly fallback: TuiConfigFallback;

    constructor(fallback: TuiConfigFallback) {
      super('Invalid TUI config in ~/.multiai/tui.toml; using defaults.');
      this.fallback = fallback;
    }
  }

  const lifecycleTrack = vi.fn();

  return {
    loadTuiConfig: vi.fn(),
    detectTerminalTheme: vi.fn(),
    multiAIHarnessConstructor: vi.fn(),
    multiAIHarnessV2Constructor: vi.fn(),
    harnessEnsureConfigFile: vi.fn(),
    harnessGetConfig: vi.fn(async () => ({
      providers: {},
      defaultModel: 'k2',
      telemetry: true,
    })),
    harnessGetConfigDiagnostics: vi.fn(async () => ({ warnings: [] as readonly string[] })),
    harnessGetCachedAccessToken: vi.fn(),
    harnessClose: vi.fn(),
    harnessTrack: vi.fn(),
    multiAITuiConstructor: vi.fn(),
    tuiStart: vi.fn(),
    tuiGetStartupMcpMs: vi.fn(async () => 0),
    tuiGetCurrentSessionId: vi.fn(() => ''),
    tuiHasSessionContent: vi.fn(() => false),
    createMultiAIDeviceId: vi.fn<CreateMultiAIDeviceId>(() => 'device-1'),
    initializeTelemetry: vi.fn(),
    setCrashPhase: vi.fn(),
    shutdownTelemetry: vi.fn(),
    telemetryTrack: vi.fn(),
    setTelemetryContext: vi.fn(),
    lifecycleTrack,
    withTelemetryContext: vi.fn(() => ({
      track: lifecycleTrack,
    })),
    resolveMultiAIHome: vi.fn((homeDir?: string) => homeDir ?? '/tmp/multiai-test-home'),
    flushDiagnosticLogsSync: vi.fn(),
    harnessCreatesDeviceIdOnConstruction: false,
    execSync: vi.fn(),
    TuiConfigParseError,
  };
});

vi.mock('@multiai/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@multiai/sdk')>();
  const makeHarnessStub = (args: unknown[]) => {
    const options = args[0] as { readonly homeDir?: string } | undefined;
    const homeDir = options?.homeDir ?? '/tmp/multiai-test-home';
    return {
      homeDir,
      auth: {
        getCachedAccessToken: mocks.harnessGetCachedAccessToken,
      },
      ensureConfigFile: mocks.harnessEnsureConfigFile,
      getConfig: mocks.harnessGetConfig,
      getConfigDiagnostics: mocks.harnessGetConfigDiagnostics,
      close: mocks.harnessClose,
      track: mocks.harnessTrack,
    };
  };
  return {
    ...actual,
    resolveMultiAIHome: mocks.resolveMultiAIHome,
    flushDiagnosticLogsSync: mocks.flushDiagnosticLogsSync,
    createMultiAIHarness: (...args: unknown[]) => {
      const options = args[0] as { readonly homeDir?: string } | undefined;
      const homeDir = options?.homeDir ?? '/tmp/multiai-test-home';
      if (mocks.harnessCreatesDeviceIdOnConstruction) {
        mocks.createMultiAIDeviceId(homeDir);
      }
      mocks.multiAIHarnessConstructor(...args);
      return makeHarnessStub(args);
    },
    createMultiAIHarnessV2: (...args: unknown[]) => {
      mocks.multiAIHarnessV2Constructor(...args);
      return makeHarnessStub(args);
    },
  };
});

vi.mock('@multiai/oauth', async () => {
  const actual = await vi.importActual<typeof import('@multiai/oauth')>(
    '@multiai/oauth',
  );
  return {
    ...actual,
    createMultiAIDeviceId: mocks.createMultiAIDeviceId,
    MULTIAI_PROVIDER_NAME: 'kimi-code',
  };
});

vi.mock('@multiai/telemetry', () => ({
  disableTelemetry: vi.fn(),
  initializeTelemetry: mocks.initializeTelemetry,
  setCrashPhase: mocks.setCrashPhase,
  shutdownTelemetry: mocks.shutdownTelemetry,
  track: mocks.telemetryTrack,
  setTelemetryContext: mocks.setTelemetryContext,
  withTelemetryContext: mocks.withTelemetryContext,
}));

vi.mock('../../src/tui/config', () => ({
  loadTuiConfig: mocks.loadTuiConfig,
  TuiConfigParseError: mocks.TuiConfigParseError,
}));

vi.mock('../../src/tui/index', () => ({
  MultiAITUI: class {
    onExit?: () => Promise<void>;

    constructor(...args: unknown[]) {
      mocks.multiAITuiConstructor(this, ...args);
    }

    start = mocks.tuiStart;
    getStartupMcpMs = mocks.tuiGetStartupMcpMs;
    getCurrentSessionId = mocks.tuiGetCurrentSessionId;
    hasSessionContent = mocks.tuiHasSessionContent;
  },
}));

vi.mock('../../src/tui/theme/detect', () => ({
  detectTerminalTheme: mocks.detectTerminalTheme,
}));


vi.mock('node:child_process', () => ({
  execSync: mocks.execSync,
}));

describe('runShell', () => {
  afterEach(() => {
    vi.clearAllMocks();
    mocks.harnessGetConfig.mockResolvedValue({
      providers: {},
      defaultModel: 'k2',
      telemetry: true,
    });
    mocks.tuiGetStartupMcpMs.mockResolvedValue(0);
    mocks.tuiGetCurrentSessionId.mockReturnValue('');
    mocks.tuiHasSessionContent.mockReturnValue(false);
    mocks.createMultiAIDeviceId.mockImplementation(() => 'device-1');
    mocks.resolveMultiAIHome.mockImplementation(
      (homeDir?: string) => homeDir ?? '/tmp/multiai-test-home',
    );
    mocks.harnessCreatesDeviceIdOnConstruction = false;
  });

  const minimalCliOptions = {
    session: undefined,
    continue: false,
    yolo: false,
    auto: false,
    plan: false,
    model: undefined,
    outputFormat: undefined,
    prompt: undefined,
    skillsDirs: [],
    agent: undefined,
    agentFiles: [],
  };

  function stubTuiStartup(): void {
    mocks.loadTuiConfig.mockResolvedValue({
      theme: 'dark',
      editorCommand: null,
      notifications: { enabled: true, condition: 'unfocused' },
    });
    mocks.tuiStart.mockResolvedValue(undefined);
  }

  function withEnv(patch: Record<string, string | undefined>, fn: () => Promise<void>): Promise<void> {
    const saved: Record<string, string | undefined> = {};
    for (const key of Object.keys(patch)) {
      saved[key] = process.env[key];
      const value = patch[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    return fn().finally(() => {
      for (const key of Object.keys(patch)) {
        const value = saved[key];
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    });
  }

  it('builds the v2 harness when the master experimental flag is set', async () => {
    stubTuiStartup();
    await withEnv({ MULTIAI_EXPERIMENTAL_FLAG: '1' }, async () => {
      await runShell(minimalCliOptions, '1.2.3-test');
    });
    expect(mocks.multiAIHarnessV2Constructor).toHaveBeenCalledTimes(1);
    expect(mocks.multiAIHarnessConstructor).not.toHaveBeenCalled();
  });

  it('keeps the v1 harness when the master experimental flag is unset', async () => {
    stubTuiStartup();
    await withEnv({ MULTIAI_EXPERIMENTAL_FLAG: undefined }, async () => {
      await runShell(minimalCliOptions, '1.2.3-test');
    });
    expect(mocks.multiAIHarnessConstructor).toHaveBeenCalledTimes(1);
    expect(mocks.multiAIHarnessV2Constructor).not.toHaveBeenCalled();
  });

  it('constructs MultiAIHarness and MultiAITUI with startup input', async () => {
    mocks.loadTuiConfig.mockResolvedValue({
      theme: 'dark',
      editorCommand: null,
      notifications: { enabled: true, condition: 'unfocused' },
    });
    mocks.tuiStart.mockResolvedValue(undefined);
    mocks.tuiGetStartupMcpMs.mockResolvedValue(47);
    mocks.tuiGetCurrentSessionId.mockReturnValue('ses-startup');

    const cliOptions = {
      session: undefined,
      continue: false,
      yolo: true,
      auto: false,
      plan: true,
      model: undefined,
      outputFormat: undefined,
      prompt: undefined,
      skillsDirs: [],
      agent: undefined,
      agentFiles: [],
      addDirs: ['../shared', '/tmp/extra'],
    };

    await runShell(cliOptions, '1.2.3-test');

    expect(mocks.multiAIHarnessConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        identity: expect.objectContaining({
          userAgentProduct: 'multiai-cli',
          version: '1.2.3-test',
        }),
        sessionStartedProperties: { yolo: true, auto: false, plan: true, afk: false },
      }),
    );
    expect(mocks.harnessEnsureConfigFile).toHaveBeenCalledOnce();
    expect(mocks.harnessEnsureConfigFile.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.harnessGetConfig.mock.invocationCallOrder[0]!,
    );
    expect(execSync).toHaveBeenCalledWith('stty -ixon', { stdio: ['inherit', 'ignore', 'ignore'] });
    expect(mocks.multiAITuiConstructor).toHaveBeenCalledTimes(1);
    expect(mocks.createMultiAIDeviceId).not.toHaveBeenCalled();
    expect(mocks.initializeTelemetry).not.toHaveBeenCalled();
    expect(mocks.setCrashPhase).toHaveBeenCalledWith('runtime');

    const [, harness, startupInput] = mocks.multiAITuiConstructor.mock.calls[0]!;
    expect(harness).toBeTypeOf('object');
    expect(startupInput).toMatchObject({
      cliOptions,
      additionalDirs: ['../shared', '/tmp/extra'],
      tuiConfig: {
        theme: 'dark',
        editorCommand: null,
        notifications: { enabled: true, condition: 'unfocused' },
      },
      version: '1.2.3-test',
      workDir: process.cwd(),
    });
    expect(mocks.tuiStart).toHaveBeenCalledOnce();
    expect(mocks.withTelemetryContext).toHaveBeenCalledWith({ sessionId: 'ses-startup' });
    expect(mocks.lifecycleTrack).toHaveBeenCalledWith('startup_perf', {
      duration_ms: expect.any(Number),
      config_ms: expect.any(Number),
      init_ms: expect.any(Number),
      mcp_ms: 47,
    });
  });

  it('forwards skillsDirs from CLI options to the harness', async () => {
    mocks.loadTuiConfig.mockResolvedValue({
      theme: 'dark',
      editorCommand: null,
      notifications: { enabled: true, condition: 'unfocused' },
    });
    mocks.tuiStart.mockResolvedValue(undefined);

    await runShell(
      {
        session: undefined,
        continue: false,
        yolo: false,
        auto: false,
        plan: false,
        model: undefined,
        outputFormat: undefined,
        prompt: undefined,
        skillsDirs: ['/skills'],
        agent: undefined,
        agentFiles: [],
      },
      '1.2.3-test',
    );

    expect(mocks.multiAIHarnessConstructor).toHaveBeenCalledWith(
      expect.objectContaining({ skillDirs: ['/skills'] }),
    );
  });

  it('does not mint a telemetry device id during shell startup', async () => {
    mocks.loadTuiConfig.mockResolvedValue({
      theme: 'dark',
      editorCommand: null,
      notifications: { enabled: true, condition: 'unfocused' },
    });
    mocks.tuiStart.mockResolvedValue(undefined);
    mocks.createMultiAIDeviceId.mockImplementationOnce((homeDir, options) => {
      const deviceId = `device-for-${homeDir}`;
      options?.onFirstLaunch?.(deviceId);
      return deviceId;
    });

    await runShell(
      {
        session: undefined,
        continue: false,
        yolo: false,
        auto: false,
        plan: false,
        model: undefined,
        outputFormat: undefined,
        prompt: undefined,
        skillsDirs: [],
        agent: undefined,
        agentFiles: [],
      },
      '1.2.3-test',
    );

    expect(mocks.createMultiAIDeviceId).not.toHaveBeenCalled();
    expect(mocks.harnessTrack).not.toHaveBeenCalledWith('first_launch');
  });

  it('does not attach a first-launch callback when the harness creates its device id', async () => {
    mocks.loadTuiConfig.mockResolvedValue({
      theme: 'dark',
      editorCommand: null,
      notifications: { enabled: true, condition: 'unfocused' },
    });
    mocks.tuiStart.mockResolvedValue(undefined);
    mocks.harnessCreatesDeviceIdOnConstruction = true;
    const createdHomes = new Set<string>();
    mocks.createMultiAIDeviceId.mockImplementation((homeDir, options) => {
      const deviceId = `device-for-${homeDir}`;
      if (!createdHomes.has(homeDir)) {
        createdHomes.add(homeDir);
        options?.onFirstLaunch?.(deviceId);
      }
      return deviceId;
    });

    await runShell(
      {
        session: undefined,
        continue: false,
        yolo: false,
        auto: false,
        plan: false,
        model: undefined,
        outputFormat: undefined,
        prompt: undefined,
        skillsDirs: [],
        agent: undefined,
        agentFiles: [],
      },
      '1.2.3-test',
    );

    expect(mocks.createMultiAIDeviceId).toHaveBeenNthCalledWith(
      1,
      '/tmp/multiai-test-home',
    );
    expect(mocks.createMultiAIDeviceId.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.multiAIHarnessConstructor.mock.invocationCallOrder[0]!,
    );
    expect(mocks.multiAIHarnessConstructor).toHaveBeenCalledWith(
      expect.objectContaining({ homeDir: '/tmp/multiai-test-home' }),
    );
    expect(mocks.harnessTrack).not.toHaveBeenCalledWith('first_launch');
  });

  it('binds startup_perf to the session captured before MCP metrics resolve', async () => {
    mocks.loadTuiConfig.mockResolvedValue({
      theme: 'dark',
      editorCommand: null,
      notifications: { enabled: true, condition: 'unfocused' },
    });
    mocks.tuiStart.mockResolvedValue(undefined);
    let currentSessionId = 'ses-startup';
    mocks.tuiGetCurrentSessionId.mockImplementation(() => currentSessionId);
    mocks.tuiGetStartupMcpMs.mockImplementation(async () => {
      currentSessionId = 'ses-later';
      return 47;
    });

    await runShell(
      {
        session: undefined,
        continue: false,
        yolo: false,
        auto: false,
        plan: false,
        model: undefined,
        outputFormat: undefined,
        prompt: undefined,
        skillsDirs: [],
        agent: undefined,
        agentFiles: [],
      },
      '1.2.3-test',
    );

    expect(mocks.withTelemetryContext).toHaveBeenCalledWith({ sessionId: 'ses-startup' });
    expect(mocks.withTelemetryContext).not.toHaveBeenCalledWith({ sessionId: 'ses-later' });
    expect(mocks.lifecycleTrack).toHaveBeenCalledWith('startup_perf', {
      duration_ms: expect.any(Number),
      config_ms: expect.any(Number),
      init_ms: expect.any(Number),
      mcp_ms: 47,
    });
  });

  it('does not install an OAuth refresh telemetry bridge', async () => {
    mocks.loadTuiConfig.mockResolvedValue({
      theme: 'dark',
      editorCommand: null,
      notifications: { enabled: true, condition: 'unfocused' },
    });
    mocks.tuiStart.mockResolvedValue(undefined);

    await runShell(
      {
        session: undefined,
        continue: false,
        yolo: false,
        auto: false,
        plan: false,
        model: undefined,
        outputFormat: undefined,
        prompt: undefined,
        skillsDirs: [],
        agent: undefined,
        agentFiles: [],
      },
      '1.2.3-test',
    );

    const [harnessOptions] = mocks.multiAIHarnessConstructor.mock.calls[0] as [
      { readonly onOAuthRefresh?: unknown },
    ];
    expect(harnessOptions.onOAuthRefresh).toBeUndefined();
    expect(mocks.telemetryTrack).not.toHaveBeenCalledWith('oauth_refresh', expect.anything());
  });

  it('detects auto theme and forwards config parse warnings as startup notice', async () => {
    mocks.loadTuiConfig.mockRejectedValue(
      new mocks.TuiConfigParseError({
        theme: 'auto',
        editorCommand: 'vim',
        notifications: { enabled: true, condition: 'always' },
      }),
    );
    mocks.detectTerminalTheme.mockResolvedValue('light');
    mocks.tuiStart.mockResolvedValue(undefined);

    await runShell(
      {
        session: '',
        continue: false,
        yolo: false,
        auto: false,
        plan: false,
        model: undefined,
        outputFormat: undefined,
        prompt: undefined,
        skillsDirs: [],
        agent: undefined,
        agentFiles: [],
      },
      '1.2.3-test',
    );

    expect(mocks.detectTerminalTheme).toHaveBeenCalledOnce();
    const [, , startupInput] = mocks.multiAITuiConstructor.mock.calls[0]!;
    expect(startupInput).toMatchObject({
      startupNotice: 'Invalid TUI config in ~/.multiai/tui.toml; using defaults.',
      tuiConfig: {
        theme: 'auto',
        editorCommand: 'vim',
        notifications: { enabled: true, condition: 'always' },
      },
    });
  });

  it('forwards config.toml diagnostics as startup notices', async () => {
    mocks.loadTuiConfig.mockResolvedValue({
      theme: 'dark',
      editorCommand: null,
      notifications: { enabled: true, condition: 'unfocused' },
    });
    mocks.harnessGetConfigDiagnostics.mockResolvedValue({
      warnings: ['Ignored invalid config in config.toml: loop_control.'],
    });
    mocks.tuiStart.mockResolvedValue(undefined);

    await runShell(
      {
        session: '',
        continue: false,
        yolo: false,
        auto: false,
        plan: false,
        model: undefined,
        outputFormat: undefined,
        prompt: undefined,
        skillsDirs: [],
        agent: undefined,
        agentFiles: [],
      },
      '1.2.3-test',
    );

    const [, , startupInput] = mocks.multiAITuiConstructor.mock.calls[0]!;
    expect(startupInput).toMatchObject({
      startupNotice: 'Ignored invalid config in config.toml: loop_control.',
    });
  });

  it('flushes diagnostic logs synchronously before exiting on a runtime crash', async () => {
    mocks.loadTuiConfig.mockResolvedValue({
      theme: 'dark',
      editorCommand: null,
      notifications: { enabled: true, condition: 'unfocused' },
    });
    mocks.tuiStart.mockResolvedValue(undefined);

    const processOnSpy = vi.spyOn(process, 'on');
    const stdout = captureProcessWrite('stdout');
    const exitSpy = mockProcessExit();

    try {
      await runShell(
        {
          session: undefined,
          continue: false,
          yolo: false,
          auto: false,
          plan: false,
          model: undefined,
          outputFormat: undefined,
          prompt: undefined,
          skillsDirs: [],
          agent: undefined,
          agentFiles: [],
        },
        '1.2.3-test',
      );

      const handler = processOnSpy.mock.calls.find(
        ([event]) => event === 'uncaughtException',
      )?.[1] as ((error: unknown) => void) | undefined;
      expect(handler).toBeDefined();

      // The async log sink cannot flush before process.exit() runs, so the
      // crash handler must force a synchronous flush or the crash reason is
      // lost (regression: uncaughtException logs never reached disk).
      expect(() => handler?.(new Error('boom'))).toThrow(ExitCalled);
      expect(mocks.flushDiagnosticLogsSync).toHaveBeenCalledOnce();
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(mocks.flushDiagnosticLogsSync.mock.invocationCallOrder[0]!).toBeLessThan(
        exitSpy.mock.invocationCallOrder[0]!,
      );
    } finally {
      processOnSpy.mockRestore();
      exitSpy.mockRestore();
      stdout.restore();
    }
  });

  it('flushes diagnostic logs synchronously before exiting on an unhandled rejection', async () => {
    mocks.loadTuiConfig.mockResolvedValue({
      theme: 'dark',
      editorCommand: null,
      notifications: { enabled: true, condition: 'unfocused' },
    });
    mocks.tuiStart.mockResolvedValue(undefined);

    const processOnSpy = vi.spyOn(process, 'on');
    const stdout = captureProcessWrite('stdout');
    const exitSpy = mockProcessExit();

    try {
      await runShell(
        {
          session: undefined,
          continue: false,
          yolo: false,
          auto: false,
          plan: false,
          model: undefined,
          outputFormat: undefined,
          prompt: undefined,
          skillsDirs: [],
          agent: undefined,
          agentFiles: [],
        },
        '1.2.3-test',
      );

      const handler = processOnSpy.mock.calls.find(
        ([event]) => event === 'unhandledRejection',
      )?.[1] as ((reason: unknown) => void) | undefined;
      expect(handler).toBeDefined();

      expect(() => handler?.(new Error('boom'))).toThrow(ExitCalled);
      expect(mocks.flushDiagnosticLogsSync).toHaveBeenCalledOnce();
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(mocks.flushDiagnosticLogsSync.mock.invocationCallOrder[0]!).toBeLessThan(
        exitSpy.mock.invocationCallOrder[0]!,
      );
    } finally {
      processOnSpy.mockRestore();
      exitSpy.mockRestore();
      stdout.restore();
    }
  });

  it('closes the harness when TUI startup fails', async () => {
    mocks.loadTuiConfig.mockResolvedValue({
      theme: 'dark',
      editorCommand: null,
      notifications: { enabled: true, condition: 'unfocused' },
    });
    mocks.tuiStart.mockRejectedValue(new Error('boom'));

    await expect(
      runShell(
        {
          session: undefined,
          continue: false,
          yolo: false,
          auto: false,
          plan: false,
          model: undefined,
          outputFormat: undefined,
          prompt: undefined,
          skillsDirs: [],
          agent: undefined,
          agentFiles: [],
        },
        '1.2.3-test',
      ),
    ).rejects.toThrow('boom');

    expect(mocks.setCrashPhase).toHaveBeenCalledWith('shutdown');
    expect(mocks.harnessTrack).toHaveBeenCalledWith('exit', { duration_ms: expect.any(Number) });
    expect(mocks.shutdownTelemetry).toHaveBeenCalledOnce();
    expect(mocks.harnessClose).toHaveBeenCalledOnce();
  });

  it('tracks exit and prints resume instructions from the TUI exit handler', async () => {
    mocks.loadTuiConfig.mockResolvedValue({
      theme: 'dark',
      editorCommand: null,
      notifications: { enabled: true, condition: 'unfocused' },
    });
    mocks.tuiStart.mockResolvedValue(undefined);
    mocks.tuiGetCurrentSessionId.mockReturnValue('ses-1');
    mocks.tuiHasSessionContent.mockReturnValue(true);

    const stdout = captureProcessWrite('stdout');
    const stderr = captureProcessWrite('stderr');
    const exitSpy = mockProcessExit();

    try {
      await runShell(
        {
          session: undefined,
          continue: false,
          yolo: false,
          auto: false,
          plan: false,
          model: undefined,
          outputFormat: undefined,
          prompt: undefined,
          skillsDirs: [],
          agent: undefined,
          agentFiles: [],
        },
        '1.2.3-test',
      );
      const [tui] = mocks.multiAITuiConstructor.mock.calls[0]!;
      mocks.harnessTrack.mockClear();
      mocks.lifecycleTrack.mockClear();
      mocks.withTelemetryContext.mockClear();

      await expect((tui as { onExit: () => Promise<void> }).onExit()).rejects.toBeInstanceOf(
        ExitCalled,
      );

      expect(mocks.setCrashPhase).toHaveBeenCalledWith('shutdown');
      expect(mocks.withTelemetryContext).toHaveBeenCalledWith({ sessionId: 'ses-1' });
      expect(mocks.lifecycleTrack).toHaveBeenCalledWith('exit', {
        duration_ms: expect.any(Number),
      });
      expect(mocks.harnessTrack).not.toHaveBeenCalledWith('exit', expect.anything());
      expect(mocks.shutdownTelemetry).toHaveBeenCalledOnce();
      expect(stdout.text()).toBe(' Bye!\n');
      expect(stderr.text()).toContain(' To resume this session: multiai -r ses-1');
    } finally {
      exitSpy.mockRestore();
      stdout.restore();
      stderr.restore();
    }
  });

  it('prints the opened web URL from the TUI exit handler when set', async () => {
    mocks.loadTuiConfig.mockResolvedValue({
      theme: 'dark',
      editorCommand: null,
      notifications: { enabled: true, condition: 'unfocused' },
    });
    mocks.tuiStart.mockResolvedValue(undefined);
    mocks.tuiGetCurrentSessionId.mockReturnValue('ses-1');
    mocks.tuiHasSessionContent.mockReturnValue(true);

    const stdout = captureProcessWrite('stdout');
    const stderr = captureProcessWrite('stderr');
    const exitSpy = mockProcessExit();

    try {
      await runShell(
        {
          session: undefined,
          continue: false,
          yolo: false,
          auto: false,
          plan: false,
          model: undefined,
          outputFormat: undefined,
          prompt: undefined,
          skillsDirs: [],
          agent: undefined,
          agentFiles: [],
        },
        '1.2.3-test',
      );
      const [tui] = mocks.multiAITuiConstructor.mock.calls[0]!;
      const openedUrl = 'http://127.0.0.1:58627/sessions/ses-1#token=tok-1';
      (tui as { exitOpenUrl?: string }).exitOpenUrl = openedUrl;

      await expect((tui as { onExit: () => Promise<void> }).onExit()).rejects.toBeInstanceOf(
        ExitCalled,
      );

      expect(stderr.text()).toContain(' To resume this session: multiai -r ses-1');
      expect(stderr.text()).toContain('open ');
      expect(stderr.text()).toContain(openedUrl);
    } finally {
      exitSpy.mockRestore();
      stdout.restore();
      stderr.restore();
    }
  });

});
