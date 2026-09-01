import {
  resolveMultiAIHome,
  type MultiAIConfig,
  type TelemetryClient,
} from '@multiai/sdk';
import { disableTelemetry } from '@multiai/telemetry';

import type { PromptHarness } from './prompt-session';
export interface CliTelemetryBootstrap {
  readonly homeDir: string;
  readonly deviceId: string;
  readonly firstLaunch: boolean;
}

export interface InitializeCliTelemetryOptions {
  readonly harness: PromptHarness;
  readonly bootstrap: CliTelemetryBootstrap;
  readonly config: Pick<MultiAIConfig, 'defaultModel' | 'telemetry'>;
  readonly version: string;
  readonly uiMode: string;
  readonly model?: string;
  readonly sessionId?: string;
}

export function createCliTelemetryBootstrap(): CliTelemetryBootstrap {
  return {
    homeDir: resolveMultiAIHome(),
    deviceId: 'telemetry-disabled',
    firstLaunch: false,
  };
}

export function initializeCliTelemetry(_options: InitializeCliTelemetryOptions): void {
  disableTelemetry();
}

export interface InitializeServerTelemetryOptions {
  readonly version: string;
}

/**
 * Return an inert client for the local web host. MultiAI CLI ships with
 * product telemetry disabled in every interface.
 */
export function initializeServerTelemetry(
  _options: InitializeServerTelemetryOptions,
): TelemetryClient {
  disableTelemetry();
  const client: TelemetryClient = {
    track: () => {},
    withContext: () => client,
    setContext: () => {},
  };
  return client;
}
