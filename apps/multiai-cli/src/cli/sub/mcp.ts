import type { Command } from 'commander';
import { createMultiAIHarness, type McpServerConfig } from '@multiai/sdk';
import chalk from 'chalk';

import { createMultiAIHostIdentity } from '#/cli/version';
import { t } from '#/tui/i18n';

function parseKeyValuePairs(pairs?: string[]): Record<string, string> | undefined {
  if (!pairs || pairs.length === 0) return undefined;
  const result: Record<string, string> = {};
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const key = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      result[key] = val;
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

export function registerMcpCommand(parent: Command): void {
  const mcp = parent
    .command('mcp')
    .description(
      t(
        'Manage Model Context Protocol (MCP) servers (list, add, remove, enable, disable, test).',
        'Управление серверами Model Context Protocol (MCP): список, добавление, удаление, включение, выключение, тест.',
      ),
    );

  // Default action when running `multiai mcp` without subcommand: list servers
  mcp
    .option('--json', t('Print MCP servers as JSON.', 'Вывести серверы MCP в формате JSON.'), false)
    .action(async (options: { json: boolean }) => {
      await handleListMcpServers(options.json);
    });

  mcp
    .command('list')
    .alias('ls')
    .description(t('List all configured MCP servers.', 'Показать все настроенные серверы MCP.'))
    .option('--json', t('Print MCP servers as JSON.', 'Вывести серверы MCP в формате JSON.'), false)
    .action(async (options: { json: boolean }) => {
      await handleListMcpServers(options.json);
    });

  mcp
    .command('add <name> <commandOrUrl> [args...]')
    .description(
      t(
        'Add a new MCP server. If commandOrUrl starts with http:// or https://, HTTP/SSE transport is used; otherwise stdio transport.',
        'Добавить новый сервер MCP. Если указан URL (http/https), используется HTTP/SSE транспорт, иначе stdio.',
      ),
    )
    .option('--sse', t('Use SSE transport for HTTP server.', 'Использовать транспорт SSE для HTTP-сервера.'), false)
    .option(
      '--env <key=value...>',
      t('Environment variables for stdio server (KEY=VALUE).', 'Переменные окружения для stdio-сервера (КЛЮЧ=ЗНАЧЕНИЕ).'),
    )
    .option('--cwd <dir>', t('Working directory for stdio server.', 'Рабочая директория для stdio-сервера.'))
    .option(
      '--header <key=value...>',
      t('Headers for HTTP/SSE server (Header=Value).', 'Заголовки для HTTP/SSE сервера (Header=Value).'),
    )
    .action(
      async (
        name: string,
        commandOrUrl: string,
        args: string[],
        options: {
          sse: boolean;
          env?: string[];
          cwd?: string;
          header?: string[];
        },
      ) => {
        await handleAddMcpServer(name, commandOrUrl, args, options);
      },
    );

  mcp
    .command('remove <name>')
    .alias('rm')
    .alias('delete')
    .description(t('Remove an MCP server.', 'Удалить сервер MCP.'))
    .action(async (name: string) => {
      await handleRemoveMcpServer(name);
    });

  mcp
    .command('enable <name>')
    .description(t('Enable a disabled MCP server.', 'Включить отключённый сервер MCP.'))
    .action(async (name: string) => {
      await handleToggleMcpServer(name, true);
    });

  mcp
    .command('disable <name>')
    .description(t('Disable an MCP server without removing it.', 'Отключить сервер MCP без удаления.'))
    .action(async (name: string) => {
      await handleToggleMcpServer(name, false);
    });

  mcp
    .command('test <name>')
    .description(t('Test connection to an MCP server.', 'Проверить подключение к серверу MCP.'))
    .action(async (name: string) => {
      await handleTestMcpServer(name);
    });
}

async function handleListMcpServers(json: boolean): Promise<void> {
  const harness = createMultiAIHarness({
    identity: createMultiAIHostIdentity(),
    uiMode: 'cli',
  });
  try {
    const servers = (await harness.listMcpServers()) as readonly (McpServerConfig & { name: string })[];
    if (json) {
      process.stdout.write(`${JSON.stringify(servers, null, 2)}\n`);
      return;
    }

    if (servers.length === 0) {
      process.stdout.write(
        chalk.hex('#94A3B8')(
          t(
            'No MCP servers configured.\nTo add a server: multiai mcp add <name> <commandOrUrl> [args...]\n',
            'Серверы MCP не настроены.\nЧтобы добавить сервер: multiai mcp add <имя> <команда_или_url> [аргументы...]\n',
          ),
        ),
      );
      return;
    }

    process.stdout.write(
      chalk.bold.hex('#22C55E')(
        t(`Configured MCP servers (${servers.length}):\n`, `Настроенные серверы MCP (${servers.length}):\n`),
      ),
    );

    for (const server of servers) {
      const isEnabled = server.enabled !== false;
      const statusBadge = isEnabled
        ? chalk.bold.hex('#22C55E')(t('● active', '● активен'))
        : chalk.hex('#64748B')(t('○ disabled', '○ отключён'));

      const transportBadge = chalk.hex('#94A3B8')(`[${server.transport ?? 'stdio'}]`);
      const nameStr = chalk.bold.hex('#FFFFFF')(server.name);

      let targetDesc = '';
      if (server.transport === 'http' || server.transport === 'sse' || 'url' in server) {
        targetDesc = (server as { url?: string }).url ?? '';
      } else if ('command' in server) {
        const stdio = server as { command: string; args?: string[] };
        targetDesc = `${stdio.command}${stdio.args && stdio.args.length > 0 ? ' ' + stdio.args.join(' ') : ''}`;
      }

      process.stdout.write(`  ${nameStr} ${transportBadge} ${statusBadge}\n`);
      if (targetDesc) {
        process.stdout.write(chalk.hex('#64748B')(`    ${t('Target:', 'Цель:')} ${targetDesc}\n`));
      }
      if ('env' in server && server.env && Object.keys(server.env).length > 0) {
        process.stdout.write(
          chalk.hex('#64748B')(`    ${t('Env:', 'Переменные:')} ${Object.keys(server.env).join(', ')}\n`),
        );
      }
      if ('cwd' in server && (server as { cwd?: string }).cwd) {
        process.stdout.write(
          chalk.hex('#64748B')(`    ${t('Directory:', 'Директория:')} ${(server as { cwd?: string }).cwd}\n`),
        );
      }
      process.stdout.write('\n');
    }
  } finally {
    await harness.close().catch(() => {});
  }
}

async function handleAddMcpServer(
  name: string,
  commandOrUrl: string,
  args: string[],
  options: {
    sse: boolean;
    env?: string[];
    cwd?: string;
    header?: string[];
  },
): Promise<void> {
  const harness = createMultiAIHarness({
    identity: createMultiAIHostIdentity(),
    uiMode: 'cli',
  });
  try {
    const isUrl = /^https?:\/\//i.test(commandOrUrl);
    let serverConfig: Record<string, unknown>;

    if (isUrl) {
      serverConfig = {
        name,
        transport: options.sse ? 'sse' : 'http',
        url: commandOrUrl,
        headers: parseKeyValuePairs(options.header),
        enabled: true,
      };
    } else {
      serverConfig = {
        name,
        transport: 'stdio',
        command: commandOrUrl,
        args: args.length > 0 ? args : undefined,
        env: parseKeyValuePairs(options.env),
        cwd: options.cwd,
        enabled: true,
      };
    }

    await harness.addMcpServer(serverConfig as unknown as McpServerConfig);
    process.stdout.write(
      chalk.hex('#22C55E')('✓ ') +
        chalk.bold.hex('#FFFFFF')(
          t(`MCP server "${name}" added successfully.\n`, `MCP-сервер «${name}» успешно добавлен.\n`),
        ),
    );
  } catch (error) {
    process.stderr.write(
      chalk.hex('#EF4444')(
        `${t('Failed to add MCP server:', 'Ошибка добавления MCP-сервера:')} ${error instanceof Error ? error.message : String(error)}\n`,
      ),
    );
    process.exit(1);
  } finally {
    await harness.close().catch(() => {});
  }
}

async function handleRemoveMcpServer(name: string): Promise<void> {
  const harness = createMultiAIHarness({
    identity: createMultiAIHostIdentity(),
    uiMode: 'cli',
  });
  try {
    await harness.removeMcpServer(name);
    process.stdout.write(
      chalk.hex('#22C55E')('✓ ') +
        chalk.bold.hex('#FFFFFF')(
          t(`MCP server "${name}" removed.\n`, `MCP-сервер «${name}» успешно удалён.\n`),
        ),
    );
  } catch (error) {
    process.stderr.write(
      chalk.hex('#EF4444')(
        `${t('Failed to remove MCP server:', 'Ошибка удаления MCP-сервера:')} ${error instanceof Error ? error.message : String(error)}\n`,
      ),
    );
    process.exit(1);
  } finally {
    await harness.close().catch(() => {});
  }
}

async function handleToggleMcpServer(name: string, enabled: boolean): Promise<void> {
  const harness = createMultiAIHarness({
    identity: createMultiAIHostIdentity(),
    uiMode: 'cli',
  });
  try {
    const servers = (await harness.listMcpServers()) as readonly (McpServerConfig & { name: string })[];
    const existing = servers.find((s) => s.name === name);
    if (!existing) {
      process.stderr.write(
        chalk.hex('#EF4444')(
          t(`MCP server "${name}" not found.\n`, `MCP-сервер «${name}» не найден.\n`),
        ),
      );
      process.exit(1);
    }

    await harness.updateMcpServer({
      ...existing,
      enabled,
    });

    const msg = enabled
      ? t(`MCP server "${name}" enabled.\n`, `MCP-сервер «${name}» включён.\n`)
      : t(`MCP server "${name}" disabled.\n`, `MCP-сервер «${name}» отключён.\n`);

    process.stdout.write(chalk.hex('#22C55E')('✓ ') + chalk.bold.hex('#FFFFFF')(msg));
  } catch (error) {
    process.stderr.write(
      chalk.hex('#EF4444')(
        `${t('Failed to update MCP server:', 'Ошибка обновления MCP-сервера:')} ${error instanceof Error ? error.message : String(error)}\n`,
      ),
    );
    process.exit(1);
  } finally {
    await harness.close().catch(() => {});
  }
}

async function handleTestMcpServer(name: string): Promise<void> {
  const harness = createMultiAIHarness({
    identity: createMultiAIHostIdentity(),
    uiMode: 'cli',
  });
  try {
    process.stdout.write(
      chalk.hex('#94A3B8')(
        t(`Testing connection to MCP server "${name}"...\n`, `Проверка подключения к MCP-серверу «${name}»...\n`),
      ),
    );

    const result = await harness.testMcpServer(name);
    if (result.success) {
      process.stdout.write(
        chalk.hex('#22C55E')('✓ ') +
          chalk.bold.hex('#FFFFFF')(
            t(`Connection to "${name}" successful!\n`, `Подключение к «${name}» успешно!\n`),
          ),
      );
      if (result.output) {
        process.stdout.write(chalk.hex('#94A3B8')(`${result.output.trim()}\n`));
      }
    } else {
      process.stderr.write(
        chalk.hex('#EF4444')(
          `✗ ${t(`Connection to "${name}" failed:`, `Не удалось подключиться к «${name}»:`)}\n${result.output}\n`,
        ),
      );
      process.exit(1);
    }
  } catch (error) {
    process.stderr.write(
      chalk.hex('#EF4444')(
        `${t('Failed to test MCP server:', 'Ошибка тестирования MCP-сервера:')} ${error instanceof Error ? error.message : String(error)}\n`,
      ),
    );
    process.exit(1);
  } finally {
    await harness.close().catch(() => {});
  }
}
