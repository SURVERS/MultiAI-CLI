import { describe, expect, it } from 'vitest';

import { MultiAIAuthFacade } from '../src/auth';

describe('MultiAIAuthFacade', () => {
  it('exposes login, logout, account, status, and OAuth token resolution', () => {
    const auth = new MultiAIAuthFacade({
      homeDir: 'C:\\example\\.multiai',
      configPath: 'C:\\example\\.multiai\\config.toml',
    });
    expect(MultiAIAuthFacade.prototype.login).toBeTypeOf('function');
    expect(MultiAIAuthFacade.prototype.logout).toBeTypeOf('function');
    expect(MultiAIAuthFacade.prototype.getAccount).toBeTypeOf('function');
    expect(MultiAIAuthFacade.prototype.status).toBeTypeOf('function');
    expect(auth.resolveOAuthTokenProvider).toBeTypeOf('function');
  });
});
