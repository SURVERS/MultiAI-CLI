import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createMultiAIHarness } from '@multiai/sdk';

import { smokeIdentityFromEnv, runPromptToEnd } from './runtime-smoke-helpers';

async function main(): Promise<void> {
  const explicitHomeDir = process.env['MULTIAI_SDK_AUTH_SMOKE_HOME'];
  const explicitWorkDir = process.env['MULTIAI_SDK_AUTH_SMOKE_WORK_DIR'];
  const homeDir =
    explicitHomeDir ?? (await mkdtemp(join(tmpdir(), 'multiai-sdk-auth-smoke-home-')));
  const workDir =
    explicitWorkDir ?? (await mkdtemp(join(tmpdir(), 'multiai-sdk-auth-smoke-work-')));
  const harness = createMultiAIHarness({ homeDir, identity: smokeIdentityFromEnv() });

  try {
    const login = await harness.auth.login({
      method: 'device',
      persistence: process.env['MULTIAI_SDK_AUTH_SESSION_ONLY'] === '1'
        ? 'session'
        : 'keyring',
      onAuthorization: (authorization) => {
        if (authorization.method !== 'device') return;
        process.stdout.write(
          `Open ${authorization.verificationUriComplete} and enter ${authorization.userCode}\n`,
        );
      },
    });
    const config = await harness.getConfig({ reload: true });
    const status = await harness.auth.status();
    const account = await harness.auth.getAccount();
    if (!status.loggedIn || login.defaultModel === undefined) {
      throw new Error('MultiAI login did not provision a usable session.');
    }
    process.stdout.write(`account: ${account.user.display_name ?? account.user.sub}\n`);
    process.stdout.write(`default model: ${config.defaultModel ?? login.defaultModel}\n`);

    const session = await harness.createSession({
      workDir,
      model: config.defaultModel ?? login.defaultModel,
    });
    const ended = await runPromptToEnd(
      session,
      process.env['MULTIAI_SDK_AUTH_SMOKE_PROMPT'] ?? 'Reply with exactly: MultiAI SDK auth smoke ok',
    );
    if (ended.type !== 'turn.ended' || ended.reason !== 'completed') {
      throw new Error(`Expected completed turn, got ${ended.type}`);
    }
  } finally {
    await harness.close();
    if (explicitHomeDir === undefined) await rm(homeDir, { recursive: true, force: true });
    if (explicitWorkDir === undefined) await rm(workDir, { recursive: true, force: true });
  }
}

await main();
