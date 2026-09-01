# MultiAI CLI

[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-online-blue)](https://survers.github.io/MultiAI-CLI/ru/)

[Документация](https://survers.github.io/MultiAI-CLI/ru/) ·
[Задачи](https://github.com/SURVERS/MultiAI-CLI/issues) ·
[English](README.md)

MultiAI CLI — это ИИ-агент для программирования в терминале. Он умеет просматривать и изменять код, выполнять команды, искать файлы, использовать веб-инструменты и MCP, а также координировать специализированных субагентов. Учётная запись MultiAI предоставляет управляемый каталог моделей через безопасный OAuth, при этом пользовательские провайдеры и локальные плагины по-прежнему поддерживаются.

## Установка

Для MultiAI CLI требуется Node.js 24.15.0 или новее:

```sh
npm install -g multiai-cli
multiai --version
```

В Windows также установите [Git for Windows](https://gitforwindows.org/). Если Git Bash находится в нестандартном каталоге, задайте в `MULTIAI_SHELL_PATH` абсолютный путь к `bash.exe`.

Нативные сборки публикуются на странице [GitHub Releases](https://github.com/SURVERS/MultiAI-CLI/releases).

## Вход

Рабочие сборки уже содержат публичный идентификатор нативного OAuth-клиента. Выполните вход напрямую:

```sh
multiai login
```

Команда `multiai login` использует Authorization Code с PKCE и временный loopback-слушатель. В терминале без доступного браузера выполните `multiai login --device`. Используйте `--session-only`, если системное хранилище ключей недоступно и учётные данные намеренно должны существовать только до завершения текущего процесса.

`MULTIAI_OAUTH_CLIENT_ID` предназначен только для переопределения в среде разработки или тестирования. Сборка CLI не должна содержать секрет клиента. Полное описание безопасности и жизненного цикла учётной записи приведено в разделе [Учётная запись и OAuth](https://survers.github.io/MultiAI-CLI/ru/guides/account-and-oauth).

## Быстрый старт

```sh
cd your-project
multiai
```

Полезные команды для работы с учётной записью:

```sh
multiai account
multiai account --json
multiai logout
```

MultiAI CLI хранит данные приложения в `~/.multiai`, читает локальную конфигурацию проекта из `.multiai/local.toml` и распознаёт переменные окружения `MULTIAI_*`. Устаревшая команда `kimi`, старые настройки и история не переносятся.

## Интеграция с редакторами

MultiAI CLI поддерживает [Agent Client Protocol](https://agentclientprotocol.com/) через stdio:

```json
{
  "agent_servers": {
    "MultiAI CLI": {
      "type": "custom",
      "command": "multiai",
      "args": ["acp"],
      "env": {}
    }
  }
}
```

Подробнее см. в разделах [Использование в IDE](https://survers.github.io/MultiAI-CLI/ru/guides/ides) и [справочник по `multiai acp`](https://survers.github.io/MultiAI-CLI/ru/reference/multiai-acp).

## Разработка

Требования: Node.js 24.15.0+, pnpm 10.33.0.

```sh
git clone https://github.com/SURVERS/MultiAI-CLI.git
cd MultiAI-CLI
pnpm install
pnpm dev:cli
```

Основные проверки:

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Порядок участия в разработке описан в [CONTRIBUTING.md](CONTRIBUTING.md).

## Лицензия

Проект распространяется по [лицензии MIT](LICENSE).
