# @multiai/acp-adapter

Agent Client Protocol adapter for MultiAI CLI. Exposes the MultiAI agent over the [Agent Client Protocol](https://agentclientprotocol.com/) so ACP-compatible clients can drive a MultiAI session over stdio.

Part of the [MultiAI CLI](https://github.com/SURVERS/MultiAI-CLI) monorepo.

## Minimum usage

```ts
import { createMultiAIHarness } from '@multiai/sdk';
import { runAcpServer } from '@multiai/acp-adapter';

const harness = await createMultiAIHarness();
await runAcpServer(harness);
```

`runAcpServer` reads JSON-RPC from `process.stdin`, writes to `process.stdout`, and resolves when the client closes the connection. SIGINT and SIGTERM trigger a graceful drain that calls `harness.close()` before the process exits.

See `docs/zh/reference/kimi-acp.md` for the full capability matrix (which `Agent` methods are wired, which extensions are stubbed, image / MCP support) and `docs/zh/guides/ides.md` for Zed and JetBrains setup.

## License

MIT
