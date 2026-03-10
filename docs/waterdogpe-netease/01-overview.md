# 一、项目概述与系统全景架构

## 1.1 项目简介

WaterdogPE 是一个 **Minecraft: Bedrock Edition 代理服务器**，位于 Bedrock 客户端和后端服务器之间，负责协议翻译、服务器转移和数据包重写。当前版本通过 `protocol-extension` 编解码器增加了网易（NetEase）基岩版支持。

| 属性         | 值                                    |
|------------|--------------------------------------|
| **JDK 版本** | 17                                   |
| **构建工具**   | Maven                                |
| **入口类**    | `dev.waterdog.waterdogpe.WaterdogPE` |
| **核心包**    | `dev.waterdog.waterdogpe`            |
| **支持协议**   | Bedrock 1.8 ~ 1.26.0（含网易版）           |

## 1.2 系统全景架构

```mermaid
graph TB
    Client["Bedrock 客户端"]

    subgraph Proxy["WaterdogPE 代理服务器"]
        direction TB

        subgraph Core["核心层"]
            PS["ProxyServer<br/>(中心单例)"]
        end

        subgraph Systems["子系统"]
            direction LR
            NET["网络层<br/>Network"]
            PLY["玩家系统<br/>Player"]
            EVT["事件系统<br/>Event"]
            PLG["插件系统<br/>Plugin"]
            SEC["安全系统<br/>Security"]
        end

        subgraph Support["支撑层"]
            direction LR
            CMD["命令系统<br/>Command"]
            SCH["调度系统<br/>Scheduler"]
            CFG["配置系统<br/>Config"]
            PCK["资源包<br/>PackManager"]
            CON["控制台<br/>Console"]
        end

        PS --- NET
        PS --- PLY
        PS --- EVT
        PS --- PLG
        PS --- SEC
        PS --- CMD
        PS --- SCH
        PS --- CFG
        PS --- PCK
        PS --- CON
    end

    ServerA["后端服务器 A"]
    ServerB["后端服务器 B"]
    ServerC["后端服务器 C"]

    Client -- "RakNet / UDP" --> Proxy
    Proxy -- "RakNet / UDP" --> ServerA
    Proxy -- "RakNet / UDP" --> ServerB
    Proxy -- "RakNet / UDP" --> ServerC
```

## 1.3 核心模块依赖关系

```mermaid
graph TD
    PS["ProxyServer"]

    PS --> EL["EventLoops<br/>(Netty EventLoopGroup)"]
    PS --> SIM["ServerInfoMap"]
    PS --> PM["PlayerManager"]
    PS --> PLM["PluginManager"]
    PS --> EM["EventManager"]
    PS --> SM["SecurityManager"]
    PS --> PKM["PackManager"]
    PS --> CM["CommandMap"]
    PS --> WS["WaterdogScheduler"]
    PS --> PC["ProxyConfig"]

    SIM --> SI["ServerInfo[]<br/>(BedrockServerInfo)"]
    SI --> BCC["BedrockClientConnection"]

    PM --> PP["ProxiedPlayer[]"]
    PP --> BSS["BedrockServerSession<br/>(上游连接)"]
    PP --> CC["ClientConnection<br/>(下游连接)"]
    PP --> LD["LoginData"]
    PP --> RD["RewriteData"]
    PP --> RM["RewriteMaps"]

    RM --> EntMap["EntityMap"]
    RM --> ET["EntityTracker"]
    RM --> BM["BlockMap"]

    PLM --> Plugin["Plugin[]<br/>(PluginClassLoader 隔离)"]
    EM --> EH["EventHandler[]<br/>(按优先级分组)"]
    SM --> CT["ConnectionThrottle<br/>(connectionThrottle)"]
    SM --> LT["ConnectionThrottle<br/>(loginThrottle)"]

    style PS fill:#e1f5fe,stroke:#01579b
    style PP fill:#fff3e0,stroke:#e65100
    style RM fill:#fce4ec,stroke:#b71c1c
```

## 1.4 源码包结构

| 包路径 | 职责 |
|---|---|
| `network/connection/peer/` | RakNet 会话管理 |
| `network/connection/client/` | 代理→服务器连接 |
| `network/connection/codec/` | Netty 编解码组件 |
| `network/connection/handler/` | 连接策略接口 |
| `network/protocol/handler/upstream/` | 客户端→代理处理器 |
| `network/protocol/handler/downstream/` | 代理→服务器处理器 |
| `network/protocol/handler/` | 数据包桥接与路由 |
| `network/protocol/rewrite/` | ID 重写 |
| `network/serverinfo/` | 服务器注册 |
| `player/` | 玩家管理 |
| `event/` | 事件系统 |
| `plugin/` | 插件系统 |
| `scheduler/` | 任务调度 |
| `security/` | 安全管理 |
| `command/` | 命令框架 |
| `packs/` | 资源包管理 |
| `utils/config/` | 配置管理 |
| `console/` | 终端控制台 |
