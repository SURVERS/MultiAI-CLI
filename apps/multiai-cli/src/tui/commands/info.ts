import type { MultiAIAccountSnapshot } from '@multiai/oauth';
import type { McpServerInfo, SessionStatus, SessionUsage } from '@multiai/sdk';

import { buildMcpStatusReportLines } from '../components/messages/mcp-status-panel';
import { buildStatusReportLines } from '../components/messages/status-panel';
import { buildUsageReportLines, UsagePanelComponent } from '../components/messages/usage-panel';
import { t } from '../i18n';
import { formatErrorMessage } from '../utils/event-payload';
import type { SlashCommandHost } from './dispatch';

interface SessionUsageResult {
  readonly usage?: SessionUsage;
  readonly error?: string;
}

interface RuntimeStatusResult {
  readonly status?: SessionStatus;
  readonly error?: string;
}

/** @deprecated `/feedback` is intentionally not registered in MultiAI CLI. */
export async function handleFeedbackCommand(host: SlashCommandHost): Promise<void> {
  host.showStatus(t('In-product feedback is disabled. Use GitHub Issues for bug reports.', 'Обратная связь в приложении отключена. Сообщайте об ошибках через GitHub Issues.'));
}

export async function showUsage(host: SlashCommandHost): Promise<void> {
  const sessionUsage = await loadSessionUsageReport(host);
  const reportArgs = {
    sessionUsage: sessionUsage.usage,
    sessionUsageError: sessionUsage.error,
    contextUsage: host.state.appState.contextUsage,
    contextTokens: host.state.appState.contextTokens,
    maxContextTokens: host.state.appState.maxContextTokens,
  };
  const panel = new UsagePanelComponent(() => buildUsageReportLines(reportArgs), 'primary');
  host.state.transcriptContainer.addChild(panel);
  host.state.ui.requestRender();
}

export async function showAccount(host: SlashCommandHost): Promise<void> {
  let snapshot: MultiAIAccountSnapshot;
  try {
    snapshot = await host.harness.auth.getAccount();
  } catch (error) {
    host.showError(t(`Unable to load MultiAI account: ${formatErrorMessage(error)}`, `Не удалось загрузить аккаунт MultiAI: ${formatErrorMessage(error)}`));
    host.showStatus(t('Run /login to sign in again.', 'Выполните /login, чтобы войти снова.'));
    return;
  }

  const sessionUsage = await loadSessionUsageReport(host);
  const panel = new UsagePanelComponent(
    () => [
      ...buildAccountLines(snapshot),
      '',
      ...buildUsageReportLines({
        sessionUsage: sessionUsage.usage,
        sessionUsageError: sessionUsage.error,
        contextUsage: host.state.appState.contextUsage,
        contextTokens: host.state.appState.contextTokens,
        maxContextTokens: host.state.appState.maxContextTokens,
      }),
    ],
    'primary',
    t(' MultiAI Profile ', ' Профиль MultiAI '),
  );
  host.state.transcriptContainer.addChild(panel);
  host.state.ui.requestRender();
}

