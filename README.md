# MCP MSSQL 工具

## 📖 项目介绍

这是一个简单的 MCP (Model Context Protocol) 工具，用于执行可定制参数的 MSSQL 数据库操作。它旨在提供一个灵活的方式来操作MSSQL数据库，包括连接管理、SQL执行和自动断开功能。

**NPM 仓库地址:** [`@zb2947244682/mcp-mssql`](https://www.npmjs.com/package/@zb2947244682/mcp-mssql)

## 🚀 核心功能

此 MCP 服务提供了强大的 MSSQL 数据库操作工具：

### `connect_database` 工具

建立与MSSQL数据库的连接，支持完整的连接参数配置。

#### 参数说明

| 参数 | 类型 | 必填 | 默认值 | 描述 |
|------|------|------|--------|------|
| `server` | 字符串 | ✅ | - | 数据库服务器地址 (IP或域名) |
| `database` | 字符串 | ✅ | - | 要连接的数据库名称 |
| `user` | 字符串 | ✅ | - | 数据库用户名 |
| `password` | 字符串 | ✅ | - | 数据库密码 |
| `port` | 数字 | ❌ | 1433 | 数据库端口 |
| `encrypt` | 布尔值 | ❌ | true | 是否启用加密连接 |
| `trustServerCertificate` | 布尔值 | ❌ | false | 是否信任服务器证书 |

#### 使用示例

```json
{
  "tool": "connect_database",
  "params": {
    "server": "localhost",
    "database": "testdb",
    "user": "sa",
    "password": "your_password",
    "port": 1433,
    "encrypt": true
  }
}
```

## ⚙️ 配置说明

### 在 Cursor 中配置

将以下配置添加到您的 Cursor `mcp.json` 文件中：

```json
{
  "mcp-mssql": {
    "command": "npx",
    "args": [
      "-y",
      "@zb2947244682/mcp-mssql"
    ]
  }
}
```

### 通过 npx 直接运行

您可以通过以下命令直接从命令行运行此 MCP 项目：

```bash
npx @zb2947244682/mcp-mssql
```

## 本地开发配置

如果您在本地开发环境中使用，可以将以下配置添加到您的 Cursor `mcp.json` 文件中：

```json
{
  "mcp-mssql": {
    "command": "node",
    "args": ["D:\\Codes\\MCPRepo\\mcp-mssql\\index.js"]
  }
}
```

## 📋 支持的操作

- **CREATE** - 创建表、视图、存储过程
- **INSERT** - 插入数据
- **SELECT** - 查询数据
- **UPDATE** - 更新数据
- **DELETE** - 删除数据
- **DROP** - 删除对象

## 🔧 特性

- ✅ 支持所有常用 SQL 操作
- ✅ 智能连接池管理
- ✅ 智能连接管理（5分钟无活动自动断开，自动重连，心跳保活）
- ✅ 批量SQL执行（串行/并行模式）
- ✅ 参数化查询防止SQL注入
- ✅ 完善的错误处理和提示
- ✅ 实时连接状态监控
- ✅ 支持视图、存储过程、索引操作
- ✅ 通过 npx 快速部署
