<template>
  <div class="project-card">
    <h3 class="project-card-title">{{ title }}</h3>
    <p class="project-card-desc">{{ description }}</p>
    <div class="project-card-links">
      <a
        v-for="link in parsedLinks"
        :key="link.url"
        :href="link.url"
        class="project-card-link"
        :target="isExternal(link.url) ? '_blank' : undefined"
        :rel="isExternal(link.url) ? 'noopener noreferrer' : undefined"
        @click="handleClick($event, link.url)"
      >
        {{ link.text }}
      </a>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  links: { type: String, default: '[]' },
})

const router = useRouter()

const parsedLinks = computed(() => {
  try {
    return JSON.parse(props.links)
  } catch {
    return []
  }
})

function isExternal(url) {
  return /^https?:\/\//.test(url)
}

function handleClick(e, url) {
  if (!isExternal(url)) {
    e.preventDefault()
    router.push(url)
  }
}
</script>
