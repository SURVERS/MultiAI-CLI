# Agent Skills

Agent Skills — лёгкий механизм расширения возможностей моделей в MultiAI CLI. Skill представляет собой документ Markdown с YAML frontmatter, описывающий специализированную область знаний или рабочий процесс: например, правила оформления кода проекта, порядок проверки PR или формат сообщения коммита.

Вместо многократной вставки одних и тех же инструкций в запрос Skills позволяют хранить содержимое в файле, повторно использовать его в разных проектах и командах, мгновенно загружать командой с косой чертой и автоматически вызывать моделью при необходимости.

## Создание Skill

Файлы Skill должны находиться в одном из [известных сканируемых каталогов](#расположение-skill). Поддерживаются две структуры:

- **В виде каталога (рекомендуется)**: создайте подкаталог в каталоге Skills, назовите основной файл `SKILL.md`, а скрипты, справочные материалы и другие вспомогательные файлы поместите рядом. Если в одном каталоге существуют и `<name>/SKILL.md`, и одноимённый `<name>.md`, приоритет получает подкаталог.
- **В виде отдельного файла**: используйте непосредственно один файл `.md`; именем Skill станет имя файла без `.md`.

### Формат файла

`SKILL.md` состоит из двух частей: YAML frontmatter и тела Markdown:

```markdown
---
name: code-style
description: Project code style guidelines defining naming, indentation, comments, and file organization
type: prompt
whenToUse: When the user asks me to write, modify, or review project source code
disableModelInvocation: false
arguments:
  - target
  - mode
---

Please handle code according to the following guidelines:

- Use 2-space indentation
- Variable names use `camelCase`, type names use `PascalCase`
- Public functions must have TSDoc comments
- Lines must not exceed 100 characters
```

### Поля frontmatter

| Поле | Описание |
| --- | --- |
| `name` | Имя Skill. Обязательно для `SKILL.md` в каталоге; если оно отсутствует в отдельном файле `.md`, используется имя файла. Регистр не учитывается |
| `description` | Краткое описание в одну строку; по нему модель решает, когда использовать Skill. Обязательно для `SKILL.md` в каталоге; если оно отсутствует в отдельном `.md`, используется первая непустая строка тела (не более 240 символов) |
| `type` | Тип Skill: `prompt` (по умолчанию), `inline` (с той же семантикой, что у `prompt`) или `flow` (только ручной вызов, автоматический вызов моделью недоступен). Другие значения пропускаются |
| `whenToUse` | Описание условий запуска Skill. Также принимаются `when-to-use` и `when_to_use` |
| `disableModelInvocation` | Значение `true` запрещает модели автоматически вызывать этот Skill. Также принимаются `disable-model-invocation` и `disable_model_invocation` |
| `arguments` | Список именованных параметров; можно записать как массив строк или строку с разделением пробелами (например, `arguments: target mode`). После объявления параметры доступны в теле как `$<name>` |

::: warning Примечание
В каталожном `SKILL.md` необходимо явно указать и `name`, и `description`. Отсутствие любого из них приведёт к ошибке разбора.
:::

### Заполнители в теле

Перед отправкой тела модели раскрывается небольшой набор заполнителей:

- `$ARGUMENTS`: полная исходная строка аргументов, переданная при вызове.
- `$ARGUMENTS[0]`, `$ARGUMENTS[1]` и сокращения `$0`, `$1`: позиционные аргументы после разделения по пробелам (нумерация с нуля).
- `$<name>`: именованные параметры, объявленные в `arguments`.
- `${MULTIAI_SKILL_DIR}`: каталог, содержащий текущий файл Skill.

Позиционные аргументы поддерживают одинарные и двойные кавычки, поэтому в `/skill:commit "fix login" patch` значение `$0` раскроется в `fix login`. Если тело не содержит заполнителей аргументов, переданный при вызове текст добавляется в конец тела как `\n\nARGUMENTS: <text>`.

## Расположение Skill

MultiAI CLI сканирует четыре уровня; более конкретные уровни имеют больший приоритет: **Проект > Пользователь > Дополнительные каталоги > Встроенные**.

**Уровень пользователя** (для всех проектов):
- `$MULTIAI_HOME/skills/` (по умолчанию `~/.multiai/skills/`)
- `~/.agents/skills/`

Пользовательский каталог Skill для MultiAI перемещается вместе с `MULTIAI_HOME`, поэтому у изолированных корневых каталогов данных также будут отдельные Skills MultiAI. Универсальный каталог `~/.agents/skills/` остаётся в настоящем домашнем каталоге ОС и может совместно использоваться разными инструментами.

**Уровень проекта** (корень проекта — ближайший вышестоящий каталог с `.git`, поиск начинается из рабочего каталога):
- `.multiai/skills/`
- `.agents/skills/`

**Дополнительные каталоги**: задаются через `extra_skill_dirs` на верхнем уровне `config.toml`:

```toml
extra_skill_dirs = ["~/team-skills", ".agents/team-skills"]
```

**Встроенные Skills** поставляются с CLI и имеют самый низкий приоритет. Они предоставляют готовые рабочие процессы для распространённых задач: например, настройки серверов MCP, изменения темы TUI и редактирования файлов конфигурации. Полный список см. в разделе [«Встроенные команды Skill»](../reference/slash-commands.md#built-in-skill-commands).

## Вызов Skill

Пользователь может вручную вызвать Skill командой с косой чертой:

```
/skill:code-style
/skill:git-commits fix concurrency issue in login endpoint
```

Модель также может автоматически вызвать Skill на основании `description` и `whenToUse`, если только `disableModelInvocation` не равно `true`, а `type` — не `flow`. Допускается до трёх уровней вложенности вызовов Skill; более глубокие вызовы прекращаются.

## Полный пример

```markdown
---
name: review-pr
description: Review a Pull Request according to team standards and produce a structured review report
type: prompt
whenToUse: When the user asks me to review a PR, inspect code changes, or evaluate commit quality
arguments:
  - pr_ref
---

Please review the PR the user specified: $pr_ref

1. Fetch and read the full diff for `$pr_ref`.
2. Check each of the following items:
   - Whether corresponding test cases are included
   - Whether public API documentation has been updated
   - Whether new dependencies have been introduced; if so, state the reason
   - Whether error handling covers edge cases
3. Refer to the checklist in the same directory: `references/checklist.md`
4. Produce a review report containing:
   - Overall conclusion (approve / request changes / comment)
   - Required changes (blocking)
   - Suggested improvements (non-blocking)
   - Noteworthy positives
```

Сохраните этот файл как `$MULTIAI_HOME/skills/review-pr/SKILL.md` (или `~/.multiai/skills/review-pr/SKILL.md`, если `MULTIAI_HOME` не задан), а список проверок поместите в `references/checklist.md` в том же каталоге. После начала нового сеанса Skill можно вызвать командой `/skill:review-pr #1234`, где `#1234` подставится в `$pr_ref`.

## Что дальше

- [Плагины](./plugins.md) — упакуйте Skills в устанавливаемые модули, чтобы делиться ими с командой.
- [Агенты и субагенты](./agents.md) — узнайте, как Skills влияют на поведение субагентов.
