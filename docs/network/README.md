# Network 架构设计文档

本目录包含面向开发者的 CloudburstMC Network 组件架构设计文档，重点说明系统结构、核心流程和扩展点。

> 说明：本文档以 https://github.com/CloudburstMC/Network 项目为基础整理。

## 文档索引

| 文档 | 内容 |
|---|---|
| [01-overview.md](01-overview.md) | 项目概述与系统全景架构 |
| [02-channel-pipeline.md](02-channel-pipeline.md) | 通道体系：ProxyChannel、RakServerChannel、RakClientChannel、双 Pipeline 结构 |
| [03-connection-session.md](03-connection-session.md) | 连接与会话：离线握手、在线握手、RakSessionCodec |
| [04-config.md](04-config.md) | 配置体系：服务端/客户端/会话配置、限流与安全边界 |
| [05-codec-query.md](05-codec-query.md) | netty-codec-query 模块：Minecraft Query 协议实现 |
| [06-codec-rcon.md](06-codec-rcon.md) | netty-codec-rcon 模块：RCON 远程控制协议实现 |
