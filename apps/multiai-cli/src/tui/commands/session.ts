import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { Session } from '@multiai/sdk';

import { detectInstallSource } from '#/cli/update/source';
import { detectShellEnvironment } from '#/utils/process/shell-env';
import { toTerminalHyperlink } from '#/utils/terminal-hyperlink';
import { llmNotSetMessage, noActiveSessionMessage } from '../constant/multiai-tui';
import { t } from '../i18n';
import { isAbortError } from '../utils/errors';
import { formatErrorMessage } from '../utils/event-payload';
import { buildExportMarkdown } from '../utils/export-markdown';
import type { SlashCommandHost } from './dispatch';

// ---------------------------------------------------------------------------
// Session commands
// ---------------------------------------------------------------------------

export async function handleTitleCommand(host: SlashCommandHost, args: string): Promise<void> {
  const title = args.trim();
  if (title.length === 0) {
    const current = host.state.appState.sessionTitle;
    host.showStatus(
      current !== null && current.length > 0
        ? t(`Session title: ${current}`, `Название сессии: ${current}`)
        : t(`Session title: (not set) — id: ${host.state.appState.sessionId}`, `Название сессии: (не задано) — id: ${host.state.appState.sessionId}`),
    );
    return;
  }

  const session = host.session;
  if (session === undefined) {
    host.showError(noActiveSessionMessage());
    return;
  }

  const newTitle = title.slice(0, 200);
  try {
    await host.harness.renameSession({ id: session.id, title: newTitle });
  } catch (error) {
    const msg = formatErrorMessage(error);
    host.showError(t(`Failed to set title: ${msg}`, `Не удалось задать название: ${msg}`));
    return;
  }
  host.showStatus(t(`Session title set to: ${newTitle}`, `Название сессии изменено: ${newTitle}`));
}

export async function handleForkCommand(host: SlashCommandHost, args: string): Promise<void> {
  void args;
  const session = host.session;
  if (session === undefined) {
    host.showError(noActiveSessionMessage());
    return;
  }

  const sourceTitle = forkSourceTitle(host, session);
  let forked: Session;
  try {
    forked = await host.harness.forkSession({
      id: session.id,
      title: t(`Fork: ${sourceTitle}`, `Ответвление: ${sourceTitle}`),
    });
  } catch (error) {
    const msg = formatErrorMessage(error);
    host.showError(t(`Failed to fork session: ${msg}`, `Не удалось создать ответвление сессии: ${msg}`));
    return;
  }

  try {
    await host.switchToSession(
      forked,
      t(`Session forked (${forked.id}). To return to the original session: multiai -r ${session.id}`, `Создано ответвление сессии (${forked.id}). Чтобы вернуться к исходной сессии: multiai -r ${session.id}`),
    );
  } catch (error) {
    const msg = formatErrorMessage(error);
    host.showError(t(`Failed to switch to forked session: ${msg}`, `Не удалось переключиться на ответвление сессии: ${msg}`));
  }
}

function forkSourceTitle(host: SlashCommandHost, session: Session): string {
  const currentTitle = host.state.appState.sessionTitle?.trim();
  if (currentTitle !== undefined && currentTitle.length > 0) return currentTitle;

  const summaryTitle =
    typeof session.summary?.title === 'string' ? session.summary.title.trim() : '';
  return summaryTitle.length > 0 ? summaryTitle : session.id;
}

export async function handleExportMdCommand(host: SlashCommandHost, args: string): Promise<void> {
  const session = host.session;
  if (session === undefined) {
    host.showError(noActiveSessionMessage());
    return;
  }

  host.showStatus(t('Exporting session as Markdown…', 'Экспорт сессии в Markdown…'));
  try {
    const context = await session.getContext();
    if (context.history.length === 0) {
      host.showError(t('No messages to export.', 'Нет сообщений для экспорта.'));
      return;
    }

    const now = new Date();
    const shortId = session.id.slice(0, 8);
    const timestamp = now.toISOString().replaceAll(/[-:]/g, '').replace(/T/, '-').slice(0, 15);
    const defaultName = `multiai-export-${shortId}-${timestamp}.md`;

    const trimmedArgs = args.trim();
    const outputPath = trimmedArgs.length > 0
      ? resolve(trimmedArgs)
      : resolve(host.state.appState.workDir, defaultName);

    const md = buildExportMarkdown({
      sessionId: session.id,
      workDir: host.state.appState.workDir,
      history: context.history,
      tokenCount: context.tokenCount,
      now,
    });

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, md, 'utf-8');

    const linked = toTerminalHyperlink(outputPath, pathToFileURL(outputPath).href);
    host.showNotice(t(`Exported ${String(context.history.length)} messages`, `Экспортировано сообщений: ${String(context.history.length)}`), linked);
  } catch (error) {
    const msg = formatErrorMessage(error);
    host.showError(t(`Failed to export session: ${msg}`, `Не удалось экспортировать сессию: ${msg}`));
  }
}

export async function handleExportDebugZipCommand(host: SlashCommandHost): Promise<void> {
  const session = host.session;
  if (session === undefined) {
    host.showError(noActiveSessionMessage());
    return;
  }

  host.showStatus(t('Exporting session…', 'Экспорт сессии…'));
  try {
    const installSource = await detectInstallSource();
    const shellEnv = detectShellEnvironment();
    const result = await host.harness.exportSession({
      id: session.id,
      version: host.state.appState.version,
      installSource,
      shellEnv,
      includeGlobalLog: true,
    });
    const linked = toTerminalHyperlink(result.zipPath, pathToFileURL(result.zipPath).href);
    host.showNotice(t('Export complete', 'Экспорт завершён'), linked);
  } catch (error) {
    const msg = formatErrorMessage(error);
    host.showError(t(`Failed to export session: ${msg}`, `Не удалось экспортировать сессию: ${msg}`));
  }
}

export async function handleInitCommand(host: SlashCommandHost): Promise<void> {
  const session = host.session;
  if (host.state.appState.model.trim().length === 0 || session === undefined) {
    host.showError(llmNotSetMessage());
    return;
  }

  host.deferUserMessages = true;
  host.beginSessionRequest();
  try {
    await session.init();
    host.track('init_complete');
    host.streamingUI.finalizeTurn((item) => {
      host.sendQueuedMessage(session, item);
    });
  } catch (error) {
    if (isAbortError(error)) {
      host.setAppState({ streamingPhase: 'idle' });
      host.resetLivePane();
      return;
    }
    const msg = error instanceof Error ? error.message : String(error);
    host.failSessionRequest(t(`Init failed: ${msg}`, `Ошибка инициализации: ${msg}`));
  } finally {
    host.deferUserMessages = false;
  }
}
