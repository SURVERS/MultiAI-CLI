import {
  createRPC,
  ensureConfigFile,
  getRootLogger,
  MultiAICore,
  noopTelemetryClient,
  resolveConfigPath,
  resolveMultiAIHome,
  resolveLoggingConfig,
  type CoreAPI,
  type OAuthTokenProviderResolver,
  type RPCMethods,
  type SDKAPI,
  type TelemetryClient,
} from '@multiai/agent-core';
import type { Kaos } from '@multiai/kaos';
import { assertMultiAIHostIdentity, createMultiAIDefaultHeaders } from '@multiai/oauth';

import { MultiAIAuthFacade } from '#/auth';
import { MultiAIHarness } from '#/multiai-harness';
import { ClientAPI, SDKRpcClientBase } from '#/rpc';
import type {
  CreateSessionOptions,
  MultiAIHarnessOptions,
  MultiAIHostIdentity,
  ResumeSessionInput,
  ResumedSessionSummary,
  SessionSummary,
} from '#/types';

export interface SDKRpcClientOptions {
  readonly homeDir?: string;
  readonly configPath?: string;
  readonly identity?: MultiAIHostIdentity;
  readonly resolveOAuthTokenProvider?: OAuthTokenProviderResolver;
  readonly skillDirs?: readonly string[];
  readonly telemetry?: TelemetryClient;
  /**
   * Host UI mode (`'print'` for `multiai -p`, `'cli'` for the TUI, ...). Forwarded
   * to the v1 core, which applies print-mode config defaults when it is
   * `'print'`.
   */
  readonly uiMode?: string;
}

export class SDKRpcClient extends SDKRpcClientBase {
  readonly homeDir: string;
  readonly configPath: string;
  readonly identity: MultiAIHostIdentity | undefined;
  readonly telemetry: TelemetryClient;
  readonly auth: MultiAIAuthFacade;
  readonly core: MultiAICore;

  private readonly ready: Promise<RPCMethods<CoreAPI>>;

  constructor(options: SDKRpcClientOptions = {}) {
    super();
    this.identity =
      options.identity === undefined ? undefined : assertMultiAIHostIdentity(options.identity);
    this.homeDir = resolveMultiAIHome(options.homeDir);
    this.configPath = resolveConfigPath({
      homeDir: this.homeDir,
      configPath: options.configPath,
    });
    this.telemetry = options.telemetry ?? noopTelemetryClient;
    this.auth = new MultiAIAuthFacade({
      homeDir: this.homeDir,
      configPath: this.configPath,
    });

    void getRootLogger().configure(resolveLoggingConfig({ homeDir: this.homeDir }));

    const [coreRpc, sdkRpc] = createRPC<CoreAPI, SDKAPI>();
    this.core = new MultiAICore(coreRpc, {
      homeDir: options.homeDir,
      configPath: this.configPath,
      multiAIRequestHeaders: this.createMultiAIRequestHeaders(),
      resolveOAuthTokenProvider:
        options.resolveOAuthTokenProvider ?? this.auth.resolveOAuthTokenProvider,
      skillDirs: options.skillDirs,
      telemetry: this.telemetry,
      appVersion: this.identity?.version,
      uiMode: options.uiMode,
    });
    this.ready = sdkRpc(new ClientAPI(this));
  }

  async ensureConfigFile(): Promise<void> {
    await ensureConfigFile(this.configPath);
  }

  async close(): Promise<void> {
    try {
      await getRootLogger().flush();
    } catch {
      // never let logger flush block process exit
    }
  }

  protected async getRpc(): Promise<RPCMethods<CoreAPI>> {
    return this.ready;
  }

  override async createSessionWithKaos(
    input: CreateSessionOptions,
    kaos: Kaos,
    persistenceKaos?: Kaos,
  ): Promise<SessionSummary> {
    const { planMode, ...coreInput } = input;
    void planMode;
    return this.core.createSessionWithOverrides(coreInput, { kaos, persistenceKaos });
  }

  override async resumeSessionWithKaos(
    input: ResumeSessionInput,
    kaos: Kaos,
    persistenceKaos?: Kaos,
  ): Promise<ResumedSessionSummary> {
    return this.core.resumeSessionWithOverrides(
      { ...input, sessionId: input.id },
      { kaos, persistenceKaos },
    );
  }

  private createMultiAIRequestHeaders(): Record<string, string> | undefined {
    if (this.identity === undefined) return undefined;
    return createMultiAIDefaultHeaders({
      homeDir: this.homeDir,
      ...this.identity,
    });
  }
}

export function createMultiAIHarness(options: MultiAIHarnessOptions): MultiAIHarness {
  const rpc = new SDKRpcClient(options);
  return new MultiAIHarness(rpc, {
    identity: rpc.identity,
    uiMode: options.uiMode,
    homeDir: rpc.homeDir,
    configPath: rpc.configPath,
    auth: rpc.auth,
    telemetry: rpc.telemetry,
    ensureConfigFile: () => rpc.ensureConfigFile(),
    onClose: () => rpc.close(),
    imageLimits: rpc.core.imageLimits,
    sessionStartedProperties: options.sessionStartedProperties,
  });
}
