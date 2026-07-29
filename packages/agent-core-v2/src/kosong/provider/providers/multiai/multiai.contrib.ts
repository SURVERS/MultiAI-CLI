/**
 * `multiai` vendor definition over the OpenAI Responses protocol.
 */

import { registerProviderDefinition } from '../../providerDefinition';

registerProviderDefinition({
  id: 'multiai',
  baseProtocol: 'openai_responses',
  traits: [],
  endpoint: {
    baseUrlEnv: 'MULTIAI_BASE_URL',
    defaultBaseUrl: 'https://multiai.store/v1',
  },
  hostHeaders: 'full',
  modelSource: 'oauth-catalog',
});
