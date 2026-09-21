---
"multiai-cli": patch
---

Honor model output-token limits from managed and custom provider catalogs across Anthropic, OpenAI, OpenAI Responses, and Google GenAI requests. Refresh managed MultiAI metadata even when model IDs are unchanged, and keep catalog limits as mandatory ceilings over user-configured budgets.
