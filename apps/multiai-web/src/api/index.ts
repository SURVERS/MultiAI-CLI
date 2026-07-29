// apps/multiai-web/src/api/index.ts
// Singleton factory for the MultiAIWebApi daemon client.

import { readMultiAIApiConfig } from './config';
import type { MultiAIWebApi } from './types';
import { DaemonMultiAIWebApi } from './daemon/client';

let singleton: MultiAIWebApi | undefined;

export function getMultiAIWebApi(): MultiAIWebApi {
  singleton ??= new DaemonMultiAIWebApi(readMultiAIApiConfig());
  return singleton;
}
