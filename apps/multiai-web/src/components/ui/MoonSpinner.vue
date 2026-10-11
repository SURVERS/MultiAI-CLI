<!-- apps/multiai-web/src/components/ui/MoonSpinner.vue -->
<!-- MultiAI Cyber Spinner: neon orbital gradient pulse for waiting and generation state. -->
<script setup lang="ts">
withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg';
  fast?: boolean;
  label?: string;
}>(), {
  size: 'md',
  label: 'Генерация ответа…',
});
</script>

<template>
  <span
    class="ui-multiai-spinner"
    :class="[`ui-multiai-spinner--${size}`, { 'ui-multiai-spinner--fast': fast }]"
    :aria-label="label"
    role="status"
  >
    <svg class="spinner-svg" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="multiAiGradOuter" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#00E5FF" />
          <stop offset="50%" stop-color="#8B5CF6" />
          <stop offset="100%" stop-color="#00E5FF" stop-opacity="0.1" />
        </linearGradient>
        <linearGradient id="multiAiGradInner" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#8B5CF6" />
          <stop offset="100%" stop-color="#00E5FF" stop-opacity="0.2" />
        </linearGradient>
      </defs>
      <!-- Background subtle track -->
      <circle class="track" cx="16" cy="16" r="13" stroke="currentColor" stroke-opacity="0.12" stroke-width="2" />
      <!-- Outer cyber orbit -->
      <circle
        class="outer-orbit"
        cx="16"
        cy="16"
        r="13"
        stroke="url(#multiAiGradOuter)"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-dasharray="45 35"
      />
      <!-- Inner counter-orbit -->
      <circle
        class="inner-orbit"
        cx="16"
        cy="16"
        r="8.5"
        stroke="url(#multiAiGradInner)"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-dasharray="24 28"
      />
      <!-- Glowing core -->
      <circle class="core" cx="16" cy="16" r="3.2" fill="#00E5FF" />
    </svg>
  </span>
</template>

<style scoped>
.ui-multiai-spinner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  line-height: 1;
  user-select: none;
  flex: none;
  filter: drop-shadow(0 0 5px rgba(0, 229, 255, 0.45));
}
.ui-multiai-spinner--sm { width: 16px; height: 16px; }
.ui-multiai-spinner--md { width: 22px; height: 22px; }
.ui-multiai-spinner--lg { width: 30px; height: 30px; }

.spinner-svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.outer-orbit {
  transform-origin: 16px 16px;
  animation: multiai-spin-clockwise 1.3s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

.inner-orbit {
  transform-origin: 16px 16px;
  animation: multiai-spin-counter 1s linear infinite;
}

.core {
  transform-origin: 16px 16px;
  animation: multiai-core-pulse 1.4s ease-in-out infinite;
}

.ui-multiai-spinner--fast .outer-orbit {
  animation-duration: 0.65s;
}
.ui-multiai-spinner--fast .inner-orbit {
  animation-duration: 0.5s;
}
.ui-multiai-spinner--fast .core {
  animation-duration: 0.7s;
}

@keyframes multiai-spin-clockwise {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes multiai-spin-counter {
  0% { transform: rotate(360deg); }
  100% { transform: rotate(0deg); }
}

@keyframes multiai-core-pulse {
  0%, 100% { transform: scale(0.85); opacity: 0.75; }
  50% { transform: scale(1.25); opacity: 1; filter: drop-shadow(0 0 6px #00E5FF); }
}

@media (prefers-reduced-motion: reduce) {
  .outer-orbit, .inner-orbit, .core { animation: none; }
}
</style>
