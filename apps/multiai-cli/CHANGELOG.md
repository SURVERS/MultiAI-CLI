# multiai-cli

## 1.1.13

### Patch Changes

- Format `working` live duration and completed execution timers with days, hours, minutes, and seconds (`1d 2h 15m 30s` / `1д 2ч 15м 30с`) instead of formatting long runtimes entirely in seconds.

## 1.1.12

### Patch Changes

- Redesign terminal UI palette to clean, high-contrast white and emerald green aesthetic (matching terminal hacker style, eliminating rainbow/slop palette).
- Add automatic login initiation on first launch when unauthenticated, immediately prompting and guiding user through browser OAuth sign-in.
- Add `multiai mcp` command suite (`list`, `add`, `remove`, `enable`, `disable`, `test`) for complete Model Context Protocol management from the terminal.
- Fix `working` status timer in footer to continuously track the entire task/turn duration from request to completion without resetting across steps, tool executions, and thinking phases.

## 1.1.11

### Patch Changes

- Add native model profiles and dynamic runtime resolution for Kimi models (`kimi-k3.1-pro`, `kimi-k3`, `kimi-k2.8-preview`, `kimi-k2.7-code`) with accurate reasoning levels, always-thinking defaults, and 1M context limits.
- Fix model resolution when requested via bare model id (e.g. `--model kimi-k3.1-pro`) vs prefixed alias (`multiai/kimi-k3.1-pro`) when `managed:multiai` is configured, preventing `[config.invalid] Model is not configured in config.toml` error.
- Support dynamic model alias synthesis for managed MultiAI catalog models across v1 and v2 engines without requiring manual entry in `config.toml`.

## 1.1.10

### Patch Changes

- Fix premature turn termination and repetitive infinite loops when models (e.g. reasoning models like Kimi k3.1 pro with thinking: max) emit conversational promises of action without tool calls while TodoList has pending tasks.
- Add auto-continuation for incomplete tasks in TodoList up to 3 times per phase with authoritative system-reminder directives to execute tools directly.
- Add authoritative action injection when user submits generic continuation prompts ("continue", "продолжай", etc.) after turns with no tool calls, preventing verbatim text repetition loops.
- Strengthen system prompt to prohibit announcing actions without invoking tools in the exact same response.

## 1.1.9

### Patch Changes

- Fix premature turn termination when reaching output token limit (max_tokens) by adding auto-continuation support up to 3 times per phase and fixing finishReason normalization for OpenAI-compatible providers.

## 1.1.8

### Patch Changes

- Fix word wrapping in CLI output and assistant message delta merging across tool call boundaries.
- Add execution duration timer in assistant messages and footer status bar.

## 1.1.5

### Patch Changes

