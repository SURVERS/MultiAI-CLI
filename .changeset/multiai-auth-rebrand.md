---
"@multiai/cli": major
---

Rebrand the product as MultiAI CLI, including the `multiai` command, `~/.multiai` home, `.multiai/local.toml` workspace configuration, `MULTIAI_*` environment variables, package namespace, Web UI, and VS Code extension. Legacy Kimi settings and session history are no longer migrated.

Replace managed Kimi authentication with MultiAI OAuth using Authorization Code with PKCE, device authorization fallback, verified OpenID Connect ID tokens, secure refresh-token storage in the operating-system keyring, synchronized refresh rotation, session-only fallback, account snapshots, and explicit handling for revoked accounts, quota exhaustion, missing scopes, and rate limits.

Discover managed `multiai/*` models dynamically from the MultiAI model catalog and send requests through the Responses API. Disable the former Kimi CDN, marketplace, telemetry, feedback, and managed search/fetch integrations while retaining Kimi as an external model provider.
