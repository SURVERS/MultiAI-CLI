import type { PluginInfo, PluginSummary } from '@multiai/sdk';

import { t } from '#/tui/i18n';
import { currentTheme } from '#/tui/theme';
import {
  CURATED_BADGE,
  OFFICIAL_BADGE,
  THIRD_PARTY_BADGE,
  type PluginTrustLabel,
  formatPluginSourceLabel,
  pluginTrustLabel,
} from '../../utils/plugin-source-label';

export interface PluginsListPanelInput {
  readonly plugins: readonly PluginSummary[];
}

export function buildPluginsListLines(input: PluginsListPanelInput): readonly string[] {
  const muted = (text: string) => currentTheme.fg('textDim', text);
  const value = (text: string) => currentTheme.fg('text', text);
  const success = (text: string) => currentTheme.fg('success', text);
  const primary = (text: string) => currentTheme.fg('primary', text);
  const warning = (text: string) => currentTheme.fg('warning', text);
  if (input.plugins.length === 0) {
    return [
      muted(t('No plugins installed.', 'Плагины не установлены.')),
      '',
      value(t('Run /plugins to install one.', 'Выполните /plugins, чтобы установить плагин.')),
    ];
  }
  const renderTrustBadge = (label: PluginTrustLabel): string => {
    if (label === 'official') return success(`[${OFFICIAL_BADGE}]`);
    if (label === 'curated') return primary(`[${CURATED_BADGE}]`);
    return muted(`[${THIRD_PARTY_BADGE}]`);
  };
  const lines: string[] = [];
  for (const plugin of input.plugins) {
    const enabled = plugin.enabled ? success(t('enabled', 'включён')) : muted(t('disabled', 'отключён'));
    const state = plugin.state === 'ok' ? '' : ` [${plugin.state}]`;
    const version = plugin.version ?? '-';
    const diagnostics = plugin.hasErrors ? warning(t(' | diagnostics: see /plugins info', ' | диагностика: см. /plugins info')) : '';
    const sourceTag = muted(`[${formatPluginSourceLabel(plugin)}]`);
    const trustBadge = ` ${renderTrustBadge(pluginTrustLabel(plugin))}`;
    lines.push(
      `${value(plugin.displayName)} (${muted(plugin.id)}) ${muted(version)} ${sourceTag}${trustBadge} | ${enabled}${state}`,
    );
    const mcp =
      plugin.mcpServerCount > 0
        ? ` | ${plugin.enabledMcpServerCount}/${plugin.mcpServerCount} mcp`
        : '';
    lines.push(`  ${muted(t('skills:', 'навыки:'))} ${value(String(plugin.skillCount))}${muted(mcp)}${diagnostics}`);
  }
  return lines;
}


export interface PluginsInfoPanelInput {
  readonly info: PluginInfo;
}

