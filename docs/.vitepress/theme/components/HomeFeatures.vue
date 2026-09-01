<script setup lang="ts">
import { useData, withBase } from 'vitepress'
import { computed } from 'vue'

const { lang } = useData()
const isRu = computed(() => lang.value.startsWith('ru'))

interface Highlight {
  icon: string
  title: string
  desc: string
}

interface Feature {
  icon: string
  title: string
  desc: string
  href: string
}

const highlights = computed<Highlight[]>(() => isRu.value
  ? [
      {
        icon: '⚡',
        title: 'Быстро и легко',
        desc: 'Установка одной командой и запуск за миллисекунды — без лишней настройки окружения.',
      },
      {
        icon: '🎬',
        title: 'Ввод видео',
        desc: 'Добавьте запись экрана или демонстрационный ролик в диалог — агент проанализирует кадры.',
      },
      {
        icon: '🎨',
        title: 'Продуманный TUI',
        desc: 'Тщательно настроенный интерфейс для долгих сосредоточенных сеансов с агентом.',
      },
    ]
  : [
      {
        icon: '⚡',
        title: 'Fast & lightweight',
        desc: 'Single-binary install with millisecond startup — no Node.js, no PATH gymnastics.',
      },
      {
        icon: '🎬',
        title: 'Video input',
        desc: 'Drop a screen recording or demo clip in chat; the agent reads the frames and acts on them.',
      },
      {
        icon: '🎨',
        title: 'Polished TUI',
        desc: 'A carefully tuned interface designed for long, focused agent sessions.',
      },
    ])

const features = computed<Feature[]>(() => isRu.value
  ? [
      {
        icon: '🧩',
        title: 'Навыки агентов',
        desc: 'Упакуйте рабочие процессы команды в навыки, которые MultiAI может вызывать по запросу.',
        href: '/ru/customization/skills',
      },
      {
        icon: '🪝',
        title: 'Хуки',
        desc: 'Запускайте скрипты в ключевых точках жизненного цикла: форматирование, подтверждения, уведомления и другое.',
        href: '/ru/customization/hooks',
      },
      {
        icon: '🤖',
        title: 'Субагенты',
        desc: 'Параллельно поручайте изолированные задачи с отдельным контекстом, сохраняя основной диалог чистым.',
        href: '/ru/customization/agents',
      },
      {
        icon: '🔌',
        title: 'MCP',
        desc: 'Подключайте любые инструменты, источники данных и корпоративные системы через Model Context Protocol.',
        href: '/ru/customization/mcp',
      }
    ]
  : [
      {
        icon: '🧩',
        title: 'Agent Skills',
        desc: "Package your team's workflows into skills Kimi can invoke on demand.",
        href: '/en/customization/skills',
      },
      {
        icon: '🪝',
        title: 'Hooks',
        desc: 'Inject scripts at lifecycle checkpoints — formatting, approvals, notifications, anything.',
        href: '/en/customization/hooks',
      },
      {
        icon: '🤖',
        title: 'Sub-agents',
        desc: 'Dispatch isolated tasks in parallel, each with its own context — main thread stays clean.',
        href: '/en/customization/agents',
      },
      {
        icon: '🔌',
        title: 'MCP',
        desc: 'Plug in any tool, data source, or enterprise system via the Model Context Protocol.',
        href: '/en/customization/mcp',
      }
    ])

const highlightsTitle = computed(() => isRu.value ? 'Готово к работе' : 'Ready out of the box')
const highlightsLede = computed(() => isRu.value
  ? 'Установите один раз — всё необходимое уже настроено.'
  : 'Install once. The essentials are already there.')

const featuresTitle = computed(() => isRu.value ? 'Расширяйте по-своему' : 'Extend it your way')
const featuresLede = computed(() => isRu.value
  ? 'Программируемые точки расширения позволяют настроить рабочий процесс под себя.'
  : 'Programmable extension points to shape the workflow around you.')

const ctaText = computed(() => isRu.value ? 'Подробнее' : 'Learn more')
</script>

