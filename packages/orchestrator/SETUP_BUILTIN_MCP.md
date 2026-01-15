# 内置 MCP 服务器快速设置指南

## 快速开始

### 1. 准备库源码

将两个库的源码复制或链接到 `lib/` 目录：

**选项 A: 复制源码（推荐用于生产环境）**
```bash
# 在项目根目录执行
mkdir -p lib
cp -r ../roxybrowser-openapi ./lib/
cp -r ../roxybrowser-playwright-mcp ./lib/
```

**选项 B: 使用符号链接（推荐用于开发）**
```bash
# Windows (PowerShell, 以管理员身份运行)
New-Item -ItemType SymbolicLink -Path "lib\roxybrowser-openapi" -Target "..\roxybrowser-openapi"
New-Item -ItemType SymbolicLink -Path "lib\roxybrowser-playwright-mcp" -Target "..\roxybrowser-playwright-mcp"

# Linux/Mac
mkdir -p lib
ln -s ../roxybrowser-openapi lib/roxybrowser-openapi
ln -s ../roxybrowser-playwright-mcp lib/roxybrowser-playwright-mcp
```

### 2. 安装库依赖

如果内置库有自己的依赖，需要安装：

```bash
cd lib/roxybrowser-openapi && npm install && cd ../..
cd lib/roxybrowser-playwright-mcp && npm install && cd ../..
```

### 3. 验证配置

`mcp-servers.json` 已经配置为使用相对路径：

```json
{
    "mcpServers": {
        "roxybrowser-openapi": {
            "command": "node",
            "args": ["./lib/roxybrowser-openapi/cli.js"],
            ...
        },
        "roxybrowser-playwright-mcp": {
            "transport": "http",
            "command": "node",
            "args": ["./lib/roxybrowser-playwright-mcp/cli.js", "--roxy-mode", "--port", "8080"],
            ...
        }
    }
}
```

### 4. 测试启动

测试库是否可以正常启动：

```bash
# 测试 roxybrowser-openapi
node ./lib/roxybrowser-openapi/cli.js

# 测试 roxybrowser-playwright-mcp
node ./lib/roxybrowser-playwright-mcp/cli.js --roxy-mode --port 8080
```

### 5. 运行 Orchestrator

```bash
npm start
```

检查日志，应该看到 MCP 服务器成功启动的消息。

## 目录结构

设置完成后的目录结构应该是：

```
orchestrator/
├── lib/
│   ├── roxybrowser-openapi/
│   │   ├── cli.js (或入口文件)
│   │   ├── package.json
│   │   └── ...
│   └── roxybrowser-playwright-mcp/
│       ├── cli.js
│       ├── package.json
│       └── ...
├── mcp-servers.json
└── src/
    └── mcp/
        └── McpManager.ts
```

## 故障排除

### 问题: 找不到模块

**错误信息**: `Error: Cannot find module './lib/roxybrowser-openapi/cli.js'`

**解决方案**:
1. 确认库已复制/链接到 `lib/` 目录
2. 检查文件路径是否正确
3. 确认从项目根目录运行

### 问题: 依赖缺失

**错误信息**: `Error: Cannot find module 'xxx'`

**解决方案**:
```bash
cd lib/roxybrowser-openapi && npm install
cd ../roxybrowser-playwright-mcp && npm install
```

### 问题: 端口被占用

**错误信息**: `Port 8080 is already in use`

**解决方案**: 
- HTTP transport 模式下，端口会被动态分配，不需要担心
- 如果仍有问题，检查是否有残留进程：
  ```bash
  # Windows
  netstat -ano | findstr :8080
  
  # Linux/Mac
  lsof -i :8080
  ```

### 问题: 权限错误

**解决方案**: 
- Windows: 确保有执行权限
- Linux/Mac: `chmod +x lib/roxybrowser-*/cli.js` (如果需要)

## 自定义路径

如果库不在 `lib/` 目录，可以修改 `mcp-servers.json` 中的路径：

```json
{
    "mcpServers": {
        "roxybrowser-openapi": {
            "command": "node",
            "args": ["./custom/path/to/roxybrowser-openapi/cli.js"],
            ...
        }
    }
}
```

McpManager 会自动解析相对路径（相对于项目根目录）。

## 优势

✅ **无需 npx**: 不需要通过 npx 安装和运行  
✅ **版本控制**: 可以锁定特定版本的库  
✅ **易于修改**: 可以直接修改库的源码  
✅ **部署简单**: 所有代码都在项目中，部署时不需要额外步骤

## 下一步

- 查看 [BUILTIN_MCP_SERVERS.md](./doc/BUILTIN_MCP_SERVERS.md) 了解详细技术说明
- 查看 [WORKER_ISOLATION.md](./WORKER_ISOLATION.md) 了解 Worker 隔离架构

