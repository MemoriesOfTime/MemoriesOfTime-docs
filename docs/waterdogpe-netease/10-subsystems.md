# 十、其他子系统

## 10.1 调度系统（Scheduler）

### 架构

```mermaid
flowchart TD
    subgraph API["调度 API"]
        A1["scheduleAsync(task)"]
        A2["scheduleDelayed(task, delay)"]
        A3["scheduleRepeating(task, period)"]
        A4["scheduleDelayedRepeating(task, delay, period)"]
    end

    API --> PQ["pendingTasks<br/>待分配队列"]

    subgraph Tick["onTick(currentTick)"]
        direction TB
        T1["分配待处理任务<br/>到对应 Tick"]
        T2["取出当前 Tick<br/>的所有任务"]
        T3{"同步/异步?"}
        T4["直接执行"]
        T5["提交线程池"]
        T6{"重复任务?"}
        T7["计算 nextRunTick<br/>重新入队"]
        T8["任务完成，移除"]

        T1 --> T2
        T2 --> T3
        T3 -- 同步 --> T4
        T3 -- 异步 --> T5
        T4 --> T6
        T5 --> T6
        T6 -- 是 --> T7
        T6 -- 否 --> T8
    end

    PQ --> Tick
```

### 核心类

| 类 | 职责 |
|---|---|
| `WaterdogScheduler` | Tick 驱动的任务调度器，管理任务注册和执行 |
| `TaskHandler<T>` | 单个任务的包装器，记录 ID、延迟、周期、下次执行 Tick |
| `Task` | 任务抽象基类，提供 `onRun()`、`onCancel()`、`onError()` |
| `CallbackTask` | 基于 Runnable 的简单回调任务 |

### 调度方法

| 方法 | 延迟 | 重复 | 异步 |
|---|---|---|---|
| `scheduleAsync(task)` | 否 | 否 | 是 |
| `scheduleTask(task, async)` | 否 | 否 | 可选 |
| `scheduleDelayed(task, delay)` | 是 | 否 | 可选 |
| `scheduleRepeating(task, period)` | 否 | 是 | 可选 |
| `scheduleDelayedRepeating(task, delay, period)` | 是 | 是 | 可选 |

---

## 10.2 安全系统（Security）

### 架构

```mermaid
flowchart TD
    CONN["收到数据报"] --> CHECK{"isAddressBlocked()"}
    CHECK -- "是" --> REJECT["ServerDatagramHandler 丢弃请求"]
    CHECK -- "否" --> SM["SecurityManager"]

    SM --> CT{"ConnectionThrottle<br/>connectionThrottle"}
    CT -- 超限 --> TH1["onThrottleReached()<br/>默认拒绝本次连接"]
    CT -- 通过 --> LA["onLoginAttempt()"]

    LA --> LT{"ConnectionThrottle<br/>loginThrottle"}
    LT -- 超限 --> TH2["onThrottleReached()<br/>默认拒绝本次登录"]
    LT -- 通过 --> ALLOW["允许连接/登录"]

    TH1 --> OPT["监听器可选调用 blockAddress()"]
    TH2 --> OPT

    style TH1 fill:#fff3e0,stroke:#e65100
    style TH2 fill:#fff3e0,stroke:#e65100
    style OPT fill:#e3f2fd,stroke:#1565c0
    style ALLOW fill:#e8f5e9,stroke:#2e7d32
```

### ConnectionThrottle 工作机制

| 步骤 | 操作 |
|---|---|
| 请求到达 IP X | 检查 ExpiringMap 中的记录 |
| X 无记录 | 创建 `Entry(limit)`，计数 → 1，返回 true |
| X 计数 < limit | 计数 + 1，返回 true |
| X 计数 >= limit | 返回 false，并回调 `onThrottleReached()`；不会自动调用 `blockAddress()` |
| 记录在 throttleTime 后自动过期 | |

---

## 10.3 命令系统（Command）

### 架构

