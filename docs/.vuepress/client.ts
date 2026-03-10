import { defineClientConfig } from 'vuepress/client'
import ProjectCard from './components/ProjectCard.vue'

export default defineClientConfig({
  enhance({ app }) {
    app.component('ProjectCard', ProjectCard)
  },
})
