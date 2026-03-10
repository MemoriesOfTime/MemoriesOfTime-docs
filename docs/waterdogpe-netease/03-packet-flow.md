# 三、数据包完整流转路径

## 3.1 上游路径（客户端 → 代理 → 下游服务器）

```mermaid
sequenceDiagram
    participant C as 客户端
    participant FI as FrameIdCodec
    participant CC as CompressionCodec
    participant BD as BatchDecoder
    participant PC as PacketCodec
    participant PBP as ProxiedBedrockPeer
    participant BSS as BedrockServerSession
    participant PBB as ProxyBatchBridge
    participant CUH as ConnectedUpstreamHandler
    participant DS as 下游服务器

    C->>FI: RakNet UDP 数据报
    FI->>CC: 移除帧ID (0xfe)
    CC->>BD: 解压缩
    BD->>PC: 拆分为单包列表
    PC->>PBP: 反序列化 BedrockPacket
    PBP->>BSS: 路由到对应会话
    BSS->>PBB: onBedrockBatch()

    loop 遍历每个 BedrockPacketWrapper
        PBB->>PBB: decodePacket() (按需)
        PBB->>CUH: handlePacket(packet)
        CUH-->>PBB: PacketSignal
        PBB->>PBB: doPacketRewrite() (EntityMap)
        PBB->>PBB: 信号决策 (HANDLED/UNHANDLED/CANCEL)
    end

    PBB->>CUH: sendProxiedBatch()
    CUH->>DS: ClientConnection.sendPacket()
```

## 3.2 下游路径（下游服务器 → 代理 → 客户端）

```mermaid
sequenceDiagram
    participant DS as 下游服务器
    participant BCC as BedrockClientConnection
    participant PBB as ProxyBatchBridge
    participant CDH as ConnectedDownstreamHandler
    participant BSS as BedrockServerSession
    participant C as 客户端

    DS->>BCC: RakNet 数据 (解帧/解压/解码后)
    BCC->>PBB: onBedrockBatch()

    loop 遍历每个 BedrockPacketWrapper
        PBB->>CDH: handlePacket(packet)
        CDH-->>PBB: PacketSignal
        PBB->>PBB: doPacketRewrite()
        Note over PBB: BlockMap + EntityMap 重写
    end

    PBB->>CDH: sendProxiedBatch()
    CDH->>BSS: player.getConnection().sendPacket()
    BSS->>C: 编码 → 压缩 → 帧ID → RakNet
```

## 3.3 ProxyBatchBridge 处理流程详解

```mermaid
flowchart TD
    Start["onBedrockBatch(batch)"] --> Loop["遍历 BedrockPacketWrapper"]

    Loop --> Decode{"packetBuffer<br/>存在?"}
    Decode -- 是 --> DoDecode["decodePacket()"]
    Decode -- 否 --> Handle
    DoDecode --> Handle["handler.handlePacket(packet)"]

    Handle --> Signal1["signal1 = 处理结果"]
    Signal1 --> Rewrite["handler.doPacketRewrite(packet)"]
    Rewrite --> Signal2["signal2 = 重写结果"]
    Signal2 --> Merge["mergeSignals(signal1, signal2)"]

    Merge --> Decision{合并信号}

    Decision -- HANDLED --> ModBatch["释放原始buffer<br/>标记batch.modify()<br/>保留packet对象"]
    Decision -- UNHANDLED --> KeepBuf["保留原始buffer<br/>零拷贝快速路径"]
    Decision -- CANCEL --> Remove["从批处理中移除<br/>释放资源<br/>标记batch.modify()"]

    ModBatch --> Next["下一个包"]
    KeepBuf --> Next
    Remove --> Next

    Next --> Loop
    Next --> Empty{"批处理<br/>为空?"}
    Empty -- 否 --> Send["sendProxiedBatch(batch)"]
    Empty -- 是 --> End["结束"]
    Send --> End

    style Decision fill:#fff3e0,stroke:#e65100
    style Send fill:#e8f5e9,stroke:#2e7d32
```

## 3.4 PacketSignal 信号机制

| 信号 | 含义 | 对批处理的影响 |
|---|---|---|
| `HANDLED` | 数据包被处理/修改 | 释放原始 buffer，标记需重新编码 |
| `UNHANDLED` | 数据包未处理 | 保留原始 buffer（零拷贝快速路径） |
| `CANCEL` | 数据包被取消 | 从批处理中移除，释放资源 |

### 信号合并规则（`Signals.mergeSignals`）

```mermaid
graph LR
    subgraph 合并规则
        A["CANCEL + 任意 = CANCEL"]
        B["HANDLED + 非CANCEL = HANDLED"]
        C["UNHANDLED + UNHANDLED = UNHANDLED"]
    end

    style A fill:#ffcdd2,stroke:#c62828
    style B fill:#fff9c4,stroke:#f9a825
    style C fill:#c8e6c9,stroke:#2e7d32
```

> 优先级：CANCEL > HANDLED > UNHANDLED
