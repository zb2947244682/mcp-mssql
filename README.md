# MCP MSSQL 工具

## 📖 项目介绍

这是一个功能强大的 MCP (Model Context Protocol) 工具，用于执行可定制参数的 MSSQL 数据库操作。它旨在提供一个灵活的方式来操作MSSQL数据库，包括连接管理、SQL执行、自动断开功能，以及丰富的数据库管理和开发助手功能。

**NPM 仓库地址:** [`@zb2947244682/mcp-mssql`](https://www.npmjs.com/package/@zb2947244682/mcp-mssql)

## 🚀 核心功能

此 MCP 服务提供了强大的 MSSQL 数据库操作工具和丰富的管理功能：

### 🔌 数据库连接工具

#### `connect_database` 工具

建立与MSSQL数据库的连接，支持完整的连接参数配置。

##### 参数说明

| 参数 | 类型 | 必填 | 默认值 | 描述 |
|------|------|------|--------|------|
| `server` | 字符串 | ✅ | - | 数据库服务器地址 (IP或域名) |
| `database` | 字符串 | ✅ | - | 要连接的数据库名称 |
| `user` | 字符串 | ✅ | - | 数据库用户名 |
| `password` | 字符串 | ✅ | - | 数据库密码 |
| `port` | 数字 | ❌ | 1433 | 数据库端口 |
| `encrypt` | 布尔值 | ❌ | true | 是否启用加密连接 |
| `trustServerCertificate` | 布尔值 | ❌ | false | 是否信任服务器证书 |
| `requestTimeout` | 数字 | ❌ | 30000 | 请求超时时间(毫秒) |
| `connectionTimeout` | 数字 | ❌ | 30000 | 连接超时时间(毫秒) |
| `maxPoolSize` | 数字 | ❌ | 10 | 连接池最大连接数 |
| `minPoolSize` | 数字 | ❌ | 1 | 连接池最小连接数 |
| `idleTimeout` | 数字 | ❌ | 600000 | 空闲连接超时时间(毫秒) |

##### 使用示例

```json
{
  "tool": "connect_database",
  "params": {
    "server": "localhost",
    "database": "testdb",
    "user": "sa",
    "password": "your_password",
    "port": 1433,
    "encrypt": true,
    "maxPoolSize": 15,
    "idleTimeout": 900000
  }
}
```

### 🗄️ SQL执行工具

#### `execute_sql` 工具

执行单个SQL查询，支持参数化查询防止SQL注入。

#### `batch_execute_sql` 工具

批量执行多个SQL语句，支持串行和并行执行模式。

### 📊 监控和管理工具

#### `get_connection_status` 工具

查看当前数据库连接状态和统计信息。

#### `disconnect_database` 工具

手动断开数据库连接。

## 🧠 智能提示词系统

### 📝 数据库管理助手

- **`database-backup-restore`** - 数据库备份恢复助手
  - 制定备份和恢复策略
  - 自动化方案设计
  - 监控和验证方法

- **`database-maintenance-plan`** - 数据库维护计划助手
  - 日常/每周/每月维护计划
  - 自动化脚本生成
  - 维护窗口安排

- **`database-capacity-planning`** - 数据库容量规划助手
  - 短期/中期/长期容量规划
  - 增长趋势分析
  - 资源需求预测

- **`database-disaster-recovery`** - 数据库灾难恢复助手
  - RTO/RPO目标制定
  - 恢复策略设计
  - 测试和验证方法

### ⚡ 性能优化助手

- **`index-optimization-assistant`** - 索引优化助手
  - 索引使用情况分析
  - 缺失索引建议
  - 性能测试方案

- **`database-performance-tuning`** - 数据库性能调优助手
  - 性能诊断方法
  - 瓶颈识别工具
  - 持续优化策略

- **`database-partitioning-strategy`** - 数据库分区策略助手
  - 分区键选择建议
  - 分区函数设计
  - 性能测试方法

### 🛡️ 安全和合规助手

- **`database-security-audit`** - 数据库安全审计助手
  - 权限审计
  - 访问控制审计
  - 合规性检查

- **`database-compliance-checker`** - 数据库合规性检查助手
  - GDPR、SOX、PCI-DSS等标准
  - 自动化检查脚本
  - 风险缓解措施

### 🏗️ 架构和迁移助手

- **`data-migration-assistant`** - 数据迁移助手
  - 结构/数据/完整/增量迁移
  - 迁移计划制定
  - 回滚策略设计

- **`database-cloud-migration`** - 数据库云迁移助手
  - 云平台评估
  - 迁移路线图
  - 成本效益分析

- **`database-microservices-architect`** - 数据库微服务架构助手
  - 架构模式选择
  - 数据一致性策略
  - 服务边界定义

### 📈 监控和运维助手

- **`database-monitoring-alert`** - 数据库监控告警助手
  - 关键性能指标定义
  - 告警阈值设置
  - 自动化响应建议

- **`database-devops-practices`** - 数据库DevOps实践助手
  - CI/CD流水线设计
  - 自动化脚本和工具
  - 环境管理策略

### 🚀 高级功能助手

- **`database-ml-integration`** - 数据库机器学习集成助手
  - 预测分析、异常检测
  - 技术架构设计
  - 性能优化建议

- **`database-api-designer`** - 数据库API设计助手
  - REST/GraphQL/gRPC API设计
  - 认证和授权
  - 性能优化和缓存策略

- **`database-cost-optimizer`** - 数据库成本优化助手
  - 许可优化建议
  - 资源利用率提升
  - ROI分析和实施路线图

## 📚 丰富资源库

### 🎯 配置信息资源

- **`config://mssql`** - MSSQL服务器配置信息
  - 支持的工具列表
  - 功能特性说明
  - 连接设置详情

### 🗂️ 数据库结构资源

- **`schema://{database}/{objectType}`** - 数据库结构信息
  - 支持的对象类型：tables, views, procedures, functions, triggers, indexes
  - 动态URI补全
  - 实时数据库结构查询

### 📊 查询历史资源

- **`history://{queryType}/{date}`** - SQL查询历史记录
  - 查询类型：select, insert, update, delete, all
  - 日期格式：YYYY-MM-DD
  - 统计信息和性能分析

### 📖 知识库资源

- **`knowledge://mssql-best-practices`** - MSSQL最佳实践知识库
  - 性能优化指南
  - 安全最佳实践
  - 高可用性配置
  - 维护和监控建议

### 🔧 故障排除资源

- **`troubleshooting://mssql-common-issues`** - 常见问题故障排除指南
  - 连接问题诊断
  - 性能问题解决
  - 空间问题处理
  - 备份问题修复

### 🎓 学习资源

- **`learning://mssql-tutorials`** - SQL Server学习资源
  - 初学者到高级用户的学习路径
  - 认证路径推荐
  - 实践项目建议
  - 社区资源链接

### ❓ 帮助资源

- **`help://mssql-resources`** - 资源使用帮助
  - 详细的资源使用说明
  - 参数说明和使用示例
  - 注意事项和最佳实践

## ⚙️ 配置说明

### 在 Cursor 中配置

将以下配置添加到您的 Cursor `mcp.json` 文件中：

```json
{
  "mcp-mssql": {
    "command": "npx",
    "args": [
      "-y",
      "@zb2947244682/mcp-mssql@latest"
    ]
  }
}
```

### 通过 npx 直接运行

您可以通过以下命令直接从命令行运行此 MCP 项目：

```bash
npx @zb2947244682/mcp-mssql@latest
```

## 🏠 本地开发配置

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

- **CREATE** - 创建表、视图、存储过程、函数、索引
- **INSERT** - 插入数据
- **SELECT** - 查询数据
- **UPDATE** - 更新数据
- **DELETE** - 删除数据
- **DROP** - 删除对象
- **ALTER** - 修改对象结构
- **EXEC** - 执行存储过程
- **BACKUP** - 数据库备份
- **RESTORE** - 数据库恢复

## 🔧 核心特性

- ✅ 支持所有常用 SQL 操作
- ✅ 智能连接池管理
- ✅ 智能连接管理（5分钟无活动自动断开，自动重连，心跳保活）
- ✅ 批量SQL执行（串行/并行模式）
- ✅ 参数化查询防止SQL注入
- ✅ 完善的错误处理和提示
- ✅ 实时连接状态监控
- ✅ 支持视图、存储过程、索引操作
- ✅ 通过 npx 快速部署
- ✅ 丰富的智能提示词系统
- ✅ 完整的资源库和知识库
- ✅ 专业级数据库管理功能
- ✅ 完全中文化的用户界面

## 🌟 高级功能

- **Resource Template支持** - 动态URI模板，支持参数补全
- **智能URI补全** - 提供数据库名和对象类型的自动补全建议
- **连接状态检查** - 数据库结构查询会检查连接状态
- **错误处理** - 完善的错误处理和用户友好的错误信息
- **JSON输出** - 所有资源都支持标准化的JSON格式输出
- **性能监控** - 完整的操作统计和性能指标
- **自动重连** - 连接断开时自动重连
- **心跳检测** - 定期检查连接健康状态

## 🎯 使用场景

- **数据库管理** - 日常数据库维护和监控
- **数据分析** - 执行复杂查询和报表生成
- **应用开发** - 数据库驱动的应用开发
- **数据迁移** - 数据库结构和数据迁移
- **性能调优** - 查询性能分析和优化
- **安全审计** - 数据库安全检查和合规性验证
- **高可用性配置** - Always On、镜像、复制等配置
- **云迁移** - 数据库云平台迁移规划
- **DevOps实践** - 数据库自动化运维
- **成本优化** - 数据库运营成本分析和优化

## 📖 快速开始

1. **安装配置** - 在Cursor中配置MCP服务器
2. **建立连接** - 使用`connect_database`工具连接数据库
3. **执行查询** - 使用`execute_sql`工具执行SQL语句
4. **批量操作** - 使用`batch_execute_sql`工具批量执行
5. **获取帮助** - 使用各种提示词获得专业建议
6. **查看资源** - 访问丰富的资源库和知识库

## 🤝 贡献和支持

欢迎提交Issue和Pull Request来改进这个项目！

---

**版本:** 1.0.0  
**许可证:** MIT  
**作者:** zb2947244682
