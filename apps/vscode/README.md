# MultiAI CLI

AI coding assistant for VS Code, built for long-context workflows and complex coding tasks.

## Features

- **Works alongside you**: MultiAI autonomously explores your codebase, reads and writes code, and runs terminal commands with your permission
- **Thinking controls**: Toggle reasoning or choose a model-supported thinking effort
- **Provider-aware models**: Distinguish and select same-named models across configured providers
- **Native editor integration**: Review AI-proposed changes directly in VS Code's diff viewer
- **MCP support**: Extend capabilities with Model Context Protocol servers
- **Slash commands**: Quick actions like `/init` to analyze your project and `/compact` to manage context

## Install

MultiAI CLI requires VS Code 1.100.0 or later.

1. Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=multiai.multiai-vscode)
2. Open a folder in VS Code
3. Click the MultiAI icon in the Activity Bar
4. Sign in with your MultiAI account, or use a provider already configured in the shared `config.toml`

The extension runs the MultiAI CLI Node SDK in the VS Code Extension Host. When
the extension and the MultiAI CLI terminal app resolve to the same
`MULTIAI_HOME`, they share `config.toml`, MCP configuration, login state, and
sessions. The system-level `MULTIAI_HOME` environment variable is supported;
there is no separate VS Code setting for it. Do not run the same session from
both applications at the same time, because cross-process session locking is
not guaranteed.

## Docs

See the [MultiAI CLI documentation](https://github.com/SURVERS/MultiAI-CLI/tree/main/docs).

## License

[Apache-2.0](LICENSE)
