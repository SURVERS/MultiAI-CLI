---
'multiai-cli': minor
---

feat(provider): direct custom-provider registration via `multiai provider set`

- Register any OpenAI-compatible or Anthropic endpoint directly: `multiai provider set <id> --base-url <url> --api-key <key> [--wire anthropic]`
- Model metadata (context window, output limit, modalities, reasoning efforts) is enriched automatically from the provider's own `/v1/models` response with a models.dev fallback — mirroring the Desktop IDE enrichment
- Repeatable `--model <id>`, `--default-model <modelId>` and `--no-enrich` (offline) options
