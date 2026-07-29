export { MultiAIHarness } from '#/multiai-harness';
export type { MultiAIHarnessRuntimeOptions } from '#/multiai-harness';
export { Session } from '#/session';
export { MultiAIAuthFacade } from '#/auth';
export { createMultiAIHarness, SDKRpcClient, type SDKRpcClientOptions } from '#/sdk-rpc-client';
export {
  createMultiAIHarnessV2,
  SDKRpcClientV2,
  type SDKRpcClientV2Options,
} from '#/sdk-rpc-client-v2';
export {
  createMultiAIConfigRpc,
  MultiAIConfigRpcClient,
  type MultiAIConfigRpc,
  type MultiAIConfigValidationIssue,
  type MultiAIConfigValidationPathSegment,
  type ResolveMultiAIConfigPathInput,
  type ValidateMultiAIConfigTomlInput,
} from '#/config-rpc';
export { SDKRpcClientBase } from '#/rpc';
export {
  applyCatalogProvider,
  catalogBaseUrl,
  catalogModelToAlias,
  catalogProviderModels,
  CatalogFetchError,
  DEFAULT_CATALOG_URL,
  fetchCatalog,
  inferWireType,
  loadBuiltInCatalog,
  resolveCatalogImport,
} from '#/catalog';
export type {
  ApplyCatalogProviderOptions,
  Catalog,
  CatalogImportInvalidReason,
  CatalogImportResolution,
  CatalogModel,
  CatalogProviderEntry,
  FetchCatalogOptions,
} from '#/catalog';

export {
  ErrorCodes,
  MultiAIError,
  type MultiAIErrorCode,
  type MultiAIErrorInfo,
  type MultiAIErrorOptions,
  type MultiAIErrorPayload,
  MULTIAI_ERROR_INFO,
  fromMultiAIErrorPayload,
  isMultiAIError,
  toMultiAIErrorPayload,
} from '@multiai/agent-core';

// Diagnostic logging — public surface only.
// RootLogger / getRootLogger / LoggingConfig stay inside agent-core.
export {
  flushDiagnosticLogs,
  flushDiagnosticLogsSync,
  log,
  redact,
  resolveGlobalLogPath,
  resolveMultiAIHome,
} from '@multiai/agent-core';
export type { LogContext, LogLevel, LogPayload, Logger } from '@multiai/agent-core';

// Host-side config helpers — safe config reader + config path resolution, used
// by hosts (e.g. the CLI's server telemetry bootstrap) that need to inspect
// config without spinning up a full MultiAICore.
export { effectiveModelAlias, loadRuntimeConfigSafe, resolveConfigPath } from '@multiai/agent-core';
export { limitAgentReplayByTurns } from '@multiai/agent-core';

// Process-wide HTTP proxy bootstrap — installed once at CLI startup so all
// outbound fetch honors HTTP_PROXY / HTTPS_PROXY / NO_PROXY.
export { installGlobalProxyDispatcher } from '@multiai/agent-core';

// Image compression — ingestion sites (e.g. the CLI's clipboard paste, the ACP
// adapter) shrink oversized images while constructing the content part, before
// it enters a prompt. Best effort: returns the original on any failure.
// Compression is never silent: buildImageCompressionCaption renders the note
// placed next to a compressed image, and persistOriginalImage keeps the
// pre-compression bytes readable (ReadMediaFile + region) for detail.
export {
  buildImageCompressionCaption,
  buildUnsupportedImageNotice,
  compressImageForModel,
  compressBase64ForModel,
  gateImageFormatParts,
  isModelAcceptedImageMime,
  normalizeImageMime,
  parseImageDataUrl,
  persistOriginalImage,
  sessionMediaOriginalsDir,
  IMAGE_BYTE_BUDGET,
  MAX_IMAGE_EDGE_PX,
} from '@multiai/agent-core';
export { ImageLimits } from '@multiai/agent-core';
export type {
  CompressImageOptions,
  CompressImageResult,
  CompressBase64Result,
  ImageCompressionCaptionInput,
  ImageCompressionTelemetry,
} from '@multiai/agent-core';

// Experimental feature flags — types only. Resolved values come from
// `MultiAIHarness.getExperimentalFeatures()` over RPC, not from a re-exported runtime value.
export type {
  ExperimentalFeatureState,
  ExperimentalFlagMap,
  ExperimentalFlagSource,
  FlagDefinition,
  FlagDefinitionInput,
  FlagId,
  FlagSurface,
} from '@multiai/agent-core';

export type {
  MultiAIAuthLoginOptions,
  MultiAIAuthLoginResult,
  MultiAIAuthLogoutResult,
} from '#/auth';

export * from '#/events';
export type * from '#/types';
