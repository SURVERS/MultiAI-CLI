<script setup lang="ts">
import { useData, withBase } from 'vitepress'
import { computed, ref } from 'vue'

const { lang } = useData()
const isRu = computed(() => lang.value.startsWith('ru'))

const installMacCommand = 'npm install -g multiai-cli'
const installWinCommand = 'npm install -g multiai-cli'
const runCommand = 'multiai'

const copy = computed(() => isRu.value
  ? {
      title: 'Начните с одной команды',
      lede: 'После установки запустите multiai в любом проекте и начните диалог.',
      macLabel: 'macOS / Linux',
      winLabel: 'Windows (PowerShell)',
      runLabel: 'Запуск в любом каталоге',
      copyHint: 'Копировать',
      copiedHint: 'Скопировано',
      ctaText: 'Полное руководство по установке',
      ctaHref: '/ru/guides/getting-started',
    }
  : {
      title: 'Get started in one line',
      lede: 'Once installed, run multiai inside any project to start a conversation.',
      macLabel: 'macOS / Linux',
      winLabel: 'Windows (PowerShell)',
      runLabel: 'Run anywhere',
      copyHint: 'Copy',
      copiedHint: 'Copied',
      ctaText: 'Read the full install guide',
      ctaHref: '/en/guides/getting-started',
    })

const copiedKey = ref<string | null>(null)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

function copyText(value: string, key: string) {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return
  navigator.clipboard.writeText(value).then(() => {
    copiedKey.value = key
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => { copiedKey.value = null }, 1600)
  })
}
</script>

<template>
  <section class="MultiAIHome__section MultiAIQuick">
    <h2 class="MultiAIHome__sectionTitle">{{ copy.title }}</h2>
    <p class="MultiAIHome__sectionLede">{{ copy.lede }}</p>

    <div class="MultiAIQuick__installs">
      <div class="MultiAIQuick__block">
        <div class="MultiAIQuick__label">{{ copy.macLabel }}</div>
        <div class="MultiAIQuick__cmd">
          <code><span class="MultiAIQuick__prompt">$</span> {{ installMacCommand }}</code>
          <button
            type="button"
            class="MultiAIQuick__copy"
            @click="copyText(installMacCommand, 'mac')"
            :aria-label="copy.copyHint"
          >
            <template v-if="copiedKey === 'mac'">{{ copy.copiedHint }}</template>
            <template v-else>{{ copy.copyHint }}</template>
          </button>
        </div>
      </div>

      <div class="MultiAIQuick__block">
        <div class="MultiAIQuick__label">{{ copy.winLabel }}</div>
        <div class="MultiAIQuick__cmd">
          <code><span class="MultiAIQuick__prompt">PS&gt;</span> {{ installWinCommand }}</code>
          <button
            type="button"
            class="MultiAIQuick__copy"
            @click="copyText(installWinCommand, 'win')"
            :aria-label="copy.copyHint"
          >
            <template v-if="copiedKey === 'win'">{{ copy.copiedHint }}</template>
            <template v-else>{{ copy.copyHint }}</template>
          </button>
        </div>
      </div>
    </div>

    <div class="MultiAIQuick__block MultiAIQuick__block--run">
      <div class="MultiAIQuick__label">{{ copy.runLabel }}</div>
      <div class="MultiAIQuick__cmd">
        <code><span class="MultiAIQuick__prompt">$</span> {{ runCommand }}</code>
        <button
          type="button"
          class="MultiAIQuick__copy"
          @click="copyText(runCommand, 'run')"
          :aria-label="copy.copyHint"
        >
          <template v-if="copiedKey === 'run'">{{ copy.copiedHint }}</template>
          <template v-else>{{ copy.copyHint }}</template>
        </button>
      </div>
    </div>

    <a class="MultiAIQuick__more" :href="withBase(copy.ctaHref)">
      {{ copy.ctaText }}
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </a>
  </section>
</template>

<style scoped>
.MultiAIQuick__installs {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 16px;
}

.MultiAIQuick__block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.MultiAIQuick__block--run {
  margin-bottom: 28px;
}

.MultiAIQuick__label {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
}

.MultiAIQuick__cmd {
  position: relative;
  display: flex;
  align-items: center;
  padding: 18px 22px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: var(--multiai-radius-code);
  font-family: var(--vp-font-family-mono);
  font-size: 14.5px;
  line-height: 1.4;
  color: var(--vp-c-text-1);
  overflow: hidden;
  transition: border-color var(--multiai-transition), box-shadow var(--multiai-transition);
}
.MultiAIQuick__cmd:hover {
  border-color: var(--vp-c-brand-1);
  box-shadow: var(--vp-shadow-2);
}
.MultiAIQuick__cmd code {
  flex: 1;
  white-space: pre;
  overflow-x: auto;
  background: transparent !important;
  color: inherit;
  padding: 0;
  font-size: inherit;
  font-family: inherit;
  border-radius: 0;
}
.MultiAIQuick__prompt {
  color: var(--vp-c-brand-1);
  margin-right: 8px;
  user-select: none;
  font-weight: 600;
}

.MultiAIQuick__copy {
  flex: none;
  margin-left: 12px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  font-family: var(--vp-font-family-base);
  letter-spacing: 0.01em;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  cursor: pointer;
  transition: color var(--multiai-transition), border-color var(--multiai-transition), background var(--multiai-transition);
}
.MultiAIQuick__copy:hover {
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
}

.MultiAIQuick__more {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 600;
  color: var(--vp-c-brand-1);
  text-decoration: none;
  transition: transform var(--multiai-transition), color var(--multiai-transition);
}
.MultiAIQuick__more:hover {
  color: var(--vp-c-brand-2);
  transform: translateX(3px);
}
</style>
