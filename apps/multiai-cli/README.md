# @multiai/cli

MultiAI CLI is the terminal, web, and IDE client for MultiAI.

## Install

Requires Node.js 24.15.0 or newer:

```sh
npm install -g @multiai/cli
multiai --version
```

Native artifacts are published through
[SURVERS/MultiAI-CLI releases](https://github.com/SURVERS/MultiAI-CLI/releases).

## Account

```sh
multiai login
multiai login --device
multiai account
multiai logout
```

The browser flow uses Authorization Code + PKCE. Device authorization is the
fallback. Refresh tokens are stored in the operating-system keyring; use
`--session-only` explicitly when no keyring is available.

The OAuth client is public and must not use a client secret. Until the
production client ID is embedded, set `MULTIAI_OAUTH_CLIENT_ID`.

## Run

```sh
multiai
multiai -p "Explain this repository"
multiai web
multiai acp
```

Data is stored under `~/.multiai`; project-local configuration is
`.multiai/local.toml`.
