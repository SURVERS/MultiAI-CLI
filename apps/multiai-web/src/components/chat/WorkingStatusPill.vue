<!-- apps/multiai-web/src/components/chat/WorkingStatusPill.vue -->
<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import MoonSpinner from '../ui/MoonSpinner.vue';
import { DEV_PHRASES, getRandomDevPhrase, type DevPhraseMode } from '../../lib/devPhrases';

const props = withDefaults(
  defineProps<{
    mode?: DevPhraseMode;
    fast?: boolean;
  }>(),
  {
    mode: 'waiting',
    fast: false,
  },
);

const currentPhrase = ref(getRandomDevPhrase(props.mode));
let intervalId: ReturnType<typeof setInterval> | null = null;

function rotatePhrase(): void {
  currentPhrase.value = getRandomDevPhrase(props.mode, currentPhrase.value);
}

function startRotation(): void {
  stopRotation();
  currentPhrase.value = getRandomDevPhrase(props.mode);
  intervalId = setInterval(rotatePhrase, 3600);
}

function stopRotation(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

watch(
  () => props.mode,
  () => {
    startRotation();
  },
);

onMounted(() => {
  startRotation();
});

onUnmounted(() => {
  stopRotation();
});
</script>

<template>
  <div class="working-pill" :class="[`working-pill--${mode}`]">
    <MoonSpinner :fast="fast" size="sm" />
    <Transition name="phrase-fade" mode="out-in">
      <span :key="currentPhrase" class="phrase-text">{{ currentPhrase }}</span>
    </Transition>
  </div>
</template>

<style scoped>
.working-pill {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 6px 14px 6px 10px;
  border-radius: 9999px;
  font-family: var(--font-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
  user-select: none;
}

/* Режим размышления (waiting / thinking) — фиолетовый неоновый акцент */
.working-pill--waiting {
  background: rgba(139, 92, 246, 0.1);
  border: 1px solid rgba(139, 92, 246, 0.35);
  color: #C4B5FD;
  box-shadow: 0 0 16px rgba(139, 92, 246, 0.2), inset 0 0 8px rgba(139, 92, 246, 0.1);
}

.working-pill--waiting .phrase-text {
  color: #DDD6FE;
  text-shadow: 0 0 8px rgba(139, 92, 246, 0.5);
}

/* Режим генерации ответа (composing / generating) — бирюзовый неоновый */
.working-pill--composing {
  background: rgba(0, 229, 255, 0.09);
  border: 1px solid rgba(0, 229, 255, 0.38);
  color: #67E8F9;
  box-shadow: 0 0 16px rgba(0, 229, 255, 0.22), inset 0 0 8px rgba(0, 229, 255, 0.1);
}

.working-pill--composing .phrase-text {
  color: #A5F3FC;
  text-shadow: 0 0 8px rgba(0, 229, 255, 0.55);
}

/* Режим выполнения тулов (tool) — бирюзово-циановый */
.working-pill--tool {
  background: rgba(0, 229, 255, 0.12);
  border: 1px solid rgba(56, 237, 255, 0.45);
  color: #38EDFF;
  box-shadow: 0 0 18px rgba(0, 229, 255, 0.25), inset 0 0 10px rgba(0, 229, 255, 0.12);
}

.working-pill--tool .phrase-text {
  color: #E0F2FE;
  text-shadow: 0 0 10px rgba(56, 237, 255, 0.6);
}

.phrase-text {
  display: inline-block;
  white-space: nowrap;
  letter-spacing: -0.01em;
}

/* Плавный переход смены фраз */
.phrase-fade-enter-active,
.phrase-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.phrase-fade-enter-from {
  opacity: 0;
  transform: translateY(3px);
}

.phrase-fade-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}
</style>
