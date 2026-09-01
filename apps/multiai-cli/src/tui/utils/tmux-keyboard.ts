import { spawn } from 'node:child_process';

import { t } from '../i18n';

const TMUX_QUERY_TIMEOUT_MS = 2000;

export const tmuxExtendedKeysOffWarning = (): string => t(
  'tmux extended-keys is off. Modified Enter keys may not work. Add `set -g extended-keys on` to ~/.tmux.conf and restart tmux.',
  'В tmux отключён extended-keys. Модифицированные клавиши Enter могут не работать. Добавьте `set -g extended-keys on` в ~/.tmux.conf и перезапустите tmux.',
);

export const tmuxExtendedKeysFormatXtermWarning = (): string => t(
  'tmux extended-keys-format is xterm. MultiAI CLI works best with csi-u. Add `set -g extended-keys-format csi-u` to ~/.tmux.conf and restart tmux.',
  'В tmux extended-keys-format задан как xterm. MultiAI CLI лучше работает с csi-u. Добавьте `set -g extended-keys-format csi-u` в ~/.tmux.conf и перезапустите tmux.',
);

export type TmuxOptionReader = (option: string) => Promise<string | undefined>;

export async function detectTmuxKeyboardWarning(
  env: NodeJS.ProcessEnv = process.env,
  readTmuxOption: TmuxOptionReader = readTmuxOptionFromProcess,
): Promise<string | undefined> {
  if ((env['TMUX'] ?? '').length === 0) return undefined;

  const [extendedKeys, extendedKeysFormat] = await Promise.all([
    readTmuxOption('extended-keys'),
    readTmuxOption('extended-keys-format'),
  ]);

  if (extendedKeys === undefined) return undefined;

  if (extendedKeys !== 'on' && extendedKeys !== 'always') {
    return tmuxExtendedKeysOffWarning();
  }

  if (extendedKeysFormat === 'xterm') {
    return tmuxExtendedKeysFormatXtermWarning();
  }

  return undefined;
}

function readTmuxOptionFromProcess(option: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const proc = spawn('tmux', ['show', '-gv', option], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let stdout = '';
    let settled = false;
    let timer: NodeJS.Timeout;

    const finish = (value: string | undefined) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };

    timer = setTimeout(() => {
      proc.kill();
      finish(undefined);
    }, TMUX_QUERY_TIMEOUT_MS);

    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString('utf8');
    });
    proc.on('error', () => {
      finish(undefined);
    });
    proc.on('close', (code) => {
      finish(code === 0 ? stdout.trim() : undefined);
    });
  });
}
