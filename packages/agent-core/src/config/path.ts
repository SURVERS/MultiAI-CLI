import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'pathe';

export function resolveMultiAIHome(homeDir?: string | undefined): string {
  return homeDir ?? process.env['MULTIAI_HOME'] ?? join(homedir(), '.multiai');
}

export function resolveConfigPath(input: {
  readonly homeDir?: string | undefined;
  readonly configPath?: string | undefined;
}): string {
  return input.configPath ?? join(resolveMultiAIHome(input.homeDir), 'config.toml');
}

export function ensureMultiAIHome(homeDir: string): void {
  mkdirSync(homeDir, { recursive: true, mode: 0o700 });
}