export function buildPluginsInfoLines(input: PluginsInfoPanelInput): readonly string[] {
  const { info } = input;
  const muted = (text: string) => currentTheme.fg('textDim', text);
  const value = (text: string) => currentTheme.fg('text', text);
  const success = (text: string) => currentTheme.fg('success', text);
  const warning = (text: string) => currentTheme.fg('warning', text);
  const error = (text: string) => currentTheme.fg('error', text);
  const primary = (text: string) => currentTheme.fg('primary', text);
  const status = info.enabled ? success(t('enabled', 'включён')) : muted(t('disabled', 'отключён'));
  const trustLine = (() => {
    const label = pluginTrustLabel(info);
    if (label === 'official') {
      return `${muted(t('Trust:', 'Доверие:'))}  ${success(OFFICIAL_BADGE)} ${muted(t('(MultiAI-built and -maintained)', '(создан и поддерживается MultiAI)'))}`;
    }
    if (label === 'curated') {
      return `${muted(t('Trust:', 'Доверие:'))}  ${primary(CURATED_BADGE)} ${muted(t('(MultiAI-reviewed, upstream-maintained)', '(проверен MultiAI, поддерживается автором)'))}`;
    }
    return `${muted(t('Trust:', 'Доверие:'))}  ${muted(THIRD_PARTY_BADGE)}`;
  })();
  const lines: string[] = [
    `${value(info.displayName)} (${muted(info.id)}) ${muted(info.version ?? '')}`.trim(),
    `${muted(t('Status:', 'Статус:'))} ${status} | ${muted(t('state:', 'состояние:'))} ${stateText(info.state)}`,
    trustLine,
    `${muted(t('Source:', 'Источник:'))} ${value(info.source)}`,
    `${muted(t('Root:', 'Корень:'))}   ${value(info.root)}`,
  ];
  if (info.source === 'github' && info.github !== undefined) {
    const refLabel = `${info.github.ref.kind}:${info.github.ref.value}`;
    lines.push(`${muted(t('GitHub:', 'GitHub:'))} ${value(`${info.github.owner}/${info.github.repo}`)} ${muted(`@${refLabel}`)}`);
    if (info.github.installedSha !== undefined) {
      lines.push(`${muted(t('Installed SHA:', 'Установленный SHA:'))} ${value(info.github.installedSha)}`);
    }
  }
  if (info.originalSource !== undefined) lines.push(`${muted(t('Original source:', 'Исходный источник:'))} ${value(info.originalSource)}`);
  lines.push(`${muted(t('Installed at:', 'Установлен:'))} ${value(info.installedAt)}`);
  if (info.updatedAt !== undefined && info.updatedAt !== info.installedAt) {
    lines.push(`${muted(t('Last updated:', 'Последнее обновление:'))} ${value(info.updatedAt)}`);
  }
  if (info.manifestPath !== undefined) {
    const kindSuffix = info.manifestKind !== undefined ? ` ${muted(`(${info.manifestKind})`)}` : '';
    lines.push(`${muted(t('Manifest:', 'Манифест:'))} ${value(info.manifestPath)}${kindSuffix}`);
  }
  if (info.shadowedManifestPath !== undefined) {
    lines.push(`${muted(t('Shadowed:', 'Перекрыт:'))} ${value(info.shadowedManifestPath)}`);
  }
  const sessionStartSkill = info.manifest?.sessionStart?.skill;
  if (sessionStartSkill !== undefined) {
    lines.push(`${muted(t('Session start:', 'Запуск сессии:'))} ${value(sessionStartSkill)}`);
  }
  if (info.manifest?.skillInstructions !== undefined) {
    lines.push(`${muted(t('Skill instructions:', 'Инструкции навыка:'))} ${value(t('present', 'есть'))}`);
  }
  lines.push('');
  lines.push(value(t(`Skills (${info.manifest?.skills?.length ?? 0}):`, `Навыки (${info.manifest?.skills?.length ?? 0}):`)));
  for (const dir of info.manifest?.skills ?? []) lines.push(`  ${muted('-')} ${value(dir)}`);

  if (info.mcpServers.length > 0) {
    lines.push('');
    lines.push(value(t(`MCP servers (${info.enabledMcpServerCount}/${info.mcpServerCount} enabled):`, `MCP-серверы (${info.enabledMcpServerCount}/${info.mcpServerCount} включено):`)));
    lines.push(muted(t(`  Enabled by default; disable with /plugins mcp disable ${info.id} <server>.`, `  Включены по умолчанию; отключите через /plugins mcp disable ${info.id} <сервер>.`)));
    for (const server of info.mcpServers) {
      const enabled = server.enabled ? success(t('enabled', 'включён')) : muted(t('disabled', 'отключён'));
      lines.push(`  ${muted('-')} ${value(server.name)} ${enabled} ${muted(`(${server.runtimeName})`)}`);
      if (server.transport === 'stdio') {
        const args = server.args !== undefined && server.args.length > 0 ? ` ${server.args.join(' ')}` : '';
        lines.push(`    ${muted(t('command:', 'команда:'))} ${value(`${server.command ?? ''}${args}`.trim())}`);
        if (server.cwd !== undefined) lines.push(`    ${muted(t('cwd:', 'каталог:'))} ${value(server.cwd)}`);
        if (server.envKeys !== undefined && server.envKeys.length > 0) {
          lines.push(`    ${muted(t('env:', 'переменные:'))} ${value(server.envKeys.join(', '))}`);
        }
      } else {
        lines.push(`    ${muted(t('url:', 'url:'))} ${value(server.url ?? '')}`);
        if (server.headerKeys !== undefined && server.headerKeys.length > 0) {
          lines.push(`    ${muted(t('headers:', 'заголовки:'))} ${value(server.headerKeys.join(', '))}`);
        }
      }
    }
  }

  const iface = info.manifest?.interface;
  if (iface !== undefined) {
    lines.push('');
    lines.push(value(t('Display:', 'Отображение:')));
    if (iface.shortDescription !== undefined) lines.push(`  ${muted('-')} ${value(iface.shortDescription)}`);
    if (iface.developerName !== undefined) lines.push(`  ${muted('-')} ${value(t(`by ${iface.developerName}`, `автор: ${iface.developerName}`))}`);
    if (iface.websiteURL !== undefined) lines.push(`  ${muted('-')} ${value(iface.websiteURL)}`);
  }

  if (info.manifest?.keywords !== undefined && info.manifest.keywords.length > 0) {
    lines.push('');
    lines.push(muted(t(`Keywords: ${info.manifest.keywords.join(', ')}`, `Ключевые слова: ${info.manifest.keywords.join(', ')}`)));
  }

  if (info.diagnostics.length > 0) {
    lines.push('');
    lines.push(value(t('Diagnostics:', 'Диагностика:')));
    for (const d of info.diagnostics) {
      const paint = d.severity === 'error' ? error : d.severity === 'warn' ? warning : muted;
      lines.push(`  ${paint(`[${d.severity}]`)} ${value(d.message)}`);
    }
  }
  return lines;
}

function stateText(state: PluginInfo['state']): string {
  if (state === 'ok') return currentTheme.fg('success', state);
  return currentTheme.fg('error', state);
}
