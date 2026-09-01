# MultiAI CLI

[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-online-blue)](https://survers.github.io/MultiAI-CLI/en/)

[Documentation](https://survers.github.io/MultiAI-CLI/en/) ·
[Issues](https://github.com/SURVERS/MultiAI-CLI/issues) ·
[Русский](README.ru.md)

MultiAI CLI is an AI coding agent for the terminal. It can inspect and edit code,
run commands, search files, use web and MCP tools, and coordinate focused
subagents. A MultiAI account provides a managed catalog through secure OAuth, while
custom providers and local plugins remain supported.

## Install

MultiAI CLI requires Node.js 24.15.0 or newer:

```sh
npm install -g multiai-cli
multiai --version
```

On Windows, also install [Git for Windows](https://gitforwindows.org/). If Git
Bash is not in a standard location, set `MULTIAI_SHELL_PATH` to the absolute path
of `bash.exe`.

Native builds are published on the
[GitHub Releases page](https://github.com/SURVERS/MultiAI-CLI/releases).

## Sign in

Production builds include the public native OAuth client ID. Sign in directly:

```sh
multiai login
```

`multiai login` uses Authorization Code with PKCE and a temporary loopback
listener. For a terminal without a usable browser, run `multiai login --device`.
Use `--session-only` when a system keyring is unavailable and you intentionally
want credentials to last only for the current process.

`MULTIAI_OAUTH_CLIENT_ID` is only a development or staging override. No client
secret belongs in a CLI build. See
[Account and OAuth](https://survers.github.io/MultiAI-CLI/en/guides/account-and-oauth)
for the complete security and account lifecycle behavior.

## Quick start

```sh
cd your-project
multiai
```

Useful account commands:

```sh
multiai account
multiai account --json
multiai logout
```

MultiAI CLI stores application data under `~/.multiai`, reads project-local
configuration from `.multiai/local.toml`, and recognizes `MULTIAI_*` environment
variables. The legacy `kimi` command and old settings/history are not migrated.

## Editor integration

MultiAI CLI supports the
[Agent Client Protocol](https://agentclientprotocol.com/) over stdio:

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

See [Using in IDEs](https://survers.github.io/MultiAI-CLI/en/guides/ides) and
the [`multiai acp` reference](https://survers.github.io/MultiAI-CLI/en/reference/multiai-acp).

## Develop

Requirements: Node.js 24.15.0+, pnpm 10.33.0.

```sh
git clone https://github.com/SURVERS/MultiAI-CLI.git
cd MultiAI-CLI
pnpm install
pnpm dev:cli
```

Common checks:

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution workflow.

## License

Released under the [MIT License](LICENSE).
