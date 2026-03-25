# 六、netty-codec-rcon 模块

## 6.1 模块定位

`netty-codec-rcon` 是仓库中的一个 **遗留 Maven 模块**，源码目录为 `codec-rcon/`。

它实现的是一个基于 Netty 的 **RCON 服务端监听与编解码组件**，目标职责包括：

- 监听 TCP RCON 连接
- 对 RCON 报文做长度帧拆包与消息编解码
- 处理认证请求
- 在认证通过后把命令转发给业务回调执行
- 将命令输出封装为 RCON 响应发回客户端

> 该模块属于保留在仓库中的旧模块，不在当前 Gradle 主构建中。

## 6.2 模块整体职责

这个模块要解决的问题可以概括成一句话：

> 把 RCON TCP 连接收到的长度前缀消息解码成 `RconMessage`，在认证成功后把命令交给业务回调执行，再把执行结果编码成 RCON 响应包发回客户端。

| 层次 | 责任 |
| --- | --- |
| 监听层 | 绑定 TCP 地址并初始化 channel pipeline |
| 帧处理层 | 使用长度字段拆包和加包 |
| 协议编解码层 | `ByteBuf` 与 `RconMessage` 互转 |
| 业务处理层 | 登录认证、命令执行、响应回写 |

## 6.3 目录与类职责概览

| 类/文件 | 作用 |
| --- | --- |
| `RconNetworkListener` | 启动 RCON TCP 监听并装配 pipeline |
| `RconCodec` | 将字节流与 `RconMessage` 对象相互转换 |
| `RconHandler` | 处理认证与执行命令 |
| `RconMessage` | RCON 消息模型与类型常量 |
| `RconEventListener` | 命令执行回调接口 |

## 6.4 运行流程

### 启动流程

`RconNetworkListener` 继承 `ChannelInitializer<SocketChannel>`，同时实现 `NetworkListener`。构造时会做以下事情：

1. 保存业务回调 `RconEventListener`
2. 保存密码字节数组 `password`
3. 用传入的 `address` 和 `port` 构造监听地址
4. 创建 `ServerBootstrap`
5. 通过 `Bootstraps.setupServerBootstrap(bootstrap)` 和 `EventLoops.commonGroup()` 配置服务端引导器
6. 创建一个单线程 `ExecutorService`，名字为 `RCON Command Executor`

### Pipeline 结构

在 `initChannel()` 中，模块依次向 pipeline 添加以下处理器：

1. `lengthDecoder` - `LengthFieldBasedFrameDecoder`：按长度字段拆分完整 RCON 帧
2. `rconDecoder` - `RconCodec`：将完整帧转成 `RconMessage`
3. `rconHandler` - `RconHandler`：做认证与命令执行
4. `lengthPrepender` - `LengthFieldPrepender`：自动为出站响应补上长度字段
5. `exceptionHandler` - 统一处理异常

### 数据流

```mermaid
flowchart LR
    A[TCP Byte Stream] --> B[LengthFieldBasedFrameDecoder]
    B --> C[RconCodec decode]
    C --> D[RconMessage]
    D --> E[RconHandler]
    E --> F[RconEventListener.onMessage]
    F --> G[RconMessage Response]
    G --> H[RconCodec encode]
    H --> I[LengthFieldPrepender]
    I --> J[TCP Response Bytes]
```

## 6.5 RCON 协议模型

### `RconMessage`

`RconMessage` 是模块内部唯一的协议对象，字段非常简单：

- `id`：请求/响应关联 ID
- `type`：消息类型
- `body`：消息体字符串

关键常量：

- `AUTH = 3`
- `AUTH_RESPONSE = 2`
- `EXECCOMMAND = 2`
- `RESPONSE_VALUE = 0`

> `AUTH_RESPONSE` 和 `EXECCOMMAND` 都是 `2`，这不是代码笔误，而是当前实现里直接按 RCON 协议常见取值建模。

### 消息帧格式

从 pipeline 配置和 `RconCodec` 可推断当前实现的帧格式为：

1. 长度字段：4 字节，小端，由 `LengthFieldPrepender` 写入
2. 请求/响应 ID：4 字节，小端
3. 消息类型：4 字节，小端
4. 消息正文：ASCII 文本
5. 两个空字节结尾