<template>
  <section class="MultiAIHome__section MultiAIHighlights">
    <h2 class="MultiAIHome__sectionTitle">{{ highlightsTitle }}</h2>
    <p class="MultiAIHome__sectionLede">{{ highlightsLede }}</p>
    <div class="MultiAIHighlights__grid">
      <div
        v-for="h in highlights"
        :key="h.title"
        class="MultiAIHighlights__card"
      >
        <div class="MultiAIHighlights__icon" aria-hidden="true">{{ h.icon }}</div>
        <h3 class="MultiAIHighlights__title">{{ h.title }}</h3>
        <p class="MultiAIHighlights__desc">{{ h.desc }}</p>
      </div>
    </div>
  </section>

  <section class="MultiAIHome__section MultiAIFeatures">
    <h2 class="MultiAIHome__sectionTitle">{{ featuresTitle }}</h2>
    <p class="MultiAIHome__sectionLede">{{ featuresLede }}</p>
    <div class="MultiAIFeatures__grid">
      <a
        v-for="f in features"
        :key="f.title"
        class="MultiAIFeatures__card"
        :href="withBase(f.href)"
      >
        <div class="MultiAIFeatures__icon" aria-hidden="true">{{ f.icon }}</div>
        <h3 class="MultiAIFeatures__title">{{ f.title }}</h3>
        <p class="MultiAIFeatures__desc">{{ f.desc }}</p>
        <span class="MultiAIFeatures__cta">
          {{ ctaText }}
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
      </a>
    </div>
  </section>
</template>

<style scoped>
/* === Highlights (top section: non-clickable product attributes) === */
.MultiAIHighlights__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

@media (max-width: 720px) {
  .MultiAIHighlights__grid {
    grid-template-columns: 1fr;
  }
}

.MultiAIHighlights__card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 22px 22px 24px;
  border-radius: var(--multiai-radius-card);
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
}

.MultiAIHighlights__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--multiai-brand-soft);
  font-size: 18px;
  margin-bottom: 14px;
}

.MultiAIHighlights__title {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 0 0 6px;
  color: var(--vp-c-text-1);
}

.MultiAIHighlights__desc {
  font-size: 14px;
  line-height: 1.55;
  color: var(--vp-c-text-2);
  margin: 0;
}

/* === Features (bottom section: clickable extension points) === */
.MultiAIFeatures__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 20px;
}

@media (max-width: 1024px) {
  .MultiAIFeatures__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 640px) {
  .MultiAIFeatures__grid {
    grid-template-columns: 1fr;
  }
}

.MultiAIFeatures__card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 28px 24px 26px;
  border-radius: var(--multiai-radius-card);
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  text-decoration: none;
  transition: transform var(--multiai-transition), border-color var(--multiai-transition),
              box-shadow var(--multiai-transition), background var(--multiai-transition);
  overflow: hidden;
}

.MultiAIFeatures__card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--multiai-brand-gradient-soft);
  opacity: 0;
  transition: opacity var(--multiai-transition);
  pointer-events: none;
  border-radius: inherit;
}

.MultiAIFeatures__card:hover {
  transform: translateY(-3px);
  border-color: var(--vp-c-brand-1);
  box-shadow: var(--vp-shadow-3);
}
.MultiAIFeatures__card:hover::before {
  opacity: 1;
}

.MultiAIFeatures__icon {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--multiai-brand-soft);
  font-size: 22px;
  margin-bottom: 18px;
}

.MultiAIFeatures__title {
  position: relative;
  z-index: 1;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.015em;
  margin: 0 0 8px;
  color: var(--vp-c-text-1);
}

.MultiAIFeatures__desc {
  position: relative;
  z-index: 1;
  font-size: 14.5px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
  margin: 0 0 20px;
}

.MultiAIFeatures__cta {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--vp-c-brand-1);
  margin-top: auto;
  transition: transform var(--multiai-transition);
}

.MultiAIFeatures__card:hover .MultiAIFeatures__cta {
  transform: translateX(3px);
}
</style>
