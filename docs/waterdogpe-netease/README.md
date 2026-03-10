# WaterdogPE 架构设计文档

本目录包含面向开发者的 WaterdogPE 架构设计文档，重点说明系统结构、核心流程和扩展点。

> 说明：本文档以https://github.com/MemoriesOfTime/WaterdogPE_Netease/tree/netease实现为基础整理；构建配置与依赖版本以 `pom.xml` 为准。

## 文档索引

| 文档 | 内容 |
|---|---|
| [01-overview.md](01-overview.md) | 项目概述与系统全景架构 |
| [02-network-layer.md](02-network-layer.md) | 网络层架构：Netty Pipeline、编解码、连接管理 |
| [03-packet-flow.md](03-packet-flow.md) | 数据包完整流转路径与信号机制 |
| [04-handler-state-machine.md](04-handler-state-machine.md) | Handler 状态转换链 |
| [05-server-transfer.md](05-server-transfer.md) | 服务器转移（Transfer）完整流程与两阶段维度变化 |
| [06-player-lifecycle.md](06-player-lifecycle.md) | 玩家完整生命周期 |
| [07-event-system.md](07-event-system.md) | 事件系统架构与完整事件列表 |
| [08-plugin-system.md](08-plugin-system.md) | 插件系统：加载、生命周期、钩子 |
| [09-rewrite-layer.md](09-rewrite-layer.md) | 协议重写层：实体ID/方块ID重写原理 |
| [10-subsystems.md](10-subsystems.md) | 其他子系统：调度、安全、命令、配置、资源包 |
| [11-dependencies.md](11-dependencies.md) | 关键依赖库与设计模式总结 |
