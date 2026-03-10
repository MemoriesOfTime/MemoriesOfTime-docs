import { viteBundler } from '@vuepress/bundler-vite'
import { markdownChartPlugin } from '@vuepress/plugin-markdown-chart'
import { defaultTheme } from '@vuepress/theme-default'
import { defineUserConfig } from 'vuepress'

export default defineUserConfig({
  base: '/',
  lang: 'zh-CN',
  title: 'MOT 文档站',
  description: '项目技术文档',

  bundler: viteBundler(),

  plugins: [
    markdownChartPlugin({ mermaid: true }),
  ],

  theme: defaultTheme({
    navbar: [
      { text: '首页', link: '/' },
      { text: 'WaterdogPE', link: '/waterdogpe-netease/' },
    ],

    sidebar: {
      '/waterdogpe-netease/': [
        {
          text: 'WaterdogPE 架构文档',
          children: [
            '/waterdogpe-netease/',
            '/waterdogpe-netease/01-overview.md',
            '/waterdogpe-netease/02-network-layer.md',
            '/waterdogpe-netease/03-packet-flow.md',
            '/waterdogpe-netease/04-handler-state-machine.md',
            '/waterdogpe-netease/05-server-transfer.md',
            '/waterdogpe-netease/06-player-lifecycle.md',
            '/waterdogpe-netease/07-event-system.md',
            '/waterdogpe-netease/08-plugin-system.md',
            '/waterdogpe-netease/09-rewrite-layer.md',
            '/waterdogpe-netease/10-subsystems.md',
            '/waterdogpe-netease/11-dependencies.md',
          ],
        },
      ],
    },

    editLink: false,
    contributors: false,
  }),
})
