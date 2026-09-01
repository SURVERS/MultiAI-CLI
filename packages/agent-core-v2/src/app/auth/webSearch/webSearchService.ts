/**
 * `auth` domain (cross-cutting) — `IWebSearchProviderService` implementation.
 *
 * MultiAI does not provision a product-owned web-search backend. The service
 * intentionally yields `undefined`, so the contributed `WebSearch` tool stays
 * hidden unless a host replaces this service with an explicit implementation.
 * Owns no tool registration — the `WebSearch` tool contributes
 * itself via `registerAgentToolService(...)` and reads this service from the
 * Agent-scope accessor.
 * Tests and hosts that need a custom backend bind `IWebSearchProviderService`
 * directly. Bound at App scope.
 */

import { LifecycleScope, ScopeActivation, registerScopedService } from '#/_base/di/scope';
import type { WebSearchProvider } from '#/agent/tools/web-search/web-search';
import { IWebSearchProviderService } from './webSearch';

export class WebSearchProviderService implements IWebSearchProviderService {
  declare readonly _serviceBrand: undefined;

  getWebSearchProvider(): WebSearchProvider | undefined {
    return undefined;
  }

}

registerScopedService(
  LifecycleScope.App,
  IWebSearchProviderService,
  WebSearchProviderService,
  ScopeActivation.OnScopeCreated,
  'auth',
);
