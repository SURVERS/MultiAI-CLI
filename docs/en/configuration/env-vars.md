# Environment variables

MultiAI CLI uses environment variables to control a small number of runtime behaviors — relocating the data directory, turning off telemetry, and temporarily switching models without touching the config file.

::: warning Important: API keys are not configured here
Credential variables such as `KIMI_API_KEY`, `ANTHROPIC_API_KEY`, and `OPENAI_API_KEY` are **not** read automatically from shell environment variables. Running `export KIMI_API_KEY=xxx` in the terminal does not give any provider its key — they must be written in `config.toml` under `[providers.<name>]` or the `[providers.<name>.env]` sub-table.

The only exception is the `MULTIAI_MODEL_*` family, which is an explicit channel that *does* read credentials from the shell — see [Define a model from environment variables](#define-a-model-from-environment-variables-kimi-model).

For background, see [Config overrides: provider credentials](./overrides.md#provider-credentials).
:::

## Core paths

### `MULTIAI_HOME`

Overrides the data root directory; the default is `~/.multiai`. Once set, the config file, sessions, logs, OAuth credentials, and all other data land under the new path:

```sh
export MULTIAI_HOME="/path/to/custom/multiai"
```

> Make sure the directory is writable. Multiple `multiai` instances sharing the same `MULTIAI_HOME` will share config and credential files.

For the complete data directory structure, see [Data locations](./data-locations.md).

### `MULTIAI_DISABLE_TELEMETRY`

Set to `1` to turn off anonymous telemetry reporting (also accepts `true`, `yes`, `y`, case-insensitive):

```sh
export MULTIAI_DISABLE_TELEMETRY=1
```

### `MULTIAI_MODEL_*` family

Switch models temporarily without modifying `config.toml` — when `MULTIAI_MODEL_NAME` is set, the CLI synthesizes a temporary provider in memory; the change does not persist after restart. See [Define a model from environment variables](#define-a-model-from-environment-variables-kimi_model).

## Provider credential key names (written in config.toml)

The key names below are not read directly from the shell — they are key names written inside the `[providers.<name>.env]` sub-table of `config.toml`, serving as fallback values for `api_key` / `base_url`. The CLI reads only from the config file, not from `process.env`.

This design lets you keep familiar key name conventions while centralizing secret management in the config file:

```toml
[providers.kimi.env]
KIMI_API_KEY = "sk-xxx"
KIMI_BASE_URL = "https://api.moonshot.ai/v1"
```

Key names per provider:

| Key | Applicable provider | Default |
| --- | --- | --- |
| `KIMI_API_KEY` | Kimi / Moonshot | None |
| `KIMI_BASE_URL` | Kimi / Moonshot | `https://api.moonshot.ai/v1` |
| `ANTHROPIC_API_KEY` | Anthropic | None |
| `ANTHROPIC_BASE_URL` | Anthropic | Follows Anthropic SDK default |
| `OPENAI_API_KEY` | OpenAI (`openai` and `openai_responses`) | None |
| `OPENAI_BASE_URL` | OpenAI (`openai` and `openai_responses`) | `https://api.openai.com/v1` |
| `GOOGLE_API_KEY` | Google GenAI, Vertex AI | None |
| `VERTEXAI_API_KEY` | Vertex AI | None |
| `GOOGLE_CLOUD_PROJECT` | Vertex AI | None |
| `GOOGLE_CLOUD_LOCATION` | Vertex AI | None |

::: warning
`GOOGLE_APPLICATION_CREDENTIALS` (path to a service account JSON file) is the only exception that goes through the system environment variable mechanism — it is read by the Google SDK directly via the standard ADC flow, and the CLI does not participate. All other key names must be placed in the `[providers.<name>.env]` sub-table to take effect.
:::

For the full provider type and field reference, see [Providers and models](./providers.md).

## OAuth and managed services

The production issuer is `https://multiai.store`. Native clients are public
clients and must not use a client secret.

| Variable | Purpose | Default |
| --- | --- | --- |
| `MULTIAI_OAUTH_CLIENT_ID` | Public native-application client ID; development/staging override until the production ID is embedded | Built-in release value |
| `MULTIAI_OAUTH_ISSUER` | OAuth issuer override for development or staging | `https://multiai.store` |

`MULTIAI_BASE_URL` remains the base-URL override for a manually configured
provider using the Kimi-compatible protocol. It is not the OAuth issuer.

## Define a model from environment variables (`MULTIAI_MODEL_*`)

Want to switch models for testing without touching `config.toml`? When `MULTIAI_MODEL_NAME` is set, the CLI synthesizes a temporary provider and model alias from the `MULTIAI_MODEL_*` variables in memory — nothing is written back to the config file. These variables take priority over `default_model` in `config.toml`, but the `-m <alias>` option at startup still has the highest priority.

```sh
export MULTIAI_MODEL_NAME="kimi-for-coding"
export MULTIAI_MODEL_API_KEY="YOUR_API_KEY"
export MULTIAI_MODEL_BASE_URL="https://api.example.com/v1"
export MULTIAI_MODEL_MAX_CONTEXT_SIZE="262144"
export MULTIAI_MODEL_CAPABILITIES="image_in,thinking"
multiai
```

Complete variable list:

| Variable | Required | Purpose | Default |
| --- | --- | --- | --- |
| `MULTIAI_MODEL_NAME` | Yes (also the enable switch) | Model id sent to the API | — |
| `MULTIAI_MODEL_API_KEY` | Yes | API key | — |
| `MULTIAI_MODEL_PROVIDER_TYPE` | No | Provider type: `kimi`, `anthropic`, `openai` | `kimi` |
| `MULTIAI_MODEL_BASE_URL` | No | API base URL | Each type has its own default |
| `MULTIAI_MODEL_MAX_CONTEXT_SIZE` | No | Maximum context length (tokens) | `262144` (256 K) |
| `MULTIAI_MODEL_CAPABILITIES` | No | Comma-separated capability tags, unioned with auto-detected capabilities | `image_in,thinking` |
| `MULTIAI_MODEL_DISPLAY_NAME` | No | Name shown in `/model` | Falls back to `MULTIAI_MODEL_NAME` |
| `MULTIAI_MODEL_MAX_OUTPUT_SIZE` | No | Per-request output cap (`anthropic` only); when set, overrides the built-in Claude ceiling | Model default |
| `MULTIAI_MODEL_REASONING_KEY` | No | Reasoning field name override (`openai` only) | Auto-detected |
| `MULTIAI_MODEL_THINKING_EFFORT` | No | Thinking effort level: `low`/`medium`/`high`/`xhigh`/`max` | — |
| `MULTIAI_MODEL_ADAPTIVE_THINKING` | No | Force adaptive thinking on or off (`anthropic` only) | Inferred from model name |

If `MULTIAI_MODEL_NAME` is set but a required variable is missing, startup fails immediately with a clear error message.

## Runtime switches

Switches that control the behavior of subsystems such as telemetry, background tasks, and the plugin marketplace:

| Variable | Purpose | Valid values |
| --- | --- | --- |
| `MULTIAI_DISABLE_TELEMETRY` | Disable anonymous telemetry reporting | `1`, `true`, `yes`, `y` (case-insensitive) |
| `MULTIAI_BACKGROUND_KEEP_ALIVE_ON_EXIT` | Whether to keep background tasks when the session closes; takes higher priority than `config.toml`. The default is to stop them on exit | Truthy: `1`/`true`/`yes`/`on`; falsy: `0`/`false`/`no`/`off` |
| `MULTIAI_BACKGROUND_MAX_RUNNING_TASKS` | Cap on concurrently running background tasks; takes higher priority than `[background] max_running_tasks` in `config.toml` (unset means no cap) | Positive integer; invalid values are ignored |
| `MULTIAI_IMAGE_MAX_EDGE_PX` | Longest-edge ceiling (px) for image compression; takes higher priority than `[image] max_edge_px` in `config.toml` (default `2000`) | Positive integer; invalid values are ignored |
| `MULTIAI_IMAGE_READ_BYTE_BUDGET` | Per-image byte budget for model-initiated image reads (`ReadMediaFile` default reads); takes higher priority than `[image] read_byte_budget` in `config.toml` (default `262144`, i.e. 256 KB) | Positive integer; invalid values are ignored |
| `MULTIAI_PLUGIN_MARKETPLACE_URL` | Opt in to a custom plugin marketplace JSON loaded by `/plugins` | No default marketplace; accepts `https://`, `http://`, `file://`, or a local path |
| `MULTIAI_AGENT_SWARM_MAX_CONCURRENCY` | Cap how many AgentSwarm subagents run concurrently during the initial ramp; leave unset for no cap | Positive integer; invalid values fail fast |
| `MULTIAI_SUBAGENT_TIMEOUT_MS` | Maximum wall-clock time (ms) a single subagent (`Agent` / `AgentSwarm`) may run; takes higher priority than `[subagent] timeout_ms` in `config.toml` (default `7200000`, i.e. 2 hours) | Positive integer; invalid values fall back to the config or default |
| `MULTIAI_EXPERIMENTAL_SECONDARY_MODEL` | Enable experimental secondary-model behavior under `multiai web`; `multiai -p` still requires `MULTIAI_EXPERIMENTAL_FLAG=1` to select the v2 engine, which also enables this feature | Truthy: `1`/`true`/`yes`/`on`; falsy: `0`/`false`/`no`/`off` |
| `MULTIAI_SECONDARY_MODEL` | Secondary model; takes higher priority than `[secondary_model] model` in `config.toml`. When the secondary-model experiment is enabled, newly spawned subagents (`Agent` / `AgentSwarm`) bind to it by default instead of inheriting the main agent's model (not supported in the TUI) | A model id from your configured `[models]`, e.g. `multiai/kimi-k2.5`; blank values are ignored |
| `MULTIAI_SECONDARY_EFFORT` | Thinking effort for the secondary model; takes higher priority than `[secondary_model] default_effort` in `config.toml` and applies only when both the model and its experiment are enabled (not supported in the TUI) | An effort value, e.g. `low`; blank values are ignored |
| `MULTIAI_MCP_STARTUP_TIMEOUT_MS` | Global default connection timeout (ms) for all MCP servers; takes higher priority than `[mcp] startup_timeout_ms` in `config.toml`, but a per-server `startupTimeoutMs` in `mcp.json` still wins (default `30000`) | Integer from `1` to `2147483647`; invalid values are ignored |
| `MULTIAI_MCP_TOOL_TIMEOUT_MS` | Global default single tool-call timeout (ms) for all MCP servers; takes higher priority than `[mcp] tool_timeout_ms` in `config.toml`, but a per-server `toolTimeoutMs` in `mcp.json` still wins (default `60000`) | Integer from `1` to `2147483647`; invalid values are ignored |
| `MULTIAI_LOOP_MAX_STEPS_PER_TURN` | Maximum Agent steps per turn; takes higher priority than `[loop_control] max_steps_per_turn` in `config.toml` (unset or `0` means unlimited) | Non-negative integer; invalid values are ignored |
| `MULTIAI_LOOP_MAX_RETRIES_PER_STEP` | Maximum retries after a step failure; takes higher priority than `[loop_control] max_retries_per_step` in `config.toml` (default `10`) | Non-negative integer; invalid values are ignored |
| `MULTIAI_WEB_SEARCH_BASE_URL` | API URL of the web search (`WebSearch`) service; takes higher priority than `[services.moonshot_search] base_url` in `config.toml`, and enables the service without that config section. Persisted credentials and custom headers are not forwarded to an env-selected endpoint | Non-blank string; blank values are ignored |
| `MULTIAI_WEB_SEARCH_API_KEY` | API key of the web search (`WebSearch`) service; replaces both the configured API key and OAuth credential when set | Non-blank string; blank values are ignored |
| `MULTIAI_WEB_FETCH_BASE_URL` | API URL of a user-configured web fetch (`FetchURL`) service; takes higher priority than `[services.moonshot_fetch] base_url`. Persisted credentials and custom headers are not forwarded to an env-selected endpoint | Non-blank string; blank values are ignored |
| `MULTIAI_WEB_FETCH_API_KEY` | API key of the web fetch (`FetchURL`) service; replaces both the configured API key and OAuth credential when set | Non-blank string; blank values are ignored |
| `MULTIAI_EXPERIMENTAL_FLAG` | Enable all registered experimental features for this process | `1`, `true`, `yes`, `on` |
| `MULTIAI_SHELL_PATH` | Override the Git Bash path on Windows (used when auto-detection fails) | Absolute path |
| `MULTIAI_MODEL_MAX_COMPLETION_TOKENS` | Hard cap on `max_completion_tokens` per LLM step; applies to the `multiai` provider only | Positive integer; `0` or negative disables clamping |
| `MULTIAI_MODEL_TEMPERATURE` | Sampling temperature for every request; applies to the `multiai` provider only (global — independent of `MULTIAI_MODEL_NAME`) | Number, e.g. `0.3` |
| `MULTIAI_MODEL_TOP_P` | Nucleus-sampling `top_p` for every request; applies to the `multiai` provider only (global) | Number, e.g. `0.95` |
| `MULTIAI_MODEL_THINKING_EFFORT` | Force a specific thinking effort on the wire (`thinking.effort`), bypassing the model's declared `support_efforts`; applies to the `multiai` provider only, and only while Thinking is on | An effort value, e.g. `max` |
| `MULTIAI_MODEL_THINKING_KEEP` | Preserved-thinking passthrough; on `multiai` sent as `thinking.keep`, on `anthropic` (Claude and Kimi's Anthropic-compatible mode) sent as a `context_management` `clear_thinking_20251015` edit (enabling keep routes Anthropic requests to the beta Messages API); overrides `[thinking] keep` (which defaults to `"all"`); only injected while Thinking is on | A value the API accepts, e.g. `all`; an off-value (`false`/`0`/`no`/`off`/`none`/`null`) disables it |
| `MULTIAI_NO_AUTO_UPDATE` | Fully disable the update preflight — no check, background install, or prompt. Legacy alias `MULTIAI_NO_AUTO_UPDATE` is also honored | Truthy: `1`/`true`/`yes`/`on` |
| `MULTIAI_DISABLE_CRON` | Disable the scheduled-task tool (`CronCreate` rejects new schedules; existing tasks do not fire) | `1` to disable |

MultiAI CLI does not send product telemetry. `MULTIAI_DISABLE_TELEMETRY` remains
accepted for compatibility, but remote telemetry is disabled in release entry
points.

## Diagnostic logs

These variables control log level and file rotation, read once at process startup:

| Variable | Purpose | Default |
| --- | --- | --- |
| `MULTIAI_LOG_LEVEL` | Log level: `off`, `error`, `warn`, `info`, `debug` | `info` |
| `MULTIAI_LOG_GLOBAL_MAX_BYTES` | Maximum bytes per global log file | `6291456` (6 MB) |
| `MULTIAI_LOG_GLOBAL_FILES` | Number of global log files to retain | `5` |
| `MULTIAI_LOG_SESSION_MAX_BYTES` | Maximum bytes per session log file | `5242880` (5 MB) |
| `MULTIAI_LOG_SESSION_FILES` | Number of session log files to retain | `3` |

## System environment variables

The CLI also reads several standard system variables to detect the runtime environment; it does not modify them:

- `HOME`: used to resolve the default data path
- `VISUAL`, `EDITOR`: external editor command (`VISUAL` takes precedence)
- `PATH`: used to locate dependencies such as `rg`, `fd`, `fdfind`, and `git`; on Windows, Git Bash detection checks each `git.exe` found on `PATH`, including package-manager shims such as Scoop
- `NO_COLOR`, `FORCE_COLOR`: control color output (following the [no-color.org](https://no-color.org) convention)
- `CI`: when non-empty and not `"0"`, disables theme detection and falls back to the dark theme
- `TERM_PROGRAM`, `TERM`, `TMUX`: detect terminal features and notification support
- `DISPLAY`, `WAYLAND_DISPLAY`, `XDG_SESSION_TYPE`: detect Linux graphical sessions (for clipboard and image features)
- `WSL_DISTRO_NAME`, `WSLENV`: detect WSL for the clipboard PowerShell bridge
- `LOCALAPPDATA`: used on Windows as a fallback when probing for the Git Bash installation path

## HTTP proxy

MultiAI CLI honors the standard proxy environment variables for all outbound traffic — model API calls, MCP servers, web tools, telemetry, sign-in, and update checks:

- `HTTP_PROXY` / `http_proxy`: proxy for `http://` requests
- `HTTPS_PROXY` / `https_proxy`: proxy for `https://` requests
- `ALL_PROXY` / `all_proxy`: fallback proxy used when the scheme-specific variable is unset; this is where a SOCKS proxy is usually set
- `NO_PROXY` / `no_proxy`: comma-separated hosts that bypass the proxy

Both HTTP(S) and SOCKS proxies are supported. A SOCKS proxy is recognized by its scheme — `socks5://`, `socks5h://`, `socks4://`, or `socks://` (an alias for `socks5://`) — and is typically set via `ALL_PROXY` (the form used by tools like Clash and V2RayN). An HTTP(S) proxy takes precedence over `ALL_PROXY` for HTTP/HTTPS traffic.

The proxy is applied only when one of these variables is set; otherwise connections are made directly. Loopback hosts (`localhost`, `127.0.0.1`, `::1`) always bypass the proxy, so a local server such as a localhost MCP server keeps working when a proxy is configured — add your own internal hosts to `NO_PROXY` to exempt them too.

Stdio MCP servers that run as Node child processes honor `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` automatically when the child's Node version supports `NODE_USE_ENV_PROXY` (Node ≥ 22.21 or ≥ 24.5); SOCKS proxying applies to MultiAI CLI's own traffic only.

## Next steps

- [Config overrides](./overrides.md) — how environment variables, CLI options, and the config file interact by priority
- [Data locations](./data-locations.md) — directory structure affected by `MULTIAI_HOME`
- [Providers and models](./providers.md) — full connection examples per provider type
