# Getting started

## What is MultiAI CLI

MultiAI CLI is an AI agent that runs in the terminal, helping you carry out software development tasks and day-to-day terminal operations — reading and modifying code, running shell commands, searching files, fetching web pages, and autonomously planning and adjusting its next steps based on feedback as it works.

It fits scenarios such as:

- **Writing and modifying code**: implementing new features, fixing bugs, completing refactors
- **Understanding a project**: exploring an unfamiliar codebase and answering questions about architecture and implementation
- **Automating tasks**: batch-processing files, running builds and tests, chaining multiple scripts together

The CLI is written in TypeScript, distributed via npm, and runs on Node.js.

## Installation

Install the npm package globally, or download a native build from GitHub Releases.

::: tip Before you install
MultiAI CLI is a fully interactive TUI application. For the best visual experience, run it in a terminal with true-color and ligature support, such as [Kitty](https://sw.kovidgoyal.net/kitty/) or [Ghostty](https://ghostty.org/).
:::

### npm installation

Requires Node.js 24.15.0 or later:

```sh
node --version
npm install -g @multiai/cli
```

Or with pnpm:

```sh
pnpm add -g @multiai/cli
```

Native builds are available from the
[GitHub Releases page](https://github.com/SURVERS/MultiAI-CLI/releases).

> On Windows, install [Git for Windows](https://gitforwindows.org/) before first launch. MultiAI CLI uses the bundled Git Bash as its shell environment; if Git Bash is installed in a custom location, set `MULTIAI_SHELL_PATH` to the absolute path of `bash.exe`.

## Upgrade and uninstall

After installation, verify that the executable is ready:

```sh
multiai --version
```

**Upgrade**: run `multiai upgrade` — the CLI checks for the latest version and presents update options. Choose `Install update now` to upgrade based on your current install source. You can also upgrade directly via the package manager:

```sh
npm install -g @multiai/cli@latest
```

**Uninstall**: remove a downloaded native executable, or uninstall the npm package:

```sh
npm uninstall -g @multiai/cli
```

## First launch

Move into your project directory and run `multiai` to start the interactive UI:

```sh
cd your-project
multiai
```

To run a single instruction without entering the interactive UI, use `-p`:

```sh
multiai -p "Take a look at this project's directory structure"
```

To resume the previous session, add `-c`:

```sh
multiai -c
```

On first launch you need to configure an API source. In the interactive UI, enter `/login` to begin the login flow:

```
/login
```

`/login` opens the browser-based MultiAI OAuth flow with Authorization Code and
PKCE. The CLI listens only on a temporary `127.0.0.1` port. If a browser cannot
be used, choose the device-code fallback or run `multiai login --device`.

MultiAI OAuth needs the public client ID issued for the native application. Set
`MULTIAI_OAUTH_CLIENT_ID` for development and staging builds. Never configure a
client secret in the CLI.

To inspect or clear the account, use `/account` and `/logout`, or run
`multiai account` and `multiai logout`.

::: tip Using other AI providers
If you want to connect Kimi, Anthropic, OpenAI, Google, or another external
provider, edit `~/.multiai/config.toml` and configure its API key. See
[Providers and models](../configuration/providers.md) for details.
:::

For keyring behavior, token expiry, account deletion, profile changes, quota
errors, and the exact `multiai.store` application settings, see
[Account and OAuth](./account-and-oauth.md).

## Your first conversation

Once logged in, describe a task in natural language. A good starting point is to let MultiAI CLI familiarize itself with the project:

```
Take a look at this project's directory structure and briefly describe what each directory is for.
```

MultiAI CLI automatically calls file-reading, search, and other tools to browse the relevant content before responding. Read-only operations are executed automatically by default without requiring confirmation. For operations that modify files or run shell commands, it asks for your confirmation before proceeding.

You can also describe a more concrete task directly:

```
Add a function in src/utils that converts any string to kebab-case, and add a unit test for it.
```

MultiAI CLI plans the steps, modifies the code, runs the tests, and tells you what it did at each step.

::: tip Not sure what to do? Type `/help`
Type `/help` at any time to open the built-in command and keyboard shortcut panel. Use `↑`/`↓` to browse and `Esc` to close. To exit, type `/exit`, press `Ctrl-C` twice, or press `Ctrl-D` with the input box empty.
:::

## Common commands and keyboard shortcuts

For a first-time user, the following is all you need to know:

**Session commands**

| Command | Description |
| --- | --- |
| `/new` | Start a new session, clearing the current context |
| `/sessions` | Browse session history and choose one to resume |
| `/model` | Switch the current model |
| `/compact` | Manually compress the context to free up tokens |
| `/fork` | Fork the current session, keeping history but continuing independently |

**Most-used keyboard shortcuts**

| Shortcut | Description |
| --- | --- |
| `Esc` | Interrupt streaming output / close a popup |
| `Ctrl-C` | Interrupt output; press twice while idle to exit |
| `Shift-Tab` | Toggle Plan mode |
| `Ctrl-S` | Inject a message mid-stream without waiting for the current response to finish |
| `Ctrl-O` | Collapse / expand tool output and compaction summaries |

For the full list, type `/help` or visit [Slash commands reference](../reference/slash-commands.md) and [Keyboard shortcuts](../reference/keyboard.md).

## Where data is stored

MultiAI CLI stores its local data under `~/.multiai/` by default — config files, session records, logs, and the update cache. To move it elsewhere, point to a new path via the `MULTIAI_HOME` environment variable. For the full directory layout, see [Data locations](../configuration/data-locations.md) and [Environment variables](../configuration/env-vars.md).

## Next steps

- [Interaction and input](./interaction.md) — input box operations, approval flow, Plan mode, and YOLO mode explained
- [Sessions and context](./sessions.md) — resuming sessions, compressing context, exporting sessions
- [Common use cases](./use-cases.md) — prompt examples for typical tasks