## 6.6 编解码层分析

### `RconCodec` 的编码逻辑

1. 写入 `id`（`writeIntLE`）
2. 写入 `type`（`writeIntLE`）
3. 使用 `ByteBufUtil.writeAscii()` 写入 `body`
4. 追加两个 `0` 字节作为结尾

### `RconCodec` 的解码逻辑

1. 读取 `id`（小端 int）
2. 读取 `type`（小端 int）
3. 读取一个以 `\0` 结尾的字符串作为 `body`
4. 把剩余字节直接丢弃
5. 组装为 `RconMessage`

### 编码与分帧之间的关系

- `RconCodec` 只编码消息内容本体
- `LengthFieldPrepender` 负责补齐最外层长度字段
- `LengthFieldBasedFrameDecoder` 在入站方向把长度字段剥离后，再交给 `RconCodec` 解码

## 6.7 业务处理层分析

### `RconEventListener`

模块对业务侧只暴露了一个非常简洁的回调接口：

```java
String onMessage(String message);
```

### `RconHandler` 的认证逻辑

`RconHandler` 内部维护一个布尔状态 `authed`，默认值为 `false`。在未认证状态下：

1. 如果消息类型不是 `AUTH`，直接忽略
2. 从消息体读取客户端发送的密码
3. 先回一个空的 `RESPONSE_VALUE` 包
4. 再用 `MessageDigest.isEqual(password, sentPassword)` 做密码比较
5. 如果匹配，设置 `authed = true`，并回 `AUTH_RESPONSE`
6. 如果不匹配，回一个 `id = -1` 的 `AUTH_RESPONSE`

### 命令执行逻辑

当连接已经认证，且消息类型为 `EXECCOMMAND` 时：

1. 调用 `eventListener.onMessage(rconMessage.getBody())`
2. 取得字符串输出
3. 用相同 `id` 和 `RESPONSE_VALUE` 类型回写响应

## 6.8 当前实现的注意点

### `getAddress()` 当前返回 `null`

`RconNetworkListener` 明明有成员字段 `private final InetSocketAddress address;`，但 `getAddress()` 当前实现直接返回 `null`。

### `commandExecutionService` 已创建，但未接入命令执行

类中创建了一个单线程执行器 `commandExecutionService`，名字也明确表示它是用于命令执行的线程池，但当前源码中：

- 它只在构造时创建
- 只在 `close()` 中关闭
- `RconHandler` 执行命令时并没有把任务提交到这个执行器

因此当前命令执行实际上仍在 Netty handler 的调用路径中同步完成。

### 编码与密码比较的字符集策略并不完全一致

- `RconCodec.encode()` 使用 `writeAscii()` 写响应正文
- `RconCodec.decode()` 按字节逐个转字符读取字符串
- `RconHandler` 比较密码时则使用 `CharsetUtil.UTF_8` 获取字节数组

对于非 ASCII 内容，尤其是包含中文或其他多字节字符的命令输出，需要额外关注兼容性。

### 没有显式的登录失败限流或断开策略

如果密码错误，当前行为是：

- 返回 `id = -1` 的 `AUTH_RESPONSE`
- 不主动关闭连接
- 没有看到错误次数统计、限流或封禁逻辑

### 没有输出分片逻辑

命令执行后的输出是一次性封装进一个 `RconMessage`。当前实现中没有看到：

- 长输出分片
- 多响应包拼装
- 结果截断提示

### 当前最大帧长度被固定为 `4096`

`LengthFieldBasedFrameDecoder` 使用的最大帧长度是 `4096`。如果业务场景里命令输出很大，需要重新评估这个限制。

## 6.9 使用方式

最直接的接入方式：

1. 实现一个 `RconEventListener`
2. 在 `onMessage()` 中执行命令并返回结果字符串
3. 准备好密码字节数组
4. 创建 `RconNetworkListener(eventListener, password, address, port)`
5. 调用 `bind()` 启动监听
6. 在关闭阶段调用 `close()`

调用方真正需要决定的只有三件事：

- RCON 监听在哪个地址和端口
- 认证密码是什么
- 收到命令后怎么执行业务逻辑
