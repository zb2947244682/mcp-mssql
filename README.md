# MCP MSSQL 工具

一个基于 MCP (Model Context Protocol) 的 MSSQL 数据库操作工具，支持连接管理、SQL执行和自动断开功能。

## 🚀 功能特性

- **智能连接管理** - 自动管理数据库连接池
- **SQL执行** - 支持参数化查询和结果展示
- **自动断开** - 10秒无活动自动断开连接，节省资源
- **连接状态监控** - 实时查看连接状态和统计信息
- **错误处理** - 完善的错误提示和故障排除建议

## 🛠️ 可用工具

### 1. `connect_database` - 连接数据库
建立与MSSQL数据库的连接。

**参数：**
- `server` (必需) - 数据库服务器地址 (IP或域名)
- `database` (必需) - 要连接的数据库名称
- `user` (必需) - 数据库用户名
- `password` (必需) - 数据库密码
- `port` (可选) - 数据库端口，默认1433
- `encrypt` (可选) - 是否启用加密连接，默认true
- `trustServerCertificate` (可选) - 是否信任服务器证书，默认false
- `requestTimeout` (可选) - 请求超时时间(毫秒)，默认30000
- `connectionTimeout` (可选) - 连接超时时间(毫秒)，默认30000
- `maxPoolSize` (可选) - 连接池最大连接数，默认10
- `minPoolSize` (可选) - 连接池最小连接数，默认0
- `idleTimeout` (可选) - 空闲连接超时时间(毫秒)，默认30000

### 2. `execute_sql` - 执行SQL查询
在已连接的数据库中执行SQL查询。

**参数：**
- `sql` (必需) - 要执行的SQL语句
- `params` (可选) - SQL参数数组，每个参数包含name、type、value

**参数示例：**
```json
{
  "name": "userName",
  "type": "sql.VarChar",
  "value": "张三"
}
```

### 3. `disconnect_database` - 断开数据库连接
手动断开与MSSQL数据库的连接。

**参数：** 无

### 4. `get_connection_status` - 获取连接状态
查看当前数据库连接状态和统计信息。

**参数：** 无

## 📊 自动断开机制

- 连接建立后，如果10秒内没有任何活动（查询、连接等），系统会自动断开连接
- 每次执行SQL查询或建立连接都会重置活动计时器
- 可以通过 `get_connection_status` 工具查看自动断开倒计时

## 🔧 安装和配置

### 1. 安装依赖
```bash
npm install
```

### 2. 启动服务
```bash
node index.js
```

## 📝 使用示例

### 基本连接和查询流程

1. **连接数据库**
```json
{
  "tool": "connect_database",
  "params": {
    "server": "localhost",
    "database": "testdb",
    "user": "sa",
    "password": "your_password"
  }
}
```

2. **执行查询**
```json
{
  "tool": "execute_sql",
  "params": {
    "sql": "SELECT * FROM users WHERE name = @userName",
    "params": [
      {
        "name": "userName",
        "type": "sql.VarChar",
        "value": "张三"
      }
    ]
  }
}
```

3. **查看连接状态**
```json
{
  "tool": "get_connection_status",
  "params": {}
}
```

4. **断开连接**
```json
{
  "tool": "disconnect_database",
  "params": {}
}
```

## 🚨 注意事项

- 确保MSSQL服务器正在运行且可访问
- 检查防火墙设置，确保端口1433（或自定义端口）已开放
- 使用强密码和适当的用户权限
- 生产环境建议启用SSL加密连接

## 🔍 故障排除

### 常见连接问题

1. **连接超时**
   - 检查网络连接
   - 确认服务器地址和端口
   - 增加连接超时时间

2. **认证失败**
   - 验证用户名和密码
   - 检查用户权限
   - 确认SQL Server身份验证模式

3. **SSL/TLS错误**
   - 设置 `trustServerCertificate: true`（仅开发环境）
   - 配置有效的SSL证书
   - 检查加密设置

## 📈 性能优化

- 使用连接池管理连接
- 合理设置超时时间
- 使用参数化查询避免SQL注入
- 及时断开不需要的连接

## 🤝 贡献

欢迎提交Issue和Pull Request来改进这个工具！

## �� 许可证

ISC License
