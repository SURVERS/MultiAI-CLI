import { ErrorCodes } from '@multiai/sdk';

export const PRODUCT_NAME = 'MultiAI CLI';
export const CLI_COMMAND_NAME = 'multiai';
export const PROCESS_NAME = 'multiai-cli';

// Used in telemetry app names and HTTP User-Agent headers.
export const CLI_USER_AGENT_PRODUCT = 'multiai-cli';
export const CLI_UI_MODE = 'shell';
// UI mode for the `multiai web` host.
// as the CLI (CLI_USER_AGENT_PRODUCT); the surface is distinguished by ui_mode.
export const WEB_UI_MODE = 'web';

// Give telemetry a short flush window without making CLI exit feel stuck.
export const CLI_SHUTDOWN_TIMEOUT_MS = 3000;

// Upper bound on headless (`multiai -p`) shutdown. A wedged cleanup step (e.g. a
// SessionEnd hook, an MCP shutdown, or a connection blackholed by a restrictive
// firewall) must not keep a completed run alive indefinitely — once this elapses
// we stop waiting on cleanup and let the run return.
export const PROMPT_CLEANUP_TIMEOUT_MS = 8000;

// Grace after a headless run has fully completed (turn done, cleanup attempted)
// before force-exiting. `multiai -p` otherwise relies on the event loop draining to
// exit; a stray ref'd handle (socket/timer/child) left over from the run would
// wedge it. The guard timer is unref'd, so a healthy run still exits naturally
// well before this fires.
export const HEADLESS_FORCE_EXIT_GRACE_MS = 2000;

// Max time to wait for buffered stdout/stderr to flush before arming the
// force-exit fallback. A slow/piped consumer's still-draining stdio is a
// legitimate ref'd handle — flushing first prevents the fallback from
// truncating completed output. Bounded so a permanently-stuck consumer can't
// re-introduce the hang.
export const HEADLESS_STDIO_DRAIN_TIMEOUT_MS = 10000;

// Published npm package name; this can differ from the executable command.
export const NPM_PACKAGE_NAME = '@multiai/cli';

// App-owned data paths. SDK/core runtime config is intentionally not routed here.
export const MULTIAI_HOME_ENV = 'MULTIAI_HOME';
export const MULTIAI_DATA_DIR_NAME = '.multiai';
export const MULTIAI_LOG_DIR_NAME = 'logs';
export const MULTIAI_CACHE_DIR_NAME = 'cache';
export const MULTIAI_UPDATE_DIR_NAME = 'updates';
export const MULTIAI_BIN_DIR_NAME = 'bin';
export const MULTIAI_UPDATE_STATE_FILE_NAME = 'latest.json';
export const MULTIAI_UPDATE_INSTALL_STATE_FILE_NAME = 'install.json';
export const MULTIAI_UPDATE_INSTALL_LOCK_FILE_NAME = 'install.lock';
export const MULTIAI_UPDATE_ROLLOUT_LOG_FILE_NAME = 'rollout.log';
export const MULTIAI_PLUGIN_UPDATE_NOTICE_STATE_FILE_NAME = 'plugin-notices.json';
export const MULTIAI_INPUT_HISTORY_DIR_NAME = 'user-history';
export const MULTIAI_BANNER_DIR_NAME = 'banner';
export const MULTIAI_BANNER_STATE_FILE_NAME = 'state.json';

// Managed MultiAI auth provider key shared with OAuth/SDK config.
export const DEFAULT_OAUTH_PROVIDER_NAME = 'managed:multiai';

// SDK/core error code that tells the TUI to show a login-required startup
// notice. Derived from sdk's ErrorCodes so a future rename in core
// auto-propagates instead of silently breaking the startup recovery path.
export const OAUTH_LOGIN_REQUIRED_CODE = ErrorCodes.AUTH_LOGIN_REQUIRED;

export const MULTIAI_GITHUB_REPOSITORY_URL = 'https://github.com/SURVERS/MultiAI-CLI';
export const MULTIAI_GITHUB_RELEASES_URL = `${MULTIAI_GITHUB_REPOSITORY_URL}/releases`;
export const MULTIAI_GITHUB_LATEST_RELEASE_URL = `${MULTIAI_GITHUB_RELEASES_URL}/latest`;
/** @deprecated No built-in marketplace is configured. */
export const MULTIAI_PLUGIN_MARKETPLACE_URL = '';
export const MULTIAI_PLUGIN_MARKETPLACE_URL_ENV = 'MULTIAI_PLUGIN_MARKETPLACE_URL';
export const QUOTA_CONSUMING_PLUGIN_IDS: readonly string[] = [];
export const MULTIAI_OFFICIAL_INSTALL_URL = MULTIAI_GITHUB_RELEASES_URL;

// Kept for compatibility with diagnostics helpers; no in-app feedback command
// is registered and no MultiAI feedback backend is called.
export const FEEDBACK_ISSUE_URL = `${MULTIAI_GITHUB_REPOSITORY_URL}/issues`;
export const FEEDBACK_VERSION_PREFIX = 'multiai-cli-';
export const FEEDBACK_TELEMETRY_EVENT = 'feedback_submitted';
