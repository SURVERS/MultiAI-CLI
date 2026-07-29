export {
  assertMultiAIHostIdentity,
  createMultiAIDefaultHeaders,
  createMultiAIDeviceHeaders,
  createMultiAIDeviceId,
  createMultiAIUserAgent,
  MULTIAI_CUSTOM_HEADERS_ENV,
  MULTIAI_PLATFORM,
  parseMultiAICustomHeaders,
  readMultiAIDeviceId,
} from './identity';
export type { MultiAIHostIdentity, MultiAIIdentityOptions } from './identity';

export {
  applyOpenPlatformConfig,
  capabilitiesForModel,
  fetchOpenPlatformModels,
  filterModelsByPrefix,
  getOpenPlatformById,
  isOpenPlatformId,
  OPEN_PLATFORMS,
  OpenPlatformApiError,
  removeOpenPlatformConfig,
} from './open-platform';
export type {
  ApplyOpenPlatformResult,
  OpenPlatformDefinition,
} from './open-platform';

export {
  applyCustomRegistryEntries,
  applyCustomRegistryProvider,
  capabilitiesFromCustomEntry,
  CustomRegistryApiError,
  CUSTOM_REGISTRY_DEFAULT_CAPABILITIES,
  CUSTOM_REGISTRY_DEFAULT_MAX_CONTEXT,
  fetchCustomRegistry,
  removeCustomRegistryProvider,
} from './custom-registry';
export type {
  CustomRegistryModelEntry,
  CustomRegistryProviderEntry,
  CustomRegistryProviderType,
  CustomRegistrySource,
  FetchCustomRegistryOptions,
} from './custom-registry';
export type {
  ProviderDiscoveryConfigShape,
  ProviderDiscoveryModelAlias,
  ProviderDiscoveryModelInfo,
  ProviderDiscoveryOAuthRef,
} from './provider-discovery';

export { refreshProviderModels } from './refreshProviderModels';
export type {
  ProviderChange,
  RefreshProviderHost,
  RefreshProviderOptions,
  RefreshProviderScope,
  RefreshResult,
} from './refreshProviderModels';

export {
  BUILTIN_MULTIAI_OAUTH_CLIENT_ID,
  MULTIAI_API_BASE_URL,
  MULTIAI_CALLBACK_PATH,
  MULTIAI_OAUTH_ISSUER,
  MULTIAI_OAUTH_KEY,
  MULTIAI_PROVIDER_NAME,
  MULTIAI_REGISTERED_REDIRECT_URI,
  resolveMultiAIOAuthConfig,
} from './multiai-constants';
export { MULTIAI_OAUTH_SCOPES } from './multiai-types';
export {
  MultiAIAccountUnavailableError,
  MultiAIInsufficientQuotaError,
  MultiAIOAuthError,
  MultiAIOAuthInsufficientScopeError,
  MultiAIOAuthLoginRequiredError,
  MultiAIRateLimitError,
  MultiAISecureStorageUnavailableError,
} from './multiai-errors';
export {
  buildAuthorizationUri,
  constantTimeEquals,
  createPkceAttempt,
  exchangeAuthorizationCode,
  fetchAccountSnapshot,
  fetchAuthorizationServerMetadata,
  fetchMultiAIModels,
  fetchUserInfo,
  pollDeviceToken as pollMultiAIDeviceToken,
  refreshToken as refreshMultiAIToken,
  requestDeviceAuthorization as requestMultiAIDeviceAuthorization,
  revokeToken as revokeMultiAIToken,
  verifyIdToken,
} from './multiai-client';
export { MultiAIOAuthManager } from './multiai-manager';
export type { MultiAIOAuthManagerOptions } from './multiai-manager';
export { MultiAIOAuthToolkit } from './multiai-toolkit';
export type {
  BearerTokenProvider as MultiAIBearerTokenProvider,
  MultiAIAuthStatus,
  MultiAIOAuthToolkitOptions,
} from './multiai-toolkit';
export {
  applyManagedMultiAIConfig,
  clearManagedMultiAIConfig,
  multiAIModelAlias,
} from './managed-multiai';
export type {
  ManagedMultiAIApplyResult,
  ManagedMultiAICleanupResult,
  ManagedMultiAIConfigShape,
  ManagedMultiAIModelAlias,
  ManagedMultiAIOAuthRef,
  ManagedMultiAIProviderConfig,
} from './managed-multiai';
export { KeyringSessionStorage, MemorySessionStorage } from './secure-storage';
export type { SecureSessionStorage, VersionedSession } from './secure-storage';
export type {
  MultiAIAccountSnapshot,
  MultiAIAuthorization,
  MultiAIBrowserAuthorization,
  MultiAIDeviceAuthorization,
  MultiAIIdentity,
  MultiAILoginOptions,
  MultiAILoginResult,
  MultiAILogoutResult,
  MultiAIMaskedKey,
  MultiAIModelInfo,
  MultiAIOAuthConfig,
  MultiAIOAuthMethod,
  MultiAIOAuthPersistence,
  MultiAIOAuthScope,
  MultiAIOAuthTokenRef,
  MultiAISubscription,
  MultiAISubscriptionLimit,
  MultiAITokenResponse,
  MultiAIWallet,
  OAuthAuthorizationServerMetadata,
  PersistedOAuthSession,
} from './multiai-types';
