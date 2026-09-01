import type { McpServerInfo } from '@multiai/sdk';

import { t } from '#/tui/i18n';
import { currentTheme } from '#/tui/theme';

export interface McpStatusReportOptions {
  readonly servers: readonly McpServerInfo[];
}

const STATUS_PRIORITY: Record<McpServerInfo['status'], number> = {
  failed: 0,
  'needs-auth': 1,
  pending: 2,
  connected: 3,
  disabled: 4,
};

const statusLabel = (status: McpServerInfo['status']): string => ({
  connected: t('connected', 'подключён'),
  pending: t('pending', 'ожидание'),
  'needs-auth': t('needs auth', 'нужен вход'),
  failed: t('failed', 'ошибка'),
  disabled: t('disabled', 'отключён'),
})[status];

const SUMMARY_ORDER: readonly McpServerInfo['status'][] = [
  'connected',
  'pending',
  'needs-auth',
  'failed',
  'disabled',
];

function statusPainter(
  status: McpServerInfo['status'],
): (text: string) => string {
  switch (status) {
    case 'connected':
      return (text) => currentTheme.fg('success', text);
    case 'failed':
      return (text) => currentTheme.fg('error', text);
    case 'needs-auth':
    case 'pending':
      return (text) => currentTheme.fg('warning', text);
    case 'disabled':
      return (text) => currentTheme.fg('textDim', text);
  }
}

function formatToolCount(server: McpServerInfo): string {
  if (server.status === 'disabled') return '—';
  return t(`${server.toolCount} tool${server.toolCount === 1 ? '' : 's'}`, `Инструментов: ${server.toolCount}`);
}

function formatToolsAvailable(count: number): string {
  return t(`${count} tool${count === 1 ? '' : 's'} available`, `Доступно инструментов: ${count}`);
}

/**
 * Collapse a (possibly multi-line) MCP error into a single line. The status
 * panel renders each returned string as exactly one boxed row (see
 * `UsagePanelComponent.render`), so an embedded newline — e.g. the
 * `\nstderr: ...` a failed stdio server appends — would drop the trailing
 * text to column 0 and punch through the rounded border. Folding every run
 * of whitespace to a single space keeps the error on one row, which the
 * panel then truncates to the available width.
 */
function formatErrorLine(error: string): string {
  return error.trim().replaceAll(/\s+/g, ' ');
}

function sortedServers(servers: readonly McpServerInfo[]): McpServerInfo[] {
  return servers.toSorted(
    (a, b) =>
      STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status] || a.name.localeCompare(b.name),
  );
}

function buildSummary(servers: readonly McpServerInfo[]): string {
  const counts: Partial<Record<McpServerInfo['status'], number>> = {};
  let toolsAvailable = 0;
  for (const server of servers) {
    counts[server.status] = (counts[server.status] ?? 0) + 1;
    if (server.status === 'connected') toolsAvailable += server.toolCount;
  }
  const parts: string[] = [];
  for (const status of SUMMARY_ORDER) {
    const n = counts[status];
    if (n === undefined || n === 0) continue;
    parts.push(`${n} ${statusLabel(status)}`);
  }
  parts.push(formatToolsAvailable(toolsAvailable));
  return parts.join(' · ');
}

export function buildMcpStatusReportLines(options: McpStatusReportOptions): string[] {
  const servers = sortedServers(options.servers);
  const accent = (text: string) => currentTheme.boldFg('primary', text);
  const muted = (text: string) => currentTheme.fg('textDim', text);
  const value = (text: string) => currentTheme.fg('text', text);
  const error = (text: string) => currentTheme.fg('error', text);

  const lines: string[] = [accent(t('Servers', 'Серверы'))];

  if (servers.length === 0) {
    lines.push(muted(t('  No MCP servers configured. Run /mcp-config to add one.', '  MCP-серверы не настроены. Запустите /mcp-config, чтобы добавить сервер.')));
    return lines;
  }

  const nameLabel = t('Name', 'Имя');
  const statusHeader = t('Status', 'Статус');
  const transportLabel = t('Transport', 'Транспорт');
  const nameWidth = Math.max(nameLabel.length, ...servers.map((server) => server.name.length));
  const statusWidth = Math.max(
    statusHeader.length,
    ...servers.map((server) => statusLabel(server.status).length),
  );
  const transportWidth = Math.max(
    transportLabel.length,
    ...servers.map((server) => server.transport.length),
  );

  lines.push(
    `  ${muted(nameLabel.padEnd(nameWidth))}  ${muted(statusHeader.padEnd(statusWidth))}  ${muted(
      transportLabel.padEnd(transportWidth),
    )}  ${muted(t('Tools', 'Инструменты'))}`,
  );

  for (const server of servers) {
    const status = statusPainter(
      server.status,
    )(statusLabel(server.status).padEnd(statusWidth));
    lines.push(
      `  ${value(server.name.padEnd(nameWidth))}  ${status}  ${muted(
        server.transport.padEnd(transportWidth),
      )}  ${value(formatToolCount(server))}`,
    );

    if (
      server.status === 'failed' &&
      server.error !== undefined &&
      server.error.trim().length > 0
    ) {
      lines.push(`    ${muted(t('error:', 'ошибка:'))} ${error(formatErrorLine(server.error))}`);
    }
    if (server.status === 'needs-auth') {
      lines.push(`    ${muted(t('action:', 'действие:'))} ${value(`${t('run', 'запустите')} /mcp-config login ${server.name}`)}`);
    }
  }

  lines.push('');
  lines.push(`  ${value(buildSummary(servers))}`);
  lines.push(`  ${muted(t('Configure with', 'Настройте через'))} ${value('/mcp-config')}`);

  return lines;
}
