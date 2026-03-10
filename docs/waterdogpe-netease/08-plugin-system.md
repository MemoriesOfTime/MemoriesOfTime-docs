# 八、插件系统

## 8.1 插件生命周期

```mermaid
flowchart TD
    A["插件 JAR 放入 plugins/ 目录"] --> B["PluginManager 构造函数"]

    subgraph Discovery["发现阶段"]
        B --> C["扫描所有 JAR 文件"]
        C --> D["解析 plugin.yml 元数据"]
        D --> E["按依赖关系拓扑排序"]
        E --> F["为每个插件创建<br/>PluginClassLoader (隔离)"]
    end

    F --> G["loadAllPlugins()"]

    subgraph Loading["加载阶段"]
        G --> H["实例化 Plugin 子类"]
        H --> I["调用 plugin.onStartup()"]
    end

    I --> J["enableAllPlugins()"]

    subgraph Enabling["启用阶段"]
        J --> K["递归解析依赖"]
        K --> L{"循环依赖?"}
        L -- 是 --> M["跳过并记录错误"]
        L -- 否 --> N["先启用依赖插件"]
        N --> O["plugin.setEnabled(true)"]
        O --> P["触发 plugin.onEnable()"]
    end

    P --> Q{{"运行中"}}

    Q --> R["代理关闭"]
    R --> S["disableAllPlugins()"]

    subgraph Disabling["禁用阶段"]
        S --> T["plugin.setEnabled(false)"]
        T --> U["触发 plugin.onDisable()"]
    end

    style Q fill:#e8f5e9,stroke:#2e7d32
    style M fill:#ffcdd2,stroke:#c62828
```

## 8.2 核心类

### Plugin 基类

```mermaid
classDiagram
    class Plugin {
        <<abstract>>
        #boolean enabled
        -PluginYAML description
        -ProxyServer proxy
        -Logger logger
        -File pluginFile
        -File dataFolder
        -Configuration config

        +onStartup() void
        +onEnable()* void
        +onDisable() void
        +loadConfig() void
        +getConfig() Configuration
        +getResourceFile(filename) InputStream
        +saveResource(filename) boolean
        +getName() String
        +setEnabled(enabled) void
    }

    class PluginYAML {
        +String name
        +String version
        +String author
        +String main
        +List~String~ depends
    }

    class PluginManager {
        -Map pluginMap
        -Map pluginClassLoaders
        +loadAllPlugins() void
        +enableAllPlugins() void
        +disableAllPlugins() void
        +getPluginByName(name) Plugin
        +getPlugins() Collection
    }

    class PluginClassLoader {
        -PluginManager pluginManager
        +loadClass(name) Class
    }

    PluginManager o-- Plugin
    PluginManager o-- PluginClassLoader
    Plugin --> PluginYAML
    PluginClassLoader ..> Plugin : loads
```

## 8.3 `waterdog.yml` / `plugin.yml` 配置格式

> 插件加载器会先查找 `waterdog.yml`，找不到时再回退到 `plugin.yml`。
> 当前强制要求的字段只有 `name` 和 `main`；`version`、`author`、`depends` 为可选。

```yaml
name: MyPlugin              # 插件唯一名称（必填）
main: com.example.MyPlugin  # 主类全限定名（必填，需继承 Plugin）
version: 1.0.0              # 版本号（可选）
author: AuthorName          # 作者（可选）
depends:                    # 依赖列表（可选）
  - AnotherPlugin
  - RequiredLib
```

## 8.4 插件可用的钩子

| 钩子类型 | API | 说明 |
|---|---|---|
| **事件监听** | `eventManager.subscribe()` | 拦截登录、聊天、转移等事件 |
| **命令注册** | `commandMap.registerCommand()` | 注册自定义命令 |
| **数据包拦截** | `PluginPacketHandler` | 在 ProxyBatchBridge 管线中拦截数据包 |
| **定时任务** | `scheduler.scheduleRepeating()` | Tick 驱动的定时逻辑 |
| **权限管理** | `player.addPermission()` | 动态权限控制 |
| **配置管理** | `plugin.loadConfig()` | YAML 配置读写 |

## 8.5 插件开发示例

```java
public class MyPlugin extends Plugin {

    @Override
    public void onStartup() {
        // 插件加载时执行（在 onEnable 之前）
        getLogger().info("Plugin loading...");
    }

    @Override
    public void onEnable() {
        // 加载配置
        loadConfig();

        // 注册事件
        getProxy().getEventManager().subscribe(
            PlayerLoginEvent.class,
            this::onPlayerLogin,
            EventPriority.NORMAL
        );

        // 注册命令
        getProxy().getCommandMap().registerCommand(new MyCommand());

        // 定时任务
        getProxy().getScheduler().scheduleRepeating(() -> {
            // 每 20 tick (约1秒) 执行
        }, 20);

        getLogger().info("Plugin enabled!");
    }

    private void onPlayerLogin(PlayerLoginEvent event) {
        ProxiedPlayer player = event.getPlayer();
        player.sendMessage("Welcome to the server!");
    }

    @Override
    public void onDisable() {
        getLogger().info("Plugin disabled!");
    }
}
```
