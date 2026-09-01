import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'
import llmstxt from 'vitepress-plugin-llms'

const rawBase = process.env.VITEPRESS_BASE
const base = rawBase
  ? rawBase.startsWith('/')
    ? rawBase.endsWith('/') ? rawBase : `${rawBase}/`
    : `/${rawBase}/`
  : '/'

const mermaidOptimizeDeps = [
  '@braintree/sanitize-url',
  'dayjs',
  'debug',
  'cytoscape-cose-bilkent',
  'cytoscape',
]

const config = withMermaid(defineConfig({
  base,
  title: 'MultiAI CLI Docs',
  description: 'MultiAI CLI documentation',

  head: [
    ['link', { rel: 'icon', type: 'image/x-icon', href: `${base}favicon.ico` }],
    ['meta', { name: 'theme-color', content: '#0a7aff' }],
  ],

  srcExclude: ['AGENTS.md', 'superpowers/**'],

  locales: {
    ru: {
      label: 'Русский',
      lang: 'ru-RU',
      link: '/ru/',
      title: 'Документация MultiAI CLI',
      description: 'Пользовательская документация MultiAI CLI',
      themeConfig: {
        nav: [
          { text: 'Руководства', link: '/ru/guides/getting-started', activeMatch: '/ru/guides/' },
          { text: 'Расширение', link: '/ru/customization/mcp', activeMatch: '/ru/customization/' },
          { text: 'Настройка', link: '/ru/configuration/config-files', activeMatch: '/ru/configuration/' },
          { text: 'Справочник', link: '/ru/reference/multiai-command', activeMatch: '/ru/reference/' },
          { text: 'Примечания к выпускам', link: '/ru/release-notes/changelog', activeMatch: '/ru/release-notes/' },
        ],
        sidebar: {
          '/ru/guides/': [
            {
              text: 'Руководства',
              items: [
                { text: 'Начало работы', link: '/ru/guides/getting-started' },
                { text: 'OAuth и учётная запись', link: '/ru/guides/account-and-oauth' },
                { text: 'Устаревшие данные', link: '/ru/guides/migration' },
                { text: 'Типичные сценарии', link: '/ru/guides/use-cases' },
                { text: 'Взаимодействие и ввод', link: '/ru/guides/interaction' },
                { text: 'Сеансы и контекст', link: '/ru/guides/sessions' },
                { text: 'Работа с целями', link: '/ru/guides/goals' },
                { text: 'Использование в IDE', link: '/ru/guides/ides' },
              ],
            },
          ],
          '/ru/customization/': [
            {
              text: 'Расширение',
              items: [
                { text: 'Model Context Protocol', link: '/ru/customization/mcp' },
                { text: 'Навыки агентов', link: '/ru/customization/skills' },
                { text: 'Плагины', link: '/ru/customization/plugins' },
                { text: 'Агенты и субагенты', link: '/ru/customization/agents' },
                { text: 'Хуки', link: '/ru/customization/hooks' },
                { text: 'Пользовательские темы', link: '/ru/customization/themes' },
              ],
            },
          ],
          '/ru/configuration/': [
            {
              text: 'Настройка',
              items: [
                { text: 'Файлы конфигурации', link: '/ru/configuration/config-files' },
                { text: 'Провайдеры и модели', link: '/ru/configuration/providers' },
                { text: 'Переопределение настроек', link: '/ru/configuration/overrides' },
                { text: 'Переменные окружения', link: '/ru/configuration/env-vars' },
                { text: 'Расположение данных', link: '/ru/configuration/data-locations' },
              ],
            },
          ],
          '/ru/reference/': [
            {
              text: 'Справочник',
              items: [
                { text: 'Команда multiai', link: '/ru/reference/multiai-command' },
                { text: 'Подкоманда multiai acp', link: '/ru/reference/multiai-acp' },
                { text: 'Встроенные инструменты', link: '/ru/reference/tools' },
                { text: 'Команды с косой чертой', link: '/ru/reference/slash-commands' },
                { text: 'Сочетания клавиш', link: '/ru/reference/keyboard' },
              ],
            },
          ],
          '/ru/release-notes/': [
            {
              text: 'Примечания к выпускам',
              items: [
                { text: 'Журнал изменений', link: '/ru/release-notes/changelog' },
              ],
            },
          ],
        },
      },
    },
    en: {
      label: 'English',
      lang: 'en-US',
      link: '/en/',
      title: 'MultiAI CLI Docs',
      description: 'MultiAI CLI user documentation',
      themeConfig: {
        nav: [
          { text: 'Guides', link: '/en/guides/getting-started', activeMatch: '/en/guides/' },
          { text: 'Customization', link: '/en/customization/mcp', activeMatch: '/en/customization/' },
          { text: 'Configuration', link: '/en/configuration/config-files', activeMatch: '/en/configuration/' },
          { text: 'Reference', link: '/en/reference/multiai-command', activeMatch: '/en/reference/' },
          { text: 'Release Notes', link: '/en/release-notes/changelog', activeMatch: '/en/release-notes/' },
        ],
        sidebar: {
          '/en/guides/': [
            {
              text: 'Guides',
              items: [
                { text: 'Getting Started', link: '/en/guides/getting-started' },
                { text: 'OAuth and Account', link: '/en/guides/account-and-oauth' },
                { text: 'Legacy Data', link: '/en/guides/migration' },
                { text: 'Common Use Cases', link: '/en/guides/use-cases' },
                { text: 'Interaction and Input', link: '/en/guides/interaction' },
                { text: 'Sessions and Context', link: '/en/guides/sessions' },
                { text: 'Using Goals', link: '/en/guides/goals' },
                { text: 'Using in IDEs', link: '/en/guides/ides' },
              ],
            },
          ],
          '/en/customization/': [
            {
              text: 'Customization',
              items: [
                { text: 'Model Context Protocol', link: '/en/customization/mcp' },
                { text: 'Agent Skills', link: '/en/customization/skills' },
                { text: 'Plugins', link: '/en/customization/plugins' },
                { text: 'Agents and Subagents', link: '/en/customization/agents' },
                { text: 'Hooks', link: '/en/customization/hooks' },
                { text: 'Custom Themes', link: '/en/customization/themes' },
              ],
            },
          ],
          '/en/configuration/': [
            {
              text: 'Configuration',
              items: [
                { text: 'Config Files', link: '/en/configuration/config-files' },
                { text: 'Providers and Models', link: '/en/configuration/providers' },
                { text: 'Config Overrides', link: '/en/configuration/overrides' },
                { text: 'Environment Variables', link: '/en/configuration/env-vars' },
                { text: 'Data Locations', link: '/en/configuration/data-locations' },
              ],
            },
          ],
          '/en/reference/': [
            {
              text: 'Reference',
              items: [
                { text: 'multiai Command', link: '/en/reference/multiai-command' },
                { text: 'multiai acp Subcommand', link: '/en/reference/multiai-acp' },
                { text: 'Built-in Tools', link: '/en/reference/tools' },
                { text: 'Slash Commands', link: '/en/reference/slash-commands' },
                { text: 'Keyboard Shortcuts', link: '/en/reference/keyboard' },
              ],
            },
          ],
          '/en/release-notes/': [
            {
              text: 'Release Notes',
              items: [
                { text: 'Changelog', link: '/en/release-notes/changelog' },
              ],
            },
          ],
        },
      },
    },
  },

  themeConfig: {
    outline: [2, 3],
    search: { provider: 'local' },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/SURVERS/MultiAI-CLI' },
    ],
  },

  vite: {
    optimizeDeps: {
      include: mermaidOptimizeDeps.map((dep) => `mermaid > ${dep}`),
    },
    plugins: [llmstxt()],
  },
}))

if (config.vite?.optimizeDeps?.include) {
  config.vite.optimizeDeps.include = config.vite.optimizeDeps.include.filter(
    (dep) => !mermaidOptimizeDeps.includes(dep),
  )
}

export default config
