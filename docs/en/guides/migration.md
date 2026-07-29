# Legacy data

MultiAI CLI starts with a new product identity, command, package namespace, and home
directory. It does not import settings or history from Kimi Code or `kimi-cli`.

::: warning Removed
The legacy migration workspace and the `migrate` command are not included in MultiAI CLI
1.0.0.
:::

## What MultiAI CLI uses

New data is written only to MultiAI locations:

- global data and configuration: `~/.multiai`;
- workspace configuration: `.multiai/local.toml`;
- command: `multiai`;
- environment variables: `MULTIAI_*`.

The former `kimi` command, `~/.kimi-code`, `.kimi-code/local.toml`, and product-level
`KIMI_*` settings are not aliases and are not read.

## Legacy credential cleanup

On first launch, MultiAI CLI checks only
`~/.kimi-code/credentials/kimi-code.json`. If it is recognized as the former managed
OAuth credential file, it is deleted so an obsolete plaintext token is not left behind.

No other file or directory under `~/.kimi-code` is modified. Keep, archive, or remove
that directory yourself after confirming that you no longer need the old application.

## Set up MultiAI

Install MultiAI CLI, then sign in as a new native OAuth client:

```sh
multiai login
```

Configure custom providers and local plugins again under `~/.multiai`. MultiAI keeps
support for the external Kimi model provider, but that provider is separate from the
removed Kimi product account and migration flow. For account setup and token behavior,
read [OAuth and account](./account-and-oauth.md).
