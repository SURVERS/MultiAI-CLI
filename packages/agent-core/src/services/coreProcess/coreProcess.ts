/**
 * `CoreProcessService` — the in-process RPC adapter owned by the services
 * package. Internally:
 *
 *   1. `createRPC<CoreAPI, SDKAPI>()` produces a `[coreRpc, sdkRpc]` pair of
 *      `RPCClient` functions (packages/agent-core/src/rpc/client.ts:31-103).
 *   2. `new MultiAICore(coreRpc, options)` — the core is constructed with the
 *      core-side RPC client (it calls into the SDK side over `coreRpc`).
 *   3. `sdkRpc(new BridgeClientAPI({ ... }))` — the SDK side of the pair is
 *      satisfied by a `BridgeClientAPI` instance whose `SDKAPI` methods route
 *      to DI-resolved peer services. Returns `Promise<RPCMethods<CoreAPI>>` —
 *      the core RPC methods that downstream services (`SessionService`,
 *      `PromptService`, …) dispatch on through the proxy below.
 *
 * The result is wrapped in a small `SDKRpcClient`-shaped proxy so that
 * service impls get SDK-style RPC ergonomics. The proxy is exposed as `rpc` for in-package
 * consumers; the public package barrel does NOT re-export `SDKRpcClientBase`,
 * so daemon-side code stays one abstraction layer away.
 *
 * Lifecycle:
 *   - `ready()` resolves when both the `MultiAICore` plugin/config load AND the
 *     SDK-side RPC binding have settled. Construction is eager (Singleton
 *     pattern); awaiting `ready()` is the safe gate before issuing RPC calls.
 *   - `dispose()` is idempotent. It flips an internal flag so future `rpc`
 *     method dispatch throws before reaching `MultiAICore`, then walks the
 *     `Disposable` child stack. `MultiAICore` itself has no `dispose()` today —
 *     when it gets one, we wire it here.
 *
 * Role: cross-process adapter — see `packages/services/AGENTS.md`.
 */

import { createDecorator } from '../../di';
import type { CoreRPC, MultiAICoreOptions } from '../../rpc';
import type { TelemetryClient } from '../../telemetry';
import { type MultiAIHostIdentity } from '@multiai/oauth';
import type { ImageLimits } from '#/tools/support/image-limits';

export interface CoreProcessServiceOptions extends MultiAICoreOptions {
  /**
   * Host identity (product name + version). When set and
   * `multiAIRequestHeaders` is omitted, the adapter default-wires
   * `createMultiAIDefaultHeaders({ homeDir, ...identity })` into MultiAICore so
   * upstream sees `User-Agent: <product>/<version>` plus `X-MultiAI-*`
   * device metadata. Without this, the managed endpoint may reject requests.
   *
   * `identity.version` also feeds `appVersion` so session records carry
   * the host CLI version — same wiring `SDKRpcClient` does in node-sdk.
   *
   * Callers can still pass explicit `multiAIRequestHeaders` (or `appVersion`)
   * to override; the explicit values win.
   */
  readonly identity?: MultiAIHostIdentity;
}

export interface ICoreProcessService {
  readonly _serviceBrand: undefined;

  /** The core RPC methods. Service impls call e.g. `core.rpc.createSession(...)`. */
  readonly rpc: CoreRPC;

  readonly multiAIRequestHeaders?: Record<string, string> | undefined;

  /**
   * The telemetry client the host wired into `MultiAICore` (noop when the host
   * supplied none), so daemon-side code — e.g. prompt-ingestion image
   * compression — reports through the same sink as core events.
   */
  readonly telemetry?: TelemetryClient | undefined;

  /**
   * The core's owner-scoped [image] limits, so daemon-side prompt-ingestion
   * compression uses the same settings (and reloads) as the core's own tools.
   */
  readonly imageLimits?: ImageLimits | undefined;

  /**
   * Resolves once `MultiAICore` is fully constructed and the SDK side of the
   * in-process RPC has been bound. Repeated calls return the cached promise.
   */
  ready(): Promise<void>;

  /**
   * Tear down the adapter. After dispose, `rpc.<method>(...)` rejects with a
   * "core process disposed" error before reaching `MultiAICore`. Idempotent.
   */
  dispose(): void;
}

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const ICoreProcessService = createDecorator<ICoreProcessService>('coreProcessService');
