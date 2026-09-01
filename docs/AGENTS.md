# Documentation Agent Guide

This repository uses VitePress for the documentation site. User-facing documentation lives under `docs/en/` and `docs/ru/`; every change must keep both locales synchronized.

## Structure

- English and Russian locales use mirrored paths and filenames under `docs/en/` and `docs/ru/`.
- Main sections are Guides, Customization, Configuration, Reference, and Release Notes.
- Navigation and sidebars are defined in `docs/.vitepress/config.ts`. Wire every new or renamed page for both locales.

## Source of truth and workflow

- The English changelog (`docs/en/release-notes/changelog.md`) is the source of truth and the Russian changelog is its complete translation.
- All other pages are mirrored English/Russian pairs with the same headings, section order, links, examples, and code blocks.
- Edit either locale, then update its mirror in the same change. Review both versions for completeness, terminology, and broken links.
- Before rewriting, understand the existing structure, identify reader needs, sketch the destination of every content block, and only then edit. Do not silently omit content.

## Readers and style

Write for technical users and for AI-tool users who may not know terminal jargon. Technical readers should complete a task in under five minutes; non-technical readers should be able to copy the steps and understand their purpose.

- Open every page and major section with a map sentence.
- Keep one idea per paragraph and use natural transitions instead of excessive subheadings.
- Explain unfamiliar terminology on first use. Russian explanations must be natural Russian, not transliterated English.
- Use ordered lists for sequential steps, unordered lists for parallel items, tables for multidimensional reference data, and prose for connected explanations.
- Link a concept on its first mention when another page explains it fully. Prefer anchors where appropriate.
- Keep filenames in kebab-case and identical between `en` and `ru`.
- Use backticks for flags, commands, arguments, paths, identifiers, field names and values, and keyboard shortcuts.
- Use hyphens in shortcuts (`Ctrl-C`, `Shift-Tab`), except when quoting literal product output.
- Specify a language for every fenced code block; natural-language prompt examples are the only exception.
- Use short callout titles. Russian categories are `Совет`, `Внимание`, `Примечание`, and `Опасно`; version categories are `Добавлено`, `Изменено`, and `Удалено`.

## Russian terminology

Use these translations consistently:

| English | Russian |
| --- | --- |
| agent | агент |
| main agent | основной агент |
| subagent | субагент |
| session | сеанс |
| context | контекст |
| prompt | запрос |
| system prompt | системный запрос |
| provider | провайдер |
| API key | ключ API |
| approval request | запрос подтверждения |
| slash command | команда с косой чертой |
| tool call | вызов инструмента |
| turn | ход |
| config file | файл конфигурации |
| environment variable | переменная окружения |
| keyboard shortcut | сочетание клавиш |
| changelog | журнал изменений |

Keep product and protocol names unchanged: MultiAI CLI, MultiAI for VS Code, MCP, Model Context Protocol, Agent Skills, Plan mode, YOLO mode, Thinking mode, Prompt Flow, OAuth, JSON, JSONL, Node.js, TypeScript, npm, pnpm, macOS, and `multiai`. Use inline code for tool names such as `Read`, `Grep`, and `Bash`.

## MultiAI and external Kimi

Never mix MultiAI account services with Kimi as an external model provider.

| | MultiAI account | External Kimi / Moonshot provider |
| --- | --- | --- |
| Authentication | OAuth public client with PKCE | API key |
| Issuer / base URL | `https://multiai.store` | `https://api.moonshot.ai/v1` |
| Model aliases | `multiai/<model-id>` from `/v1/models` | Real Kimi model IDs |

MultiAI OAuth always uses `multiai.store`. Kimi is documented only as an external provider; preserve its model IDs, protocol names, and `KIMI_API_KEY` keys.

## Page structure

```markdown
# Title

Opening sentence and optional plain-language summary.

> Optional prerequisite or beta notice.

::: warning Short title
Important banner after the opening content and before the first H2.
:::

## First section

Body.

## Next steps

- [Page](/path) — what the reader can do there.
```

Do not add generic navigation callouts at page ends; VitePress already provides previous/next navigation. A focused `Next steps` section is allowed.

## Checklist

Before shipping, verify:

- `docs/en/` and `docs/ru/` have matching paths and complete content;
- Markdown structure, links, anchors, code blocks, and callout fences are valid;
- OAuth issuer is `https://multiai.store`;
- managed model aliases use `multiai/<model-id>`;
- login uses `/login`, not `/setup`;
- product names are MultiAI CLI and MultiAI for VS Code;
- external Kimi model IDs and protocol names remain unchanged;
- the documentation builds successfully.

## Build and preview

Run inside `docs/`:

```sh
npm install
npm run dev
npm run build
npm run preview
```

The build output is `docs/.vitepress/dist`. Use the `sync-changelog` skill for changelog generation and keep its English/Russian outputs mirrored.