function buildAccountLines(snapshot: MultiAIAccountSnapshot): string[] {
  const profile = snapshot.user;
  const wallet = snapshot.account.wallet;
  const subscription = snapshot.account.subscription;
  const displayName = profile.display_name ?? profile.email ?? profile.sub;
  const lines = [
    t(`Profile      ${displayName}`, `Профиль      ${displayName}`),
    ...(profile.email === undefined
      ? []
      : [t(`Email        ${profile.email}${profile.email_verified === true ? ' (verified)' : ''}`, `Email        ${profile.email}${profile.email_verified === true ? ' (подтверждён)' : ''}`)]),
    t(
      `Wallet       ${formatAmount(wallet.total)} total (${formatAmount(wallet.classic)} classic, ${formatAmount(wallet.new)} new)`,
      `Кошелёк      ${formatAmount(wallet.total)} всего (${formatAmount(wallet.classic)} классических, ${formatAmount(wallet.new)} новых)`,
    ),
    t(`Billing      ${wallet.billing_mode}`, `Оплата       ${wallet.billing_mode}`),
    t(
      `Subscription ${subscription.active ? 'active' : subscription.available ? 'available' : 'inactive'}`,
      `Подписка     ${subscription.active ? 'активна' : subscription.available ? 'доступна' : 'неактивна'}`,
    ),
    '',
    t('Usage quotas', 'Лимиты использования'),
    ...Object.entries(subscription.limits).map(([name, limit]) => {
      const label = name.replaceAll('_', ' ');
      const reset = limit.reset_at === undefined ? '' : t(` · resets ${limit.reset_at}`, ` · сброс ${limit.reset_at}`);
      return t(`  ${label}: ${String(limit.remaining_percent)}% remaining${reset}`, `  ${label}: осталось ${String(limit.remaining_percent)}%${reset}`);
    }),
    '',
    t(`Scopes       ${snapshot.connection.scopes.join(', ') || 'none'}`, `Области      ${snapshot.connection.scopes.join(', ') || 'нет'}`),
    t(`Connection   expires ${snapshot.connection.expires_at}`, `Подключение  истекает ${snapshot.connection.expires_at}`),
    '',
    t('API keys', 'API-ключи'),
    ...(snapshot.keys.length === 0
      ? [t('  No visible API keys.', '  Нет видимых API-ключей.')]
      : snapshot.keys.map((key) => `  ${key.name}: ${key.key} (${key.status})`)),
  ];
  return lines;
}

function formatAmount(value: number): string {
  return Number.isFinite(value) ? new Intl.NumberFormat().format(value) : String(value);
}

export async function showStatusReport(host: SlashCommandHost): Promise<void> {
  const runtimeStatus = await loadRuntimeStatusReport(host);
  const appState = host.state.appState;
  const reportArgs = {
    version: appState.version,
    model: appState.model,
    workDir: appState.workDir,
    sessionId: appState.sessionId,
    sessionTitle: appState.sessionTitle,
    thinkingEffort: appState.thinkingEffort,
    permissionMode: appState.permissionMode,
    planMode: appState.planMode,
    contextUsage: appState.contextUsage,
    contextTokens: appState.contextTokens,
    maxContextTokens: appState.maxContextTokens,
    availableModels: appState.availableModels,
    status: runtimeStatus.status,
    statusError: runtimeStatus.error,
  };
  const panel = new UsagePanelComponent(() => buildStatusReportLines(reportArgs), 'primary', t(' Status ', ' Статус '));
  host.state.transcriptContainer.addChild(panel);
  host.state.ui.requestRender();
}

export async function showMcpServers(host: SlashCommandHost): Promise<void> {
  let servers: readonly McpServerInfo[];
  try {
    servers = await host.requireSession().listMcpServers();
  } catch (error) {
    host.showError(t(`Failed to load MCP servers: ${formatErrorMessage(error)}`, `Не удалось загрузить MCP-серверы: ${formatErrorMessage(error)}`));
    return;
  }

  const title = servers.length > 0 ? ` MCP (${servers.length}) ` : ' MCP ';
  const panel = new UsagePanelComponent(
    () => buildMcpStatusReportLines({ servers }),
    'primary',
    title,
  );
  host.state.transcriptContainer.addChild(panel);
  host.state.ui.requestRender();
}

async function loadSessionUsageReport(host: SlashCommandHost): Promise<SessionUsageResult> {
  try {
    return { usage: await host.requireSession().getUsage() };
  } catch (error) {
    return { error: formatErrorMessage(error) };
  }
}

async function loadRuntimeStatusReport(host: SlashCommandHost): Promise<RuntimeStatusResult> {
  try {
    return { status: await host.requireSession().getStatus() };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
