# Sessions and context

MultiAI CLI persists every conversation as a "session" — storing message history and metadata so you can close the terminal and pick up right where you left off. This page covers how to resume sessions, manage context, and export or fork sessions.

## Session storage

All sessions are saved under `$MULTIAI_HOME/sessions/` (default: `~/.multiai/sessions/`), grouped by working directory:

```text
~/.multiai/
├── config.toml
├── session_index.jsonl
└── sessions/
    └── <workDirKey>/
        └── <sessionId>/
            ├── state.json
            └── agents/
                ├── main/
                │   └── wire.jsonl
                └── <subagentId>/
                    └── wire.jsonl
```

- `state.json`: session metadata such as title and creation time.
- `agents/*/wire.jsonl`: the agent event stream, used for session recovery and replay. It also carries a request trace — the tool schemas, request parameters, and MCP tool listings sent to the model — for debugging.

::: warning
Do not manually edit files inside the `sessions/` directory — doing so may prevent sessions from being restored correctly.
:::

## Starting and resuming sessions

Every time you run `multiai` directly it creates a new session. To resume a previous session, use one of the following:

**Resume the most recent session in the current directory:**

```sh
multiai --continue
```

**Resume a specific session by ID:**

```sh
multiai --session abc123
```

**Interactively browse session history and choose one:**

```sh
multiai --session
```

::: warning
`--continue` and `--session` are mutually exclusive.
:::

## Switching sessions inside the TUI

You can manage sessions without leaving the terminal. The following slash commands are available only when the agent is idle:

- **`/new`** (alias `/clear`): switch to a new session, discarding the current context.
- **`/sessions`** (alias `/resume`): browse and resume a previous session.
- **`/fork`**: fork the current session (see below).
- **`/title <text>`** (alias `/rename`): set a session title for easier identification; without arguments, displays the current title.

## Context compression

As a conversation grows, MultiAI CLI automatically compresses the message history when the context approaches the window limit, freeing up token space. You can also trigger compression manually at any time:

```
/compact
```

You can pass a hint to tell the model what to prioritize when compressing:

```
/compact Keep the discussion about database migrations
```

## Forking a session

To explore a new direction without disrupting the current conversation, use `/fork`:

```
/fork
```

The two resulting sessions are completely independent and do not affect each other. You can switch back to the original at any time using `/sessions`. A saved `/goal` is not copied to the fork. Start a new goal there if you want autonomous goal work.

## Exporting a session

Use `multiai export` to package a session as a ZIP file — useful for sharing, archiving, or filing a bug report:

```sh
multiai export <sessionId>
```

Omitting `sessionId` exports the most recent session in the current directory (with an interactive confirmation prompt; add `-y` to skip). Use `-o` to specify an output path:

```sh
multiai export <sessionId> -o ~/Desktop/my-session.zip
```

The export includes all files in the session directory, including diagnostic logs. The global diagnostic log (`~/.multiai/logs/multiai.log`) is also bundled by default; add `--no-include-global-log` to exclude it.

You can also export from inside the TUI without leaving the interactive session:

- **`/export-debug-zip`**: produces the same debug ZIP as `multiai export`.
- **`/export-md`** (alias `/export`): exports the conversation as a human-readable Markdown file, suitable for sharing or archiving. Accepts an optional path argument; without one, it writes to `multiai-export-<short-id>-<timestamp>.md` in the current working directory.

In the web UI, `/export` downloads the current session as a diagnostic ZIP. It includes the persisted session data, diagnostic logs, and a bounded metadata-only `logs/multiai-web.jsonl` record of key browser events. Prompt text, WebSocket payloads, and console arguments are not copied into this browser log. This web command differs from the TUI `/export` alias above.

The browser buffers the ZIP before saving it, so web exports are limited to 64 MiB. For a larger session, use `multiai export <sessionId>` or the TUI `/export-debug-zip` command.

::: tip
Exported files may contain code, command output, and file paths that are sensitive. Review the content before sharing.
:::

## Next steps

- [Data locations](../configuration/data-locations.md) — full directory layout for session files
- [multiai command reference](../reference/multiai-command.md) — complete parameter reference for `--continue`, `--session`, `export`, and other commands