- [#2](https://github.com/SURVERS/MultiAI-CLI/pull/2) [`472cb4d`](https://github.com/SURVERS/MultiAI-CLI/commit/472cb4d702faffffca9e4dccca9a9f2b58ab36d0) Thanks [@Wolf02012](https://github.com/Wolf02012)! - Fix Claude requests failing when the generated output-token budget exceeds the model limit.

## 1.1.3

### Patch Changes

- Make managed MultiAI sign-in reliable through flaky proxies and clock drift. All OAuth requests are now bounded by a 15s timeout, idempotent GETs (metadata, userinfo, models) retry, and the JWKS key set is cached across logins instead of re-fetched every time. The ID-token clock-skew allowance grows from 60s to 300s so a skewed laptop clock no longer rejects sign-in with an "expired ID token" error. A transient refresh or device-poll network failure no longer deletes your stored session or aborts an in-progress login; a once-failed OAuth metadata fetch is retried on the next attempt rather than being cached as broken for the rest of the process.

## 1.1.2

### Patch Changes

- Allow custom endpoints and API keys in the provider menu and send session routing headers for OpenCode Go requests.

## 1.0.0

### Major Changes

- [#1](https://github.com/SURVERS/MultiAI-CLI/pull/1) [`f0bd77f`](https://github.com/SURVERS/MultiAI-CLI/commit/f0bd77fe233acb66c45b0f9d876c50f1776514a7) Thanks [@SURVERS](https://github.com/SURVERS)! - Rebrand the product as MultiAI CLI, including the `multiai` command, `~/.multiai` home, `.multiai/local.toml` workspace configuration, `MULTIAI_*` environment variables, package namespace, Web UI, and VS Code extension. Legacy Kimi settings and session history are no longer migrated.

  Replace managed Kimi authentication with MultiAI OAuth using Authorization Code with PKCE, device authorization fallback, verified OpenID Connect ID tokens, secure refresh-token storage in the operating-system keyring, synchronized refresh rotation, session-only fallback, account snapshots, and explicit handling for revoked accounts, quota exhaustion, missing scopes, and rate limits.

  Discover managed `multiai/*` models dynamically from the MultiAI model catalog and route them through their compatible OpenAI protocol. Disable the former Kimi CDN, marketplace, telemetry, feedback, and managed search/fetch integrations while retaining Kimi as an external model provider.

- Replace Chinese localization with Russian across the bundled web UI and documentation. Select Russian from the language menu to use it.

### Minor Changes

- [`f4407c6`](https://github.com/SURVERS/MultiAI-CLI/commit/f4407c645add04f1f27bd55110043a91265bffb2) Thanks [@SURVERS](https://github.com/SURVERS)! - Remove the 50 MB size limit on file uploads to the built-in server, so large attachments (for example in the web UI) no longer fail with an upload-too-large error. Uploads now stream to disk instead of being buffered in memory.

### Patch Changes

- Add a richer account profile, import model context limits, and hide non-chat models from the managed catalog. Run `multiai profile` or `/profile` to view account usage.

- [#1](https://github.com/SURVERS/MultiAI-CLI/pull/1) [`4eca10c`](https://github.com/SURVERS/MultiAI-CLI/commit/4eca10c934dd6827efe08e1470590ef9e071a729) Thanks [@SURVERS](https://github.com/SURVERS)! - Add an Approve all choice to tool confirmations that enables automatic tool approval for the active session.

- Keep an assistant message in one block when the model interleaves text and tool calls, so a sentence split by a tool call is no longer shown as two separate messages below the tool card.

- [`f4407c6`](https://github.com/SURVERS/MultiAI-CLI/commit/f4407c645add04f1f27bd55110043a91265bffb2) Thanks [@SURVERS](https://github.com/SURVERS)! - Add an internal bash parsing capability that turns shell command strings into syntax trees, in preparation for per-command permission analysis. No user-facing behavior change yet.

- [#1](https://github.com/SURVERS/MultiAI-CLI/pull/1) [`4eca10c`](https://github.com/SURVERS/MultiAI-CLI/commit/4eca10c934dd6827efe08e1470590ef9e071a729) Thanks [@SURVERS](https://github.com/SURVERS)! - Fix managed Gemini reasoning levels and multi-step tool turns by preserving tool-call metadata and selecting the compatible protocol for each model.

- [#1](https://github.com/SURVERS/MultiAI-CLI/pull/1) [`4eca10c`](https://github.com/SURVERS/MultiAI-CLI/commit/4eca10c934dd6827efe08e1470590ef9e071a729) Thanks [@SURVERS](https://github.com/SURVERS)! - Refresh the managed model catalog during a session so newly enabled models appear and disabled models are removed safely.

- [#1](https://github.com/SURVERS/MultiAI-CLI/pull/1) [`4eca10c`](https://github.com/SURVERS/MultiAI-CLI/commit/4eca10c934dd6827efe08e1470590ef9e071a729) Thanks [@SURVERS](https://github.com/SURVERS)! - Replace the boxed startup banner with a large MultiAI wordmark and concise session details.

- [`f4407c6`](https://github.com/SURVERS/MultiAI-CLI/commit/f4407c645add04f1f27bd55110043a91265bffb2) Thanks [@SURVERS](https://github.com/SURVERS)! - Fail fast on quota/balance-exhausted HTTP 429 errors (e.g. Moonshot `exceeded_current_quota_error`, OpenAI `insufficient_quota`) instead of silently retrying for ~3 minutes. Transient rate-limit 429s keep the existing retry, backoff, and Retry-After behavior.

- [`f4407c6`](https://github.com/SURVERS/MultiAI-CLI/commit/f4407c645add04f1f27bd55110043a91265bffb2) Thanks [@SURVERS](https://github.com/SURVERS)! - web: Fix garbled line numbers in code blocks.

- web: Replace the MultiAI brand avatar with theme-aware light and dark logo assets.

_For earlier changes prior to v1.0.0, see repository commit history._