```mermaid
classDiagram
    class CommandSender {
        <<interface>>
        +getName() String
        +isPlayer() boolean
        +hasPermission(perm) boolean
        +sendMessage(msg) void
    }

    class CommandMap {
        <<interface>>
        +registerCommand(cmd) boolean
        +unregisterCommand(name) boolean
        +handleMessage(sender, msg) boolean
        +getCommand(name) Command
    }

    class Command {
        <<abstract>>
        +CommandSettings settings
        +onExecute(sender, alias, args) boolean
        +getPermission() String
        +getAliases() Set
    }

    class SimpleCommandMap {
        -Map commands
        +handleCommand(sender, cmd, args) boolean
    }

    class ProxiedPlayer {
        +sendMessage(msg) void
    }

    class ConsoleCommandSender {
        +sendMessage(msg) void
    }

    CommandSender <|.. ProxiedPlayer
    CommandSender <|.. ConsoleCommandSender
    CommandMap <|.. SimpleCommandMap
    SimpleCommandMap o-- Command
```

### 内置命令

| 命令 | 类 | 说明 |
|---|---|---|
| `help` | `HelpCommand` | 显示帮助信息 |
| `list` | `ListCommand` | 显示在线玩家列表 |
| `server` | `ServerCommand` | 切换服务器 |
| `send` | `SendCommand` | 发送玩家到指定服务器 |
| `end` | `EndCommand` | 关闭代理 |
| `info` | `InfoCommand` | 显示系统信息 |
| `plugins` | `PluginsCommand` | 显示已加载插件 |
| `status` | `StatusCommand` | 显示代理状态 |

---

## 10.4 配置系统（Config）

```mermaid
classDiagram
    class Configuration {
        <<abstract>>
        #Map config
        +get(key) Object
        +get(key, default) Object
        +set(key, value) void
        +getString(key) String
        +getInt(key) Integer
        +getBoolean(key) Boolean
        +getList(key) List
        +save() void
        +load(is) void
    }

    class YamlConfig {
        +save() void
        +load(is) void
    }

    class JsonConfig {
        +save() void
        +load(is) void
    }

    class LangConfig {
        +translateString(key, params) String
    }

    class ProxyConfig {
        <<Yamler>>
        +InetSocketAddress bindAddress
        +int maxPlayerCount
        +String motd
        +ServerList serverList
        +List priorities
        +NetworkSettings networkSettings
    }

    Configuration <|-- YamlConfig
    Configuration <|-- JsonConfig
```

支持嵌套键（dot notation）：`"server.name"` 自动解析为 `map["server"]["name"]`

---

## 10.5 资源包系统（PackManager）

### 资源包分类

| 类型 | 常量 | 适用范围 |
|---|---|---|
| 资源包（纹理、音乐等） | `TYPE_RESOURCES` | 通用（UNIVERSAL） |
| 行为包 | `TYPE_DATA` / `TYPE_BEHAVIOR` | 仅网易客户端 |

### 协议版本适配

| 版本 | 行为 |
|---|---|
| v729+ | `behaviorPackInfos` 合并到 `resourcePackInfos` |
| v898+ | `behaviorPacks` 合并到 `resourcePacks` |

### 资源包处理流程

```mermaid
sequenceDiagram
    participant PM as PackManager
    participant RPH as ResourcePacksHandler
    participant C as 客户端

    PM->>PM: loadPacks(packsDirectory)<br/>扫描并注册资源包
    PM->>PM: rebuildPackets()<br/>构建发送数据包

    RPH->>C: ResourcePacksInfoPacket<br/>(资源包列表)
    C->>RPH: ResourcePackClientResponsePacket

    alt SEND_PACKS
        loop 每个需要的包
            RPH->>C: ResourcePackDataInfoPacket
            C->>RPH: ResourcePackChunkRequestPacket
            RPH->>C: ResourcePackChunkDataPacket<br/>(分块传输)
        end
    end

    RPH->>C: ResourcePackStackPacket<br/>(堆栈顺序)
    C->>RPH: COMPLETED
```
