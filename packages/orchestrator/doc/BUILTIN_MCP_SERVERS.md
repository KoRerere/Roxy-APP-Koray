# 内置 MCP 服务器配置指南

本文档说明如何将 `roxybrowser-openapi` 和 `roxybrowser-playwright-mcp` 两个库内置到 orchestrator 项目中。

## 方案概述

将两个 MCP 服务器库的源码放在项目目录中，通过相对路径引用，避免使用 `npx` 或外部安装。

## 目录结构

推荐的项目结构：

```
orchestrator/
├── lib/                          # 内置库目录
│   ├── roxybrowser-openapi/      # OpenAPI MCP 服务器
│   │   ├── package.json
│   │   ├── src/
│   │   └── cli.js (或入口文件)
│   └── roxybrowser-playwright-mcp/  # Playwright MCP 服务器
│       ├── package.json
│       ├── cli.js
│       └── ...
├── mcp-servers.json              # MCP 配置文件
└── src/
    └── mcp/
        └── McpManager.ts         # MCP 管理器
```

## 实施步骤

### 步骤 1: 复制库源码到项目

将两个库的源码复制到 `lib/` 目录：

```bash
# 假设你的库在父目录
cp -r ../roxybrowser-openapi ./lib/
cp -r ../roxybrowser-playwright-mcp ./lib/
```

或者使用符号链接（开发时更方便）：

```bash
# Windows (PowerShell)
New-Item -ItemType SymbolicLink -Path "lib\roxybrowser-openapi" -Target "..\roxybrowser-openapi"
New-Item -ItemType SymbolicLink -Path "lib\roxybrowser-playwright-mcp" -Target "..\roxybrowser-playwright-mcp"

# Linux/Mac
ln -s ../roxybrowser-openapi lib/roxybrowser-openapi
ln -s ../roxybrowser-playwright-mcp lib/roxybrowser-playwright-mcp
```

### 步骤 2: 安装依赖（如果需要）

如果内置库有自己的依赖，需要安装：

```bash
cd lib/roxybrowser-openapi && npm install
cd ../roxybrowser-playwright-mcp && npm install
```

### 步骤 3: 修改 mcp-servers.json

使用相对路径指向本地库：

```json
{
    "mcpServers": {
        "roxybrowser-openapi": {
            "command": "node",
            "args": [
                "./lib/roxybrowser-openapi/cli.js"
            ],
            "env": {
                "ROXY_API_KEY": "4e45a8d60a208604111ff21732b26880",
                "ROXY_API_HOST": "http://127.0.0.1:50000"
            }
        },
        "roxybrowser-playwright-mcp": {
            "transport": "http",
            "command": "node",
            "args": [
                "./lib/roxybrowser-playwright-mcp/cli.js",
                "--roxy-mode",
                "--port",
                "8080"
            ],
            "env": {
                "PLAYWRIGHT_MCP_SNAPSHOT_MODE": "optimized"
            }
        }
    }
}
```

**注意**: `url` 字段在 HTTP transport 模式下会被 McpManager 动态覆盖，所以可以省略或保留作为占位符。

### 步骤 4: 增强 McpManager 路径解析

McpManager 已经支持相对路径，但为了更好的跨平台兼容性，可以增强路径解析逻辑（见下面的代码修改）。

## 代码修改

### 修改 McpManager.ts

增强路径解析，确保相对路径正确解析：

```typescript
// 在 createWorkerClient 方法中，启动服务器前解析路径
const resolvePath = (filePath: string): string => {
    if (path.isAbsolute(filePath)) {
        return filePath;
    }
    // 相对路径从项目根目录解析
    const rootDir = path.resolve(__dirname, "../../");
    return path.resolve(rootDir, filePath);
};

// 在启动服务器时使用
const resolvedArgs = serverConfig.args.map(arg => {
    // 如果是文件路径，解析它
    if (arg.endsWith('.js') || arg.endsWith('.ts') || arg.includes('/') || arg.includes('\\')) {
        return resolvePath(arg);
    }
    return arg;
});
```

## 替代方案：直接导入模块

如果库支持作为模块导入，可以创建包装器直接导入：

### 创建 src/mcp/servers/roxybrowser-openapi.ts

```typescript
// 直接导入库的入口模块
import { startServer } from '../../lib/roxybrowser-openapi/src/index.js';

export async function startRoxybrowserOpenApiServer(port: number, env: Record<string, string>) {
    // 设置环境变量
    Object.assign(process.env, env);
    
    // 启动服务器
    await startServer({ port });
}
```

然后在 McpManager 中调用这个函数而不是 spawn 子进程。

## 验证

1. 检查路径是否正确：
   ```bash
   node -e "console.log(require('path').resolve('./lib/roxybrowser-openapi/cli.js'))"
   ```

2. 测试启动：
   ```bash
   node ./lib/roxybrowser-playwright-mcp/cli.js --roxy-mode --port 8080
   ```

3. 运行 orchestrator 并检查日志，确认 MCP 服务器正常启动。

## 优势

- ✅ 不需要 `npx` 或外部安装
- ✅ 可以修改库的源码
- ✅ 版本控制更简单
- ✅ 部署时不需要额外安装步骤

## 注意事项

1. **路径分隔符**: Windows 使用 `\`，Unix 使用 `/`，使用 `path.resolve()` 可以自动处理
2. **工作目录**: 确保从项目根目录运行，相对路径才能正确解析
3. **依赖管理**: 如果内置库有依赖，确保在项目根目录或库目录中安装
4. **端口冲突**: HTTP transport 模式下，端口会被动态分配，不需要在配置中指定

## 故障排除

### 问题: 找不到模块

**解决**: 检查路径是否正确，使用绝对路径或确保从项目根目录运行。

### 问题: 依赖缺失

**解决**: 在内置库目录中运行 `npm install`。

### 问题: 权限错误

**解决**: 确保文件有执行权限（Unix），或使用 `node` 命令运行 `.js` 文件。

