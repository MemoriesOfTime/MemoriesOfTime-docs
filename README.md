# docs.mot.dev

MOT 项目技术文档站，基于 [VuePress 2](https://v2.vuepress.vuejs.org/zh/) 构建。

## 项目结构

```
docs/
├── .vuepress/
│   ├── components/       # 自定义 Vue 组件（自动注册为全局组件）
│   │   └── ProjectCard.vue
│   ├── styles/           # 自定义样式
│   │   └── index.scss
│   ├── public/           # 静态资源
│   └── config.ts         # VuePress 配置
├── waterdogpe-netease/   # WaterdogPE 架构文档
└── README.md             # 首页
```

## 本地开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建静态站点
pnpm build
```

## 添加新项目文档

1. 在 `docs/` 下创建新目录，编写 Markdown 文档
2. 在 `docs/.vuepress/config.ts` 中配置 navbar 和 sidebar
3. 在 `docs/README.md` 首页添加 `<ProjectCard>` 卡片：

```md
<ProjectCard
  title="项目名"
  description="项目简介"
  links='[{"text":"文档类型","url":"/路径/"}]'
/>
```
