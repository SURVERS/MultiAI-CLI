# Файлы конфигурации

MultiAI CLI сохраняет долгосрочные настройки — выбранную модель, ключ API и число шагов агента за ход — в файлах TOML (текстовый формат конфигурации с понятной структурой). Изменения применяются при каждом запуске. Настройки агента и среды выполнения находятся в `config.toml`, а параметры TUI и клиента (тема, редактор, уведомления и автообновление) — в соседнем `tui.toml`.

Путь по умолчанию: `~/.multiai/config.toml`; файл создаётся автоматически при первом запуске.

## Расположение файла конфигурации

CLI читает конфигурацию из `~/.multiai/config.toml`. Чтобы перенести каталог данных, задай переменную окружения `MULTIAI_HOME`:

```sh
export MULTIAI_HOME=/path/to/multiai-home
```

Тогда путь станет `$MULTIAI_HOME/config.toml`. Имя файла всегда остаётся `config.toml`.

::: tip Совет
Имена полей TOML всегда записываются в snake_case, например `default_model` и `max_context_size`. Ключ с точкой нужно заключать в кавычки — например `[models."gpt-4.1"]`, — иначе TOML воспримет точку как разделитель вложенных таблиц.
:::

## Полный пример

Этот пример охватывает наиболее распространённые поля. Его можно скопировать и изменить:

```toml
default_model = "kimi/kimi-k2.5"
default_permission_mode = "manual"
default_plan_mode = false
merge_all_available_skills = true
telemetry = false

[providers.kimi]
type = "kimi"
base_url = "https://api.moonshot.ai/v1"

[providers.kimi.env]
KIMI_API_KEY = "YOUR_API_KEY"

[models."kimi/kimi-k2.5"]
provider = "kimi"
model = "kimi-k2.5"
max_context_size = 262144
capabilities = [ "thinking", "image_in", "tool_use" ]

[thinking]
enabled = true
effort = "high"
keep = "all"

[loop_control]
max_retries_per_step = 10
reserved_context_size = 50000

[background]
max_running_tasks = 4
keep_alive_on_exit = false

[[permission.rules]]
decision = "allow"
pattern = "Read"

[[permission.rules]]
decision = "deny"
pattern = "Bash(rm -rf*)"

[[hooks]]
event = "PreToolUse"
matcher = "Bash"
command = "node ~/.multiai/hooks/check-bash.mjs"
timeout = 5
```

Записи MultiAI OAuth не нужно создавать вручную. При входе добавляется провайдер `managed:multiai`, а из актуального каталога `/v1/models` создаются псевдонимы `multiai/<model-id>`. В неполных записях каталога могут отсутствовать длина контекста и возможности; CLI оставляет эти поля неопределёнными.

## Поля верхнего уровня

Поля делятся на **скалярные значения верхнего уровня**, управляющие поведением по умолчанию, и **вложенные таблицы** (`providers`, `models`, `thinking` и другие), описанные ниже.

