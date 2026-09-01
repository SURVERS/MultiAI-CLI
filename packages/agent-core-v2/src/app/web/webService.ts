/**
 * `web` domain (L4) — `IWebFetchService` implementation.
 *
 * Yields the built-in `LocalFetchURLProvider`. MultiAI OAuth does not
 * provision the former product-owned remote fetch service.
 */

import { LifecycleScope, ScopeActivation, registerScopedService } from '#/_base/di/scope';
import { LocalFetchURLProvider } from './providers/local-fetch-url';
import type { UrlFetcher } from './tools/fetch-url-types';
import { IWebFetchService } from './web';

export class WebFetchService implements IWebFetchService {
  declare readonly _serviceBrand: undefined;
  private readonly localFetcher: UrlFetcher;

  constructor() {
    this.localFetcher = new LocalFetchURLProvider();
  }

  getUrlFetcher(): UrlFetcher {
    return this.localFetcher;
  }

}

registerScopedService(
  LifecycleScope.App,
  IWebFetchService,
  WebFetchService,
  ScopeActivation.OnScopeCreated,
  'web',
);
