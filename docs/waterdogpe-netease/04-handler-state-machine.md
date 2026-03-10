# 四、Handler 状态转换链

## 4.1 上游处理器状态机（客户端 → 代理）

```mermaid
stateDiagram-v2
    [*] --> LoginUpstreamHandler : 客户端连接

    state LoginUpstreamHandler {
        [*] --> WaitNetworkSettings : 等待 RequestNetworkSettingsPacket
        WaitNetworkSettings --> VersionCheck : 收到请求
        VersionCheck --> ConfigCompression : 版本校验通过<br/>网易检测(RakNet v8)
        ConfigCompression --> SendNetworkSettings : 设置压缩策略
        SendNetworkSettings --> LoginComplete : 发送 NetworkSettingsPacket
    }

    LoginUpstreamHandler --> ResourcePacksHandler : 登录握手完成
    LoginUpstreamHandler --> Disconnected : 版本不匹配

    state ResourcePacksHandler {
        [*] --> WaitResponse : 等待客户端响应
        WaitResponse --> REFUSED : 客户端拒绝
        WaitResponse --> SEND_PACKS : 需要发送资源包
        WaitResponse --> HAVE_ALL : 客户端已拥有全部
        SEND_PACKS --> HAVE_ALL : 发送完成
        HAVE_ALL --> COMPLETED : 构建堆栈包<br/>触发事件
    }

    ResourcePacksHandler --> ConnectedUpstreamHandler : COMPLETED
    REFUSED --> Disconnected

    state ConnectedUpstreamHandler {
        [*] --> Steady : 稳定状态
        Steady --> Steady : RequestChunkRadiusPacket<br/>PlayerActionPacket<br/>TextPacket<br/>CommandRequestPacket

        note right of Steady
            通过 targetConnection
            动态指向当前下游连接
            服务器转移时自动切换
        end note
    }

    ConnectedUpstreamHandler --> Disconnected : 玩家断开
    Disconnected --> [*]
```

## 4.2 下游处理器状态机（代理 → 服务器）

```mermaid
stateDiagram-v2
    [*] --> InitialHandler : 下游连接建立(首次)
    [*] --> SwitchDownstreamHandler : 下游连接建立(转移)

    state InitialHandler {
        [*] --> Handshake : 等待服务器握手
        Handshake --> Encryption : ServerToClientHandshakePacket<br/>配置加密
        Encryption --> ResourcePack : ResourcePacksInfoPacket<br/>资源包协商
        ResourcePack --> StartGame : ResourcePackStackPacket
        StartGame --> InitRewrite : StartGamePacket

        state InitRewrite {
            [*] --> SetEntityId : entityId / originalEntityId
            SetEntityId --> SetBlockMap : 版本<=1.16.20 BlockMap<br/>版本>1.16.20 BlockMapSimple
            SetBlockMap --> SetDefinitions : 配置 FakeDefinitionRegistry
            SetDefinitions --> EnableRewrite : canRewrite = true
        }
    }

    InitialHandler --> ConnectedDownstreamHandler : 初始化完成<br/>trigger InitialServerConnectedEvent

    state ConnectedDownstreamHandler {
        [*] --> Active : 稳定状态
        Active --> Active : PlayStatusPacket(PLAYER_SPAWN)<br/>→ 发送 SetLocalPlayerAsInitialized
        Active --> FastTransfer : TransferPacket<br/>→ FastTransferRequestEvent
        Active --> HandleDisconnect : DisconnectPacket<br/>→ 尝试回退服务器
    }

    SwitchDownstreamHandler --> ConnectedDownstreamHandler : 转移阶段完成

    ConnectedDownstreamHandler --> [*] : 连接关闭
    FastTransfer --> [*] : 发起新连接
    HandleDisconnect --> [*] : 回退失败则断开
```

## 4.3 上下游处理器对应关系

```mermaid
graph LR
    subgraph 上游["上游 (客户端→代理)"]
        LUH["LoginUpstreamHandler"]
        RPH["ResourcePacksHandler"]
        CUH["ConnectedUpstreamHandler"]
    end

    subgraph 桥接["桥接层"]
        PBB["ProxyBatchBridge"]
        PPH["PluginPacketHandler"]
        TC["TransferCallback"]
    end

    subgraph 下游["下游 (代理→服务器)"]
        IH["InitialHandler"]
        SDH["SwitchDownstreamHandler"]
        CDH["ConnectedDownstreamHandler"]
    end

    CUH <--> PBB
    CDH <--> PBB
    PBB --- PPH
    PBB --- TC
    IH --> CDH
    SDH --> CDH

    style PBB fill:#e1f5fe,stroke:#01579b
    style TC fill:#fff3e0,stroke:#e65100
```

## 4.4 各处理器处理的关键数据包

### ConnectedUpstreamHandler（上游稳定态）

| 数据包 | 处理逻辑 | 返回信号 |
|---|---|---|
| `RequestChunkRadiusPacket` | 存储半径值并转发 | UNHANDLED |
| `PlayerActionPacket` (DIMENSION_CHANGE_SUCCESS) | 转发给 TransferCallback | CANCEL |
| `TextPacket` | 触发 PlayerChatEvent，可取消 | HANDLED/CANCEL |
| `CommandRequestPacket` | 代理命令处理或转发 | UNHANDLED/CANCEL |
| `ClientCacheBlobStatusPacket` | 块数据缓存管理 | UNHANDLED |

### ConnectedDownstreamHandler（下游稳定态）

| 数据包 | 处理逻辑 | 返回信号 |
|---|---|---|
| `PlayStatusPacket` (PLAYER_SPAWN) | 发送 SetLocalPlayerAsInitialized | UNHANDLED |
| `TransferPacket` | 触发 FastTransferRequestEvent，发起快速转移 | CANCEL |
| `DisconnectPacket` | 尝试 sendToFallback，失败则断开 | CANCEL |
| `ItemComponentPacket` | 更新物品定义 (v1.21.60+) | HANDLED |