| Поле | Тип | По умолчанию | Описание |
| --- | --- | --- | --- |
| `default_model` | `string` | — | Псевдоним модели по умолчанию; должен существовать в `models` |
| `default_permission_mode` | `string` | `manual` | Режим разрешений новых сеансов: `manual` (спрашивать каждый раз), `yolo` (автоматически разрешать инструменты, но агент ещё может задавать вопросы) или `auto` (полная автономность) |
| `default_plan_mode` | `boolean` | `false` | Запускать ли новые сеансы в Plan mode |
| `merge_all_available_skills` | `boolean` | `true` | Объединять ли Agent Skills из всех доступных каталогов |
| `extra_skill_dirs` | `array<string>` | — | Дополнительные каталоги поиска навыков |
| `extra_agent_dirs` | `array<string>` | — | Дополнительные каталоги пользовательских агентов |
| `telemetry` | `boolean` | `true` | Включена ли анонимная телеметрия; отключается только явным `false` |
| `providers` | `table` | `{}` | Провайдеры API → [`providers`](#providers) |
| `models` | `table` | — | Псевдонимы моделей → [`models`](#models) |
| `thinking` | `table` | — | Параметры Thinking mode → [`thinking`](#thinking) |
| `loop_control` | `table` | — | Управление циклом агента → [`loop_control`](#loop-control) |
| `background` | `table` | — | Фоновые задачи → [`background`](#background) |
| `tools` | `table` | — | Глобальный переключатель инструментов → [`tools`](#tools) |
| `image` | `table` | — | Сжатие изображений → [`image`](#image) |
| `services` | `table` | — | Встроенные внешние сервисы → [`services`](#services) |
| `permission` | `table` | — | Начальные правила разрешений → [`permission`](#permission) |
| `hooks` | `array<table>` | — | Хуки жизненного цикла; см. [Хуки](../customization/hooks.md) |

Ниже последовательно описаны все вложенные таблицы.

## `providers`

Каждая запись таблицы `providers` задаёт провайдер API с уникальным именем. CLI читает учётные данные только отсюда и **не** подхватывает переменные оболочки автоматически. Команда `export KIMI_API_KEY` не передаёт ключ провайдеру: его нужно явно записать в конфигурацию (см. [Переопределение конфигурации](./overrides.md#provider-credentials)).

| Поле | Тип | Обязательно | Описание |
| --- | --- | --- | --- |
| `type` | `string` | Да | Тип: `kimi`, `anthropic`, `openai`, `openai_responses`, `google-genai`, `vertexai`; управляемый провайдер MultiAI OAuth добавляется автоматически |
| `api_key` | `string` | Нет | Ключ API в открытом виде |
| `base_url` | `string` | Нет | Базовый URL API |
| `oauth` | `table` | Нет | Ссылка на учётные данные OAuth (`storage` и `key`), обычно добавляется при входе |
| `env` | `table<string, string>` | Нет | Резервный источник учётных данных |
| `custom_headers` | `table<string, string>` | Нет | Пользовательские HTTP-заголовки каждого запроса |

Во вложенной таблице **`env`** можно указать привычные ключи провайдера как резерв для `api_key` и `base_url`. Она читается **только из файла конфигурации** и не меняет окружение оболочки:

```toml
[providers.kimi.env]
KIMI_API_KEY = "sk-xxx"
KIMI_BASE_URL = "https://api.moonshot.ai/v1"
```

Приоритет: поле `api_key` > ключ таблицы `env` > ошибка запуска, если оба отсутствуют.

## `models`

Каждая запись `models` задаёт уникальный псевдоним модели, используемый в `default_model` или флаге `-m`.

| Поле | Тип | Обязательно | Описание |
| --- | --- | --- | --- |
| `provider` | `string` | Да | Имя провайдера из `providers` |
| `model` | `string` | Да | ID модели, отправляемый серверу |
| `max_context_size` | `integer` | Нет | Максимальный контекст в токенах, не меньше 1 |
| `max_input_size` | `integer` | Нет | Лимит ввода на запрос, если он меньше общего окна. Используется при уплотнении, проверке переполнения и расчёте долей; ограничивается `max_context_size` |
| `max_output_size` | `integer` | Нет | Лимит выходных токенов (`max_tokens`). Сейчас учитывается только `anthropic`; для Claude переопределяет встроенный максимум сервера |
| `capabilities` | `array<string>` | Нет | Возможности: `thinking`, `always_thinking`, `image_in`, `video_in`, `audio_in`, `tool_use`. Объединяются с найденными автоматически; удалить возможность нельзя |
| `support_efforts` | `array<string>` | Нет | Допустимые уровни усилий Thinking mode. Для `multiai` неподдерживаемое значение вызывает ошибку при выборе; при разрешении модели выполняется откат к `default_effort`. Kimi без поля использует `on`/`off`. Обновление каталога может переписать поле; закрепить его можно в `overrides` |
| `default_effort` | `string` | Нет | Усилия Thinking mode по умолчанию; для закрепления используй `overrides` |
| `off_effort` | `string` | Нет | Значение для отключения рассуждений, например `none` у xAI Grok |
| `base_url` | `string` | Нет | URL конкретной модели; имеет приоритет над URL провайдера и действует вместе с `protocol` |
| `display_name` | `string` | Нет | Имя в интерфейсе; иначе используется `model` |
| `reasoning_key` | `string` | Нет | Только `openai`: нестандартное имя поля рассуждений; обычно `reasoning_content`, `reasoning_details` и `reasoning` определяются автоматически |
| `adaptive_thinking` | `boolean` | Нет | Только `anthropic`: принудительное адаптивное мышление; без поля определяется по версии (Claude ≥ 4.6) |

Псевдоним с точкой заключай в кавычки:

```toml
[models."gpt-4.1"]
provider = "openai"
model = "gpt-4.1"
max_context_size = 1047576
```

### Переопределения модели

Используй `[models."<alias>".overrides]` для значений, которые должны пережить обновление каталога провайдера. Среда выполнения берёт переопределение, а при его отсутствии — поле верхнего уровня.

```toml
[models."kimi/kimi-k2.5"]
provider = "kimi"
model = "kimi-k2.5"
max_context_size = 262144

[models."kimi/kimi-k2.5".overrides]
max_context_size = 131072
display_name = "Kimi K2.5 (custom)"
```

Поддерживаются обычные поля модели: `max_context_size`, `max_input_size`, `max_output_size`, `capabilities`, `display_name`, `reasoning_key`, `adaptive_thinking`, `support_efforts`, `default_effort`, `off_effort`. Поля идентификации и маршрутизации `provider`, `model`, `protocol`, `beta_api`, `base_url` не поддерживаются.

Модель можно временно задать переменными `MULTIAI_MODEL_*`: CLI создаст провайдер в памяти до перезапуска. См. [Определение модели через переменные окружения](./env-vars.md#определение-модели-через-переменные-окружения-multiai-model).

## `secondary_model`

Вторичная модель — второй указатель рядом с `default_model`, обычно на более дешёвую модель. Сейчас её используют новые субагенты (`Agent` / `AgentSwarm`) вместо наследования модели основного агента. Основной агент может выбрать при запуске `"secondary"` или `"primary"`. Без настройки субагенты наследуют основную модель.

Функция экспериментальная и по умолчанию отключена. Для `multiai web` включи `MULTIAI_EXPERIMENTAL_SECONDARY_MODEL=1`. В `multiai -p` переменная `MULTIAI_EXPERIMENTAL_FLAG=1`, необходимая движку v2, также включает функцию. Интерактивный TUI её игнорирует.

| Поле | Тип | По умолчанию | Описание |
| --- | --- | --- | --- |
| `model` | `string` | — | ID из настроенной таблицы `[models]` любого провайдера |
| `default_effort` | `string` | — | Усилия Thinking mode субагентов. Без значения разрешаются естественно: глобальный `[thinking]`, затем значение модели. Для строгих моделей неподдерживаемое значение заменяется значением по умолчанию |
| Другие поля | — | — | Любые поля [`[models."<alias>".overrides]`](#models), применяемые только к субагентам |

Все поля, кроме `model`, образуют патч. При наличии патча среда создаёт производную модель в памяти, объединяя его с `overrides` (патч имеет приоритет). Без патча используется исходная модель. Производная запись не сохраняется и скрыта из списков выбора.

```toml
[secondary_model]
model = "multiai/kimi-k2.5"
default_effort = "low"
max_output_size = 8192
```

`MULTIAI_SECONDARY_MODEL` и `MULTIAI_SECONDARY_EFFORT` имеют приоритет над `model` и `default_effort`.

При включённом эксперименте конфигурация проверяется при запуске. Неизвестная модель или недопустимое усилие создаёт предупреждение, но окончательная ошибка возникает только при запуске субагента и содержит подсказку об источнике.

## `thinking`

`thinking` задаёт глобальное поведение Thinking mode.

| Поле | Тип | По умолчанию | Описание |
| --- | --- | --- | --- |
| `enabled` | `boolean` | `true` | Включать Thinking mode в новых сеансах |
| `effort` | `string` | — | Уровень `low`, `medium`, `high`, `xhigh` или `max`. Не-Kimi провайдеры передают поддерживаемые протоколом значения без преобразования; Kimi со списком `support_efforts` откатывается к значению модели, а без списка воспринимает включение как `on` |
| `keep` | `string` | `"all"` | Сохранение рассуждений. Для `multiai` отправляется как `thinking.keep`, для `anthropic` — как правка `context_management` `clear_thinking_20251015`. `"all"` сохраняет рассуждения прошлых ходов; `false`/`0`/`no`/`off`/`none`/`null` отключают. Переопределяется `MULTIAI_MODEL_THINKING_KEEP` и отправляется только при включённом Thinking mode |

### Устаревшие поля

| Поле | Устарело с версии | Описание |
| --- | --- | --- |
| `default_thinking` | 0.21.0 | Заменено `[thinking] enabled`: перенеси значение в `enabled` |
| `thinking.mode` | 0.21.0 | `off` заменяется `enabled = false`; `on` и `auto` равны `enabled = true` и могут быть удалены |

## `loop_control`

`loop_control` управляет числом шагов, повторами и порогом автоматического уплотнения контекста.

| Поле | Тип | По умолчанию | Описание |
| --- | --- | --- | --- |
| `max_steps_per_turn` | `integer` | — | Максимум шагов за ход; отсутствие или `0` снимает ограничение |
| `max_retries_per_step` | `integer` | `10` | Максимум повторов после ошибки шага |
| `reserved_context_size` | `integer` | — | Токены, резервируемые под ответ; при меньшем остатке запускается уплотнение |

`MULTIAI_LOOP_MAX_STEPS_PER_TURN` и `MULTIAI_LOOP_MAX_RETRIES_PER_STEP` имеют приоритет над соответствующими полями.

Повторы применяются только к временным сбоям: ошибкам подключения, тайм-аутам, HTTP 429 и 5xx. Ответ 429 из-за исчерпанной квоты или баланса не повторяется.

## `background`

`background` управляет параллельностью фоновых задач, запущенных через `Bash` или параметр `run_in_background=true` инструмента `Agent`.

| Поле | Тип | По умолчанию | Описание |
| --- | --- | --- | --- |
| `max_running_tasks` | `integer` | — | Максимум одновременно выполняемых задач |
| `keep_alive_on_exit` | `boolean` | `false` | Сохранять задачи после закрытия сеанса. В режиме печати служит устаревшим резервом: `true` соответствует `print_background_mode = "drain"` |
| `kill_grace_period_ms` | `integer` | `5000` | Льготный период завершения после закрытия, остановки или тайм-аута; затем выполняется принудительная остановка |
| `bash_auto_background_on_timeout` | `boolean` | `true` | Переносить ли просроченную команду `Bash` в фон вместо завершения |
| `bash_task_timeout_s` | `integer` | `600` | Тайм-аут фоновых `Bash` без явного `timeout`; `0` снимает ограничение. В `multiai -p` по умолчанию `0` |
| `print_background_mode` | `"exit" \| "drain" \| "steer"` | `"steer"` | Только `multiai -p`: `exit` завершает сразу, `drain` ждёт задачи без возврата результатов агенту, `steer` передаёт завершения как синтетические сообщения и запускает новые ходы |
| `print_wait_ceiling_s` | `integer` | `315360000` | Максимальное время цикла ожидания в `drain`/`steer` (10 лет, практически без ограничения) |
| `print_max_turns` | `integer` | `100000` | Максимум новых ходов от завершений фоновых задач в режиме `steer` |

`MULTIAI_BACKGROUND_KEEP_ALIVE_ON_EXIT` и `MULTIAI_BACKGROUND_MAX_RUNNING_TASKS` имеют приоритет над файлом.

В режиме `multiai -p "<prompt>"` CLI по умолчанию работает, пока остаются фоновые задачи: их результаты направляют основного агента в новые ходы, а выполнение завершается, когда ожидающих задач нет. Цикл ограничен `print_wait_ceiling_s` и `print_max_turns`. Фоновые `Bash` и субагенты по умолчанию не имеют тайм-аута. Выбери `drain`, чтобы только дождаться задач, или `exit`, чтобы завершиться вместе с основным агентом.

## `subagent`

| Поле | Тип | По умолчанию | Описание |
| --- | --- | --- | --- |
| `timeout_ms` | `integer` | `7200000` (2 часа) | Максимальное время одного субагента `Agent` / `AgentSwarm`; `0` снимает ограничение. Действует для фоновых и обычных субагентов. В `multiai -p` по умолчанию `0`; значения выше `2147483647` ограничиваются примерно 24,8 дня |

`MULTIAI_SUBAGENT_TIMEOUT_MS` имеет приоритет над `timeout_ms`.

## `mcp`

| Поле | Тип | По умолчанию | Описание |
| --- | --- | --- | --- |
| `startup_timeout_ms` | `integer` | `30000` (30 секунд) | Общий тайм-аут подключения и обнаружения инструментов MCP, от `1` до `2147483647`; серверный `startupTimeoutMs` в `mcp.json` имеет высший приоритет |
| `tool_timeout_ms` | `integer` | `60000` (60 секунд) | Общий тайм-аут одного вызова MCP; серверный `toolTimeoutMs` имеет высший приоритет |

`MULTIAI_MCP_STARTUP_TIMEOUT_MS` и `MULTIAI_MCP_TOOL_TIMEOUT_MS` переопределяют поля `config.toml`. Полную настройку см. в разделе [MCP](../customization/mcp.md).

## `tools`

`tools` — глобальный переключатель, действующий для всех агентов и пересекающийся с политиками `tools` / `disallowedTools` конкретного агента.

| Поле | Тип | По умолчанию | Описание |
| --- | --- | --- | --- |
| `enabled` | `array<string>` | — | Глобальный список разрешённых инструментов; отсутствие или пустой массив не ограничивает |
| `disabled` | `array<string>` | — | Глобальный список запретов, применяемый после `enabled` |

Встроенные инструменты сопоставляются по точному имени (`Read`), MCP — по шаблонам (`mcp__github__*`). Предупреждение выдаётся для трёх бесполезных форм: `*` вне шаблона `mcp__`, литерала `mcp__github` без сегмента инструмента и неизвестного имени. Регистр учитывается.

```toml
[tools]
disabled = ["EnterPlanMode", "ExitPlanMode", "mcp__github__*"]
```

::: warning Примечание
Как и поля агента `tools` / `disallowedTools`, эта секция формирует список инструментов модели и повторно проверяется перед выполнением. [Правила разрешений](#permission) отдельно управляют операциями, требующими подтверждения.
:::

## `image`

`image` управляет сжатием изображений из всех источников: вставки, `ReadMediaFile`, результатов MCP и других.

| Поле | Тип | По умолчанию | Описание |
| --- | --- | --- | --- |
| `max_edge_px` | `integer` | `2000` | Максимальная длина стороны в пикселях; большие изображения уменьшаются пропорционально |
| `read_byte_budget` | `integer` | `262144` (256 КБ) | Лимит на изображение, самостоятельно читаемое моделью. `region` и `full_resolution` не ограничиваются этим бюджетом |

`MULTIAI_IMAGE_MAX_EDGE_PX` и `MULTIAI_IMAGE_READ_BYTE_BUDGET` имеют приоритет.

<!--
## `experimental`

`experimental` хранит постоянные переопределения экспериментальных функций. Сейчас пользовательское поле только одно: `micro_compaction`, по умолчанию `false`; значение `true` включает обрезку старых крупных результатов инструментов.

| Поле | Тип | По умолчанию | Описание |
| --- | --- | --- | --- |
| `micro_compaction` | `boolean` | `false` | Удалять старые крупные результаты инструментов из контекста, сохраняя недавний диалог |
-->

## `services`

`services` настраивает пользовательские точки веб-поиска (`moonshot_search`) и загрузки страниц (`moonshot_fetch`). Вход MultiAI не создаёт эти сервисы и не передаёт им OAuth. Распознаются только эти два фиксированных ключа совместимости.

| Поле | Тип | Обязательно | Описание |
| --- | --- | --- | --- |
| `base_url` | `string` | Нет | URL API сервиса |
| `api_key` | `string` | Нет | Ключ API |
| `oauth` | `table` | Нет | Ссылка OAuth той же структуры, что `providers.*.oauth` |
| `custom_headers` | `table<string, string>` | Нет | Пользовательские HTTP-заголовки |

Переменные имеют приоритет: `MULTIAI_WEB_SEARCH_BASE_URL` / `MULTIAI_WEB_SEARCH_API_KEY` для `moonshot_search`, `MULTIAI_WEB_FETCH_BASE_URL` / `MULTIAI_WEB_FETCH_API_KEY` для `moonshot_fetch`. URL из окружения задаёт отдельную точку, куда сохранённые ключ, OAuth и заголовки не передаются. Ключ из окружения без URL сохраняет настроенную точку и заголовки, но заменяет обе формы учётных данных. URL и ключ могут включить сервис без секции конфигурации.

```toml
[services.moonshot_search]
base_url = "https://api.moonshot.cn/v1/search"
api_key = "sk-xxx"

[services.moonshot_fetch]
base_url = "https://api.moonshot.cn/v1/fetch"
api_key = "sk-xxx"
```

## `permission`

`permission` задаёт загружаемые при старте правила разрешений. Массив таблиц `[[permission.rules]]` проверяется по порядку; действует первое совпадение.

| Поле | Тип | Обязательно | Описание |
| --- | --- | --- | --- |
| `decision` | `string` | Да | `allow` — разрешить, `deny` — запретить, `ask` — спрашивать каждый раз |
| `scope` | `string` | Нет | Область: `turn-override`, `session-runtime`, `project`, `user`; по умолчанию `user` |
| `pattern` | `string` | Да | `ToolName` или `ToolName(arg-pattern)`, например `Read` или `Bash(rm -rf*)` |
| `reason` | `string` | Нет | Описание для отладки и аудита |

Имена приведены в разделе [Встроенные инструменты](../reference/tools.md). Большинство инструментов сами задают предмет сопоставления аргументов, например `Bash(command-pattern)` и `Read(path-pattern)`. `AgentSwarm`, MCP и пользовательские инструменты сопоставляются только по имени.

```toml
[[permission.rules]]
decision = "allow"
pattern = "Read"

[[permission.rules]]
decision = "allow"
pattern = "Grep"

[[permission.rules]]
decision = "deny"
pattern = "Bash(rm -rf*)"

[[permission.rules]]
decision = "ask"
pattern = "Bash"
```

::: tip Совет
MCP-серверы настраиваются в `~/.multiai/mcp.json` или проектном `.multiai/mcp.json`, а не в `config.toml`. Интерактивная команда — `/mcp-config`; см. [Model Context Protocol](../customization/mcp.md).
:::

## `tui.toml`

Рядом с `config.toml` CLI хранит параметры TUI и клиента в `tui.toml` (`~/.multiai/tui.toml` или `$MULTIAI_HOME/tui.toml`). Файл создаётся при первом запуске, а команды `/config`, `/theme` и `/editor` меняют его автоматически. При ошибке синтаксиса CLI использует значения по умолчанию и показывает уведомление вместо отказа запуска.

| Поле | Тип | По умолчанию | Описание |
| --- | --- | --- | --- |
| `theme` | `string` | `auto` | `auto`, `dark`, `light` или имя [пользовательской темы](../customization/themes) |
| `disable_paste_burst` | `boolean` | `false` | Отключить резервную обработку быстрой многострочной вставки без bracketed paste |
| `[editor].command` | `string` | `""` | Команда внешнего редактора; пустое значение использует `$VISUAL` / `$EDITOR` |
| `[notifications].enabled` | `boolean` | `true` | Отправлять уведомления рабочего стола |
| `[notifications].notification_condition` | `string` | `unfocused` | `unfocused` — только без фокуса терминала, `always` — всегда |
| `[upgrade].auto_install` | `boolean` | `true` | Устанавливать новые версии автоматически |

```toml
# ~/.multiai/tui.toml
theme = "auto" # "auto" | "dark" | "light" | custom theme name
disable_paste_burst = false # true disables non-bracketed paste-burst fallback

[editor]
command = "" # empty uses $VISUAL / $EDITOR

[notifications]
enabled = true
notification_condition = "unfocused" # "unfocused" | "always"

[upgrade]
auto_install = true
```

Изменения применяются при следующем запуске или сразу через `/reload-tui` (только `tui.toml`); `/reload` перечитывает оба файла.

## Локальная конфигурация проекта

Кроме пользовательских файлов в `~/.multiai`, MultiAI CLI читает `<project-root>/.multiai/local.toml`. Здесь хранятся параметры конкретной копии проекта, которые обычно не следует передавать коллегам.

Файл автоматически создаётся, когда в [`/add-dir`](../reference/slash-commands.md) добавляется каталог и выбирается сохранение для проекта. Вручную редактировать его обычно не нужно.

### `[workspace]`

Таблица `[workspace]` объединяет настройки рабочего пространства проекта:

| Поле | Тип | Обязательно | Описание |
| --- | --- | --- | --- |
| `additional_dir` | `array<string>` | Нет | Дополнительные рабочие каталоги с абсолютными путями. Автоматически записываются после подтверждения в `/add-dir` и загружаются при запуске |

```toml
[workspace]
additional_dir = ["/absolute/path/to/shared"]
```

Поскольку абсолютные пути зависят от компьютера, рекомендуем добавить `.multiai/local.toml` в `.gitignore` проекта.

## Что дальше

- [Провайдеры и модели](./providers.md) — примеры подключения Kimi, Claude, OpenAI и Gemini.
- [Переопределение конфигурации](./overrides.md) — приоритет параметров CLI, файла конфигурации и переменных окружения.
- [Переменные окружения](./env-vars.md) — полный список переменных времени выполнения, включая `MULTIAI_HOME`.
