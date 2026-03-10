# 五、服务器转移（Transfer）完整流程

服务器转移是 WaterdogPE 最复杂的功能之一，需要在客户端无感知的情况下将玩家从一个后端服务器迁移到另一个。

## 5.1 转移触发与连接建立

```mermaid
sequenceDiagram
    participant P as ProxiedPlayer
    participant EVT as EventManager
    participant BSI as BedrockServerInfo
    participant SDH as SwitchDownstreamHandler
    participant TC as TransferCallback
    participant C as 客户端

    Note over P: 触发: TransferPacket / player.connect()

    P->>EVT: ServerTransferRequestEvent
    EVT-->>P: 未取消，继续

    P->>BSI: createConnection(player)
    Note over BSI: Bootstrap 创建 RakNet 连接<br/>绑定上游相同 EventLoop
    BSI-->>P: 新 ClientConnection

    P->>EVT: ServerConnectedEvent
    EVT-->>P: 未取消，继续

    P->>P: 设置 SwitchDownstreamHandler
    P->>C: 上游添加 PacketQueueHandler<br/>(排队客户端所有包)

    Note over SDH: 新连接握手开始
    SDH->>SDH: 加密协商
    SDH->>SDH: 资源包协商
    SDH->>SDH: StartGamePacket 处理
    Note over SDH: 更新 RewriteData<br/>设置 TransferCallback

    SDH->>TC: 启动两阶段维度变化
```

## 5.2 两阶段维度变化（TransferCallback）

两阶段维度变化是实现无缝转移的核心机制。Minecraft 客户端在同一维度内无法直接重置世界数据，因此需要通过两次维度切换来清除客户端缓存。

```mermaid
sequenceDiagram
    participant TC as TransferCallback
    participant C as 客户端
    participant PQH as PacketQueueHandler

    rect rgb(255, 243, 224)
        Note over TC,C: Phase 1: 第一次维度变化
        TC->>C: ChangeDimensionPacket<br/>(切到中间维度)
        C->>TC: PlayerActionPacket<br/>(DIMENSION_CHANGE_SUCCESS)
        TC->>TC: onTransferPhase1Completed()
        TC->>C: injectEntityImmobile()<br/>(注入不可移动标志)
        TC->>C: injectPosition(-2000, -2000)<br/>(注入虚假位置)
        TC->>C: injectDimensionChange()<br/>(第二次维度变化包)
    end

    rect rgb(232, 245, 233)
        Note over TC,C: Phase 2: 第二次维度变化
        C->>TC: PlayerActionPacket<br/>(DIMENSION_CHANGE_SUCCESS)
        TC->>TC: onTransferPhase2Completed()
        TC->>C: stopSound("portal.travel")
        TC->>C: injectPosition()<br/>(恢复真实位置)
        TC->>C: SetLocalPlayerAsInitializedPacket
        TC->>PQH: 移除 PacketQueueHandler<br/>(恢复正常转发)
        TC->>TC: 更新 ConnectedUpstreamHandler.targetConnection
        TC->>TC: trigger TransferCompleteEvent
    end

    Note over TC,C: 转移完成，玩家在新服务器正常游戏
```

## 5.3 转移阶段状态

```mermaid
stateDiagram-v2
    [*] --> PHASE_1 : 转移开始<br/>注入第一次维度变化

    PHASE_1 --> PHASE_2 : 客户端确认<br/>DIMENSION_CHANGE_SUCCESS

    note right of PHASE_1
        - 注入 EntityImmobile
        - 注入虚假位置
        - 注入第二次维度变化
    end note

    PHASE_2 --> RESET : 客户端确认<br/>DIMENSION_CHANGE_SUCCESS

    note right of PHASE_2
        - 停止传送门音效
        - 恢复真实位置
        - 发送 Initialized 包
        - 移除 PacketQueueHandler
        - 触发 TransferCompleteEvent
    end note

    RESET --> [*] : 转移完成
```

## 5.4 转移过程中的数据包处理

| 阶段 | 客户端 → 代理 | 代理 → 旧服务器 | 代理 → 新服务器 |
|---|---|---|---|
| **转移开始** | PacketQueueHandler 排队所有包 | 继续处理 | 建立连接 |
| **Phase 1** | 排队，等待维度变化确认 | - | `SwitchDownstreamHandler` 握手 |
| **Phase 2** | 排队，等待维度变化确认 | 连接关闭 | 切换到 ConnectedDownstreamHandler |
| **转移完成** | PacketQueueHandler 移除，恢复正常 | - | 正常双向转发 |

## 5.5 完整转移事件链

```mermaid
graph TD
    A["player.connect(targetServer)"] --> B["ServerTransferRequestEvent<br/>(可取消)"]
    B --> C["创建下游连接"]
    C --> D["ServerConnectedEvent<br/>(可取消)"]
    D --> F["SwitchDownstreamHandler 处理握手"]
    F --> G["StartGamePacket<br/>更新 RewriteData"]
    G --> E["ServerTransferEvent<br/>(通知)"]
    E --> H["TransferCallback<br/>两阶段维度变化"]
    H --> I["TransferCompleteEvent<br/>(@AsyncEvent)"]
    I --> J["PostTransferCompleteEvent<br/>(@AsyncEvent)"]

    style A fill:#e3f2fd,stroke:#1565c0
    style H fill:#fff3e0,stroke:#e65100
    style I fill:#e8f5e9,stroke:#2e7d32
```
