<script setup lang="ts">
import logoUrl from '../Kimi.png'

withDefaults(defineProps<{ size?: number }>(), { size: 56 })
</script>

<template>
  <img
    class="MultiAILogo"
    :src="logoUrl"
    :width="size"
    :height="size"
    alt="Kimi"
  />
</template>

<style scoped>
.MultiAILogo {
  display: block;
  object-fit: contain;
}
</style>
