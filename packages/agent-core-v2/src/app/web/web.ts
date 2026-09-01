/**
 * `web` domain (L4) — URL fetching through the local backend.
 *
 * Owns the built-in `FetchURL` tool and the `IWebFetchService` seam that yields
 * its `UrlFetcher`. MultiAI OAuth does not provision a product-owned remote
 * fetch backend; hosts may explicitly replace `IWebFetchService`. Bound at App
 * scope.
 */

import { createDecorator, type ServiceIdentifier } from '#/_base/di/instantiation';

import type { UrlFetcher } from './tools/fetch-url-types';

export type { UrlFetcher, UrlFetchKind, UrlFetchResult } from './tools/fetch-url-types';
export { HttpFetchError } from './tools/fetch-url-types';

export interface IWebFetchService {
  readonly _serviceBrand: undefined;

  getUrlFetcher(): UrlFetcher;
}

export const IWebFetchService: ServiceIdentifier<IWebFetchService> =
  createDecorator<IWebFetchService>('webFetchService');
