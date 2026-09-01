# Провайдеры и модели

MultiAI CLI поддерживает одновременное подключение к нескольким LLM-платформам: управляемым моделям MultiAI через OAuth, Kimi как внешнему провайдеру, Claude с ключом API Anthropic и сторонним сервисам инференса через совместимые протоколы.

## Поддерживаемые типы провайдеров

Поле `type` в таблице `providers` определяет используемую реализацию протокола:

| Тип | Протокол | Типичное применение |
| --- | --- | --- |
| `kimi` | Совместимый с OpenAI | Ключ API Kimi / Moonshot |
| `anthropic` | Anthropic Messages | Семейство моделей Claude |
| `openai` | OpenAI Chat Completions | OpenAI и совместимые сервисы, DeepSeek, Qwen и т. д. |
| `openai_responses` | OpenAI Responses API | Новый интерфейс Responses от OpenAI |
| `google-genai` | Google GenAI | Gemini API |
| `vertexai` | Google GenAI в Vertex | Google Cloud Vertex AI |

По умолчанию все провайдеры общаются с моделями в потоковом режиме. Такие возможности, как Thinking, компьютерное зрение и использование инструментов, автоматически определяются по префиксу имени модели; обычно объявлять их вручную не требуется.

**Приоритет учётных данных**: прямое поле `api_key` > ключ в подразделе `[providers.<name>.env]` > если отсутствуют оба, запуск завершается ошибкой. CLI не берёт резервные учётные данные из переменных окружения оболочки; см. [Переопределение конфигурации: учётные данные провайдеров](./overrides.md#provider-credentials).

## `/provider` — интерактивное управление провайдерами

Не хотите редактировать TOML вручную? Введите `/provider` в TUI, чтобы открыть **менеджер провайдеров**, где можно интерактивно добавлять и удалять провайдеров.

Менеджер показывает список провайдеров, сгруппированный по источнику. Навигация:

- ↑/↓ перемещают курсор, ←/→ листают страницы.
- `d` удаляет текущего провайдера (с подтверждением `[y/N]`).
- Enter на строке `[ Add New Platform ]` добавляет нового провайдера.

При добавлении доступны два пути:

- **Известный сторонний провайдер**: загружает каталог моделей с [models.dev](https://models.dev/); выберите провайдера → введите ключ API → выберите модель по умолчанию. Поставщики, для которых в каталоге не указан протокол (например, xai, openrouter и другие SDK конкретных поставщиков), импортируются как совместимые с OpenAI с пометкой «guessed». Если подходящей конечной точки нет, сначала появляется запрос базового URL. Проприетарные (Amazon Bedrock, Cohere) и неизвестные явно указанные протоколы отклоняются. Устаревшие модели и модели со статусом alpha не попадают в список импорта.
- **Пользовательский реестр (api.json)**: вставьте URL реестра и Bearer-токен; CLI автоматически создаст записи `providers` / `models`. При следующих запусках провайдеры с одинаковым URL реестра обновляются вместе, синхронизируя добавления, удаления и изменения метаданных моделей.

::: warning Внимание
Управляемые учётные записи MultiAI, в которые выполнен вход через `/login`, не отображаются в `/provider`. Управляйте ими с помощью `/login`, `/account` и `/logout`.
:::

Те же операции доступны в неинтерактивной среде через команду оболочки [`multiai provider`](../reference/multiai-command.md#multiai-provider).

## `kimi`

Предназначен для подключения к совместимому с OpenAI интерфейсу Kimi / Moonshot AI по ключу API. Kimi остаётся внешним провайдером; вход в учётную запись MultiAI не меняет идентификаторы его моделей и протокол.

- `base_url` по умолчанию: `https://api.moonshot.ai/v1`
- Имена ключей учётных данных: `KIMI_API_KEY`, `KIMI_BASE_URL`
- Дополнительная возможность: загрузка видео

```toml
[providers.kimi]
type = "kimi"
base_url = "https://api.moonshot.ai/v1"
api_key = "sk-xxxxx"
```

## `anthropic`

Предназначен для подключения к Claude API. Стандартные модели Claude автоматически включают компьютерное зрение, инструменты и Thinking (где поддерживается); для пользовательских или неизвестных моделей нужно явно объявить `capabilities` в `[models.<alias>]`.

- `base_url` по умолчанию: значение SDK Anthropic
- Имена ключей: `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`
- `max_tokens` по умолчанию определяется по модели. Для переопределения задайте `max_output_size` у псевдонима модели

```toml
[providers.anthropic]
type = "anthropic"
api_key = "sk-ant-xxxxx"

[models."claude-opus-4-7"]
provider = "anthropic"
model = "claude-opus-4-7"
max_context_size = 200000
# max_output_size = 32000  # необязательно; не задавайте, чтобы использовать значение модели
```

## `openai`

Предназначен для подключения по протоколу OpenAI Chat Completions, а также к любому совместимому стороннему сервису (при необходимости переопределите `base_url`).

Сторонние рассуждающие модели (DeepSeek, Qwen, One API и т. д.) работают без дополнительной настройки: CLI автоматически обрабатывает поле `reasoning_content` и добавление `reasoning_effort`. Если шлюз возвращает рассуждения в нестандартном поле, задайте `reasoning_key` у псевдонима модели.

- `base_url` по умолчанию: `https://api.openai.com/v1`
- Имена ключей: `OPENAI_API_KEY`, `OPENAI_BASE_URL`

```toml
[providers.openai]
type = "openai"
base_url = "https://api.openai.com/v1"
api_key = "sk-xxxxx"
```

## `openai_responses`

Соответствует новому Responses API от OpenAI и всегда работает в потоковом режиме. Конфигурация совпадает с `openai`.

- `base_url` по умолчанию: `https://api.openai.com/v1`
- Имена ключей: `OPENAI_API_KEY`, `OPENAI_BASE_URL`

```toml
[providers.openai-responses]
type = "openai_responses"
base_url = "https://api.openai.com/v1"
api_key = "sk-xxxxx"
```

## `google-genai`

Предназначен для прямого подключения к Google Gemini API. Thinking, компьютерное зрение и мультимодальные возможности автоматически определяются по имени модели.

- Имя ключа: `GOOGLE_API_KEY`

```toml
[providers.gemini]
type = "google-genai"
api_key = "xxxxx"
```

Для маршрутизации через совместимый с Gemini прокси или шлюз задайте `base_url` (либо переменную `GOOGLE_GEMINI_BASE_URL`); если значение не указано, SDK использует `https://generativelanguage.googleapis.com`.

> Указывайте **только корень хоста**. SDK Google GenAI сам добавляет версию API и путь (например, `/v1beta/models/<model>:generateContent`), поэтому конечный `/v1beta` приведёт к удвоению `/v1beta/v1beta/…`.

```toml
[providers.gemini]
type = "google-genai"
api_key = "xxxxx"
base_url = "https://your-gateway.example"
```

## `vertexai`

Использует ту же реализацию, что и `google-genai`; `type = "vertexai"` переключает путь доступа на Vertex AI.

Аутентификация следует стандартной схеме Google Cloud ADC (`gcloud auth application-default login` или JSON сервисной учётной записи в `GOOGLE_APPLICATION_CREDENTIALS`). **Идентификатор проекта и регион нужно записать в подраздел `[providers.vertexai.env]`** — простой `export GOOGLE_CLOUD_PROJECT` в оболочке CLI не прочитает.

```toml
[providers.vertexai]
type = "vertexai"

[providers.vertexai.env]
GOOGLE_CLOUD_PROJECT = "my-gcp-project"
GOOGLE_CLOUD_LOCATION = "us-central1"
```

```sh
gcloud auth application-default login   # однократная аутентификация
multiai
```

Чтобы направить запросы Vertex через пользовательскую конечную точку (например, прокси), задайте `base_url` или `GOOGLE_VERTEX_BASE_URL`; иначе SDK использует региональный хост `*-aiplatform.googleapis.com`. Как и для `google-genai`, указывайте только корень хоста: SDK сам добавит `/v1beta1/publishers/google/models/…`.

## OAuth и внедрение учётных данных

Управляемый сервис MultiAI использует OAuth вместо статического ключа API. После `/login` CLI внедряет `managed:multiai` и создаёт псевдонимы `multiai/<model-id>` из актуального ответа `/v1/models`. Запросы используют `/v1/responses`. Токены обновления хранятся в связке ключей ОС, а токены доступа и данные учётной записи — в памяти. См. [Учётная запись и OAuth](../guides/account-and-oauth.md).

## Дальнейшие шаги

- [Файлы конфигурации](./config-files.md) — полное описание полей таблиц `providers` и `models`
- [Переопределение конфигурации](./overrides.md) — правила приоритета учётных данных провайдеров
- [Переменные окружения](./env-vars.md) — имена ключей учётных данных для каждого типа провайдера
