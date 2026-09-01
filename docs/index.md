---
layout: home
hero:
  name: MultiAI CLI
  text: ' '
  actions:
    - theme: brand
      text: Русский
      link: ru/
    - theme: alt
      text: English
      link: en/
---

<script setup>
import { onMounted } from 'vue'
import { useRouter, withBase } from 'vitepress'

const router = useRouter()

onMounted(() => {
  const lang = navigator.language || navigator.userLanguage
  if (lang.startsWith('ru')) {
    router.go(withBase('/ru/'))
  } else {
    router.go(withBase('/en/'))
  }
})
</script>
