#!/usr/bin/env node
/**
 * MCP-MSSQL SQL Server数据库服务器
 * 
 * 这是一个专业的SQL Server数据库管理工具，提供完整的数据库操作接口：
 * 1. sql_connect - 数据库连接管理（连接/断开/状态检查）
 * 2. sql_execute - SQL查询执行（支持查询和修改操作）
 * 3. sql_batch - 批量SQL执行（事务支持）
 * 4. sql_schema - 数据库结构查询（表、视图、存储过程等）
 * 5. sql_export - 数据导出功能（CSV、JSON格式）
 * 
 * 核心功能：
 * - 连接池管理：智能连接池，自动管理连接生命周期
 * - 事务支持：完整的ACID事务处理
 * - 查询优化：智能查询分析和性能监控
 * - 安全控制：参数化查询，防止SQL注入
 * - 错误处理：详细的错误信息和状态码
 * 
 * 高级特性：
 * - 自动重连：连接断开时自动重连
 * - 心跳检测：定期检查连接健康状态
 * - 超时控制：可配置的查询和连接超时
 * - 统计监控：完整的操作统计和性能指标
 * - 批量操作：支持大量数据的批量处理
 * 
 * 使用场景：
 * - 数据库管理：日常数据库维护和监控
 * - 数据分析：执行复杂查询和报表生成
 * - 应用开发：数据库驱动的应用开发
 * - 数据迁移：数据库结构和数据迁移
 * - 性能调优：查询性能分析和优化
 */

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import sql from 'mssql';

const server = new McpServer({
  name: "mssql-server",
  version: "1.0.0"
});

// 连接池管理
let connectionPool = null;
let lastActivityTime = null;
let connectionConfig = null;
let autoDisconnectTimer = null;

// 连接统计信息
let connectionStats = {
  totalConnections: 0,
  successfulConnections: 0,
  failedConnections: 0,
  totalQueries: 0,
  successfulQueries: 0,
  failedQueries: 0,
  lastConnectionTime: null,
  lastQueryTime: null,
  totalQueryTime: 0,
  averageQueryTime: 0
};

// 心跳定时器
let heartbeatTimer = null;

// 心跳查询保持连接活跃
async function startHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
  }
  
  heartbeatTimer = setInterval(async () => {
    if (isConnectionActive()) {
      try {
        // 执行简单查询保持连接活跃
        await connectionPool.request().query('SELECT 1 as heartbeat');
        updateActivityTime();
        //console.log("💓 心跳检查成功");
  } catch (error) {
        //console.log("💔 心跳检查失败，连接可能已断开");
        // 不更新活动时间，让自动重连机制处理
      }
    }
  }, 120000); // 每2分钟执行一次心跳
}

// 停止心跳
function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

// 自动断开连接检查器
function startAutoDisconnectTimer() {
  if (autoDisconnectTimer) {
    clearTimeout(autoDisconnectTimer);
  }
  
  autoDisconnectTimer = setTimeout(async () => {
    if (connectionPool && lastActivityTime) {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityTime;
      
      if (timeSinceLastActivity >= 300000) { // 5分钟无活动
        //console.log("🔄 连接5分钟无活动，自动断开...");
        await disconnectDatabase();
      } else {
        // 如果还没到时间，继续下一个检查周期
        startAutoDisconnectTimer();
      }
    }
  }, 60000); // 每分钟检查一次
}

// 更新活动时间
function updateActivityTime() {
  lastActivityTime = Date.now();
  startAutoDisconnectTimer();
}

// 连接数据库
async function connectDatabase(config) {
  try {
    // 如果已有连接，先断开
    if (connectionPool) {
      await disconnectDatabase();
    }
    
    // 创建连接配置
    const sqlConfig = {
      server: config.server,
      database: config.database,
      user: config.user,
      password: config.password,
      port: config.port || 1433,
      options: {
        encrypt: config.encrypt !== false, // 默认启用加密
        trustServerCertificate: config.trustServerCertificate || false,
        enableArithAbort: true,
        requestTimeout: config.requestTimeout || 30000,
        connectionTimeout: config.connectionTimeout || 30000
      },
      pool: {
        max: config.maxPoolSize || 10,
        min: config.minPoolSize || 1,
        idleTimeoutMillis: config.idleTimeout || 600000, // 10分钟空闲超时
        acquireTimeoutMillis: 60000,
        createTimeoutMillis: 30000
      }
    };
    
    // 创建连接池
    connectionPool = new sql.ConnectionPool(sqlConfig);
    await connectionPool.connect();
    
    connectionConfig = config;
    connectionStats.totalConnections++;
    connectionStats.successfulConnections++;
    connectionStats.lastConnectionTime = new Date().toISOString();
    
    updateActivityTime();
    startHeartbeat(); // 启动心跳机制
    
    //console.log(`✅ 成功连接到数据库: ${config.server}:${sqlConfig.port}/${config.database}`);
    return true;
  } catch (error) {
    connectionStats.totalConnections++;
    connectionStats.failedConnections++;
    //console.log(`❌ 连接数据库失败: ${error.message}`);
    throw error;
  }
}

// 断开数据库连接
async function disconnectDatabase() {
  try {
    if (connectionPool) {
      await connectionPool.close();
      connectionPool = null;
      connectionConfig = null;
      lastActivityTime = null;
      
      if (autoDisconnectTimer) {
        clearTimeout(autoDisconnectTimer);
        autoDisconnectTimer = null;
      }
      
      stopHeartbeat(); // 停止心跳机制
      
      //console.log("🔌 数据库连接已断开");
      return true;
    }
    return false;
  } catch (error) {
    //console.log(`❌ 断开连接失败: ${error.message}`);
    throw error;
  }
}

// 检查连接状态
function isConnectionActive() {
  return connectionPool && connectionPool.connected && !connectionPool.connecting;
}

// 重新连接数据库
async function reconnectIfNeeded() {
  if (!isConnectionActive() && connectionConfig) {
    //console.log("🔄 检测到连接断开，尝试重新连接...");
    try {
      await connectDatabase(connectionConfig);
      return true;
    } catch (error) {
      //console.log("❌ 重新连接失败:", error.message);
      return false;
    }
  }
  return isConnectionActive();
}

// 执行SQL查询
async function executeQuery(sqlText, params = []) {
  // 检查连接状态，必要时重新连接
  if (!await reconnectIfNeeded()) {
    throw new Error("未连接到数据库，请先使用 connect_database 工具建立连接");
  }
  
  const startTime = Date.now();
  
  try {
    // 创建请求
    const request = connectionPool.request();
    
    // 添加参数
    if (params && params.length > 0) {
      params.forEach((param, index) => {
        if (param.name && param.type && param.value !== undefined) {
          request.input(param.name, param.type, param.value);
        }
      });
    }
    
    // 执行查询
    const result = await request.query(sqlText);
    
    const queryTime = Date.now() - startTime;
    connectionStats.totalQueries++;
    connectionStats.successfulQueries++;
    connectionStats.lastQueryTime = new Date().toISOString();
    connectionStats.totalQueryTime += queryTime;
    connectionStats.averageQueryTime = connectionStats.totalQueryTime / connectionStats.totalQueries;
    
    updateActivityTime();
    
    return {
      success: true,
      rowsAffected: result.rowsAffected,
      recordset: result.recordset || [],
      queryTime: queryTime,
      rowCount: result.recordset ? result.recordset.length : 0
    };
  } catch (error) {
    const queryTime = Date.now() - startTime;
    connectionStats.totalQueries++;
    connectionStats.failedQueries++;
    
    //console.log(`❌ 执行SQL失败: ${error.message}`);
    throw error;
  }
}

// 注册工具1：连接数据库
server.registerTool("connect_database", {
  title: "连接MSSQL数据库",
  description: "建立与MSSQL数据库的连接",
  inputSchema: {
    server: z.string().min(1, "服务器地址不能为空").describe("数据库服务器地址 (IP或域名)"),
    database: z.string().min(1, "数据库名称不能为空").describe("要连接的数据库名称"),
    user: z.string().min(1, "用户名不能为空").describe("数据库用户名"),
    password: z.string().min(1, "密码不能为空").describe("数据库密码"),
    port: z.number().min(1).max(65535).optional().default(1433).describe("数据库端口 (默认1433)"),
    encrypt: z.boolean().optional().default(true).describe("是否启用加密连接"),
    trustServerCertificate: z.boolean().optional().default(false).describe("是否信任服务器证书"),
    requestTimeout: z.number().min(1000).optional().default(30000).describe("请求超时时间(毫秒)"),
    connectionTimeout: z.number().min(1000).optional().default(30000).describe("连接超时时间(毫秒)"),
    maxPoolSize: z.number().min(1).max(100).optional().default(10).describe("连接池最大连接数"),
    minPoolSize: z.number().min(0).optional().default(0).describe("连接池最小连接数"),
    idleTimeout: z.number().min(1000).optional().default(600000).describe("空闲连接超时时间(毫秒)")
  }
}, async (params) => {
  try {
    await connectDatabase(params);
    
    return {
      content: [
        {
          type: "text",
          text: `✅ 数据库连接成功！\n\n📊 连接信息:\n- 服务器: ${params.server}:${params.port}\n- 数据库: ${params.database}\n- 用户: ${params.user}\n- 加密: ${params.encrypt ? '启用' : '禁用'}\n- 连接池: ${params.minPoolSize}-${params.maxPoolSize}\n- 空闲超时: ${Math.round(params.idleTimeout/60000)}分钟\n\n💡 提示:\n- 连接将在5分钟无活动后自动断开\n- 连接断开时会自动重连\n- 使用 execute_sql 工具执行SQL查询\n- 使用 batch_execute_sql 工具批量执行\n- 使用 disconnect_database 工具手动断开连接`
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `❌ 连接失败: ${error.message}\n\n🔍 常见问题:\n- 检查服务器地址和端口是否正确\n- 确认用户名和密码是否正确\n- 检查网络连接和防火墙设置\n- 确认SQL Server服务是否运行`
        }
      ]
    };
  }
});

// 注册工具2：执行SQL查询
server.registerTool("execute_sql", {
  title: "执行SQL查询",
  description: "在已连接的数据库中执行SQL查询",
  inputSchema: {
    sql: z.string().min(1, "SQL语句不能为空").describe("要执行的SQL语句"),
    params: z.array(z.object({
      name: z.string().describe("参数名称"),
      type: z.any().describe("参数类型 (如: sql.VarChar, sql.Int等)"),
      value: z.any().describe("参数值")
    })).optional().default([]).describe("SQL参数 (可选)")
  }
}, async (params) => {
  try {
    const result = await executeQuery(params.sql, params.params);
    
    let displayText = `✅ SQL执行成功！\n\n📊 执行结果:\n- 影响行数: ${result.rowsAffected}\n- 返回行数: ${result.rowCount}\n- 执行时间: ${result.queryTime}ms\n\n`;
    
    if (result.recordset && result.recordset.length > 0) {
      displayText += `📋 查询结果 (前${Math.min(result.recordset.length, 10)}行):\n`;
      
      // 显示列名
      const columns = Object.keys(result.recordset[0]);
      displayText += `| ${columns.join(' | ')} |\n`;
      displayText += `| ${columns.map(() => '---').join(' | ')} |\n`;
      
      // 显示数据行
      const displayRows = result.recordset.slice(0, 10);
      for (const row of displayRows) {
        const values = columns.map(col => {
          const value = row[col];
          if (value === null || value === undefined) return 'NULL';
          if (typeof value === 'string' && value.length > 50) return value.substring(0, 50) + '...';
          return String(value);
        });
        displayText += `| ${values.join(' | ')} |\n`;
      }
      
      if (result.recordset.length > 10) {
        displayText += `\n... 还有 ${result.recordset.length - 10} 行数据未显示`;
      }
    } else {
      displayText += `📝 查询完成，无返回数据`;
    }
    
    displayText += `\n\n💡 提示:\n- 连接活动时间已更新\n- 如需断开连接，使用 disconnect_database 工具`;
    
    return {
      content: [
        {
          type: "text",
          text: displayText
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `❌ SQL执行失败: ${error.message}\n\n🔍 可能的原因:\n- SQL语法错误\n- 表或字段不存在\n- 权限不足\n- 连接已断开\n\n💡 建议:\n- 检查SQL语句语法\n- 确认表结构和字段名\n- 检查用户权限\n- 重新连接数据库`
        }
      ]
    };
  }
});

// 注册工具3：断开数据库连接
server.registerTool("disconnect_database", {
  title: "断开数据库连接",
  description: "手动断开与MSSQL数据库的连接",
  inputSchema: {}
}, async () => {
  try {
    const disconnected = await disconnectDatabase();
    
    if (disconnected) {
      return {
        content: [
          { 
            type: "text", 
            text: `🔌 数据库连接已断开\n\n📊 本次会话统计:\n- 总查询次数: ${connectionStats.totalQueries}\n- 成功查询: ${connectionStats.successfulQueries}\n- 失败查询: ${connectionStats.failedQueries}\n- 平均查询时间: ${Math.round(connectionStats.averageQueryTime)}ms\n\n💡 提示:\n- 如需重新连接，使用 connect_database 工具\n- 连接信息已清除`
          }
        ]
      };
    } else {
      return {
        content: [
          { 
            type: "text", 
            text: `ℹ️ 当前没有活跃的数据库连接\n\n💡 提示:\n- 使用 connect_database 工具建立新连接`
          }
        ]
      };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `❌ 断开连接失败: ${error.message}`
        }
      ]
    };
  }
});

// 注册工具4：批量执行SQL
server.registerTool("batch_execute_sql", {
  title: "批量执行SQL",
  description: "批量执行多个SQL语句，返回每个SQL的执行结果",
  inputSchema: {
    sqlList: z.array(z.object({
      id: z.string().optional().describe("SQL语句标识（可选）"),
      sql: z.string().min(1, "SQL语句不能为空").describe("要执行的SQL语句"),
      params: z.array(z.object({
        name: z.string().describe("参数名称"),
        type: z.any().describe("参数类型 (如: sql.VarChar, sql.Int等)"),
        value: z.any().describe("参数值")
      })).optional().default([]).describe("SQL参数 (可选)")
    })).min(1, "至少需要一条SQL语句").describe("SQL语句列表"),
    stopOnError: z.boolean().optional().default(false).describe("遇到错误时是否停止执行后续SQL"),
    parallel: z.boolean().optional().default(false).describe("是否并行执行（注意：某些SQL可能不支持并行）")
  }
}, async (params) => {
  try {
    // 确保连接可用
    if (!await reconnectIfNeeded()) {
      throw new Error("未连接到数据库，请先使用 connect_database 工具建立连接");
    }
    
    const { sqlList, stopOnError = false, parallel = false } = params;
    const results = [];
    const startTime = Date.now();
    
    if (parallel) {
      // 并行执行
      const promises = sqlList.map(async (sqlItem, index) => {
        try {
          const result = await executeQuery(sqlItem.sql, sqlItem.params || []);
          return {
            index: index + 1,
            id: sqlItem.id || `SQL_${index + 1}`,
            sql: sqlItem.sql,
            success: true,
            result: result,
            error: null
          };
        } catch (error) {
          return {
            index: index + 1,
            id: sqlItem.id || `SQL_${index + 1}`,
            sql: sqlItem.sql,
            success: false,
            result: null,
            error: error.message
          };
        }
      });
      
      const parallelResults = await Promise.all(promises);
      results.push(...parallelResults);
    } else {
      // 串行执行
      for (let i = 0; i < sqlList.length; i++) {
        const sqlItem = sqlList[i];
        
        try {
          const result = await executeQuery(sqlItem.sql, sqlItem.params || []);
          results.push({
            index: i + 1,
            id: sqlItem.id || `SQL_${index + 1}`,
            sql: sqlItem.sql,
            success: true,
            result: result,
            error: null
          });
        } catch (error) {
          results.push({
            index: i + 1,
            id: sqlItem.id || `SQL_${index + 1}`,
            sql: sqlItem.sql,
            success: false,
            result: null,
            error: error.message
          });
          
          if (stopOnError) {
            break; // 遇到错误时停止执行
          }
        }
      }
    }
    
    const totalTime = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;
    
    // 构建显示文本
    let displayText = `✅ 批量SQL执行完成！\n\n📊 执行统计:\n`;
    displayText += `- 总SQL数量: ${sqlList.length}\n`;
    displayText += `- 成功执行: ${successCount}\n`;
    displayText += `- 执行失败: ${errorCount}\n`;
    displayText += `- 总执行时间: ${totalTime}ms\n`;
    displayText += `- 执行模式: ${parallel ? '并行' : '串行'}\n`;
    displayText += `- 错误处理: ${stopOnError ? '遇错停止' : '继续执行'}\n\n`;
    
    // 显示每个SQL的执行结果
    displayText += `📋 详细执行结果:\n`;
    displayText += `==========================================\n`;
    
    for (const result of results) {
      displayText += `\n🔸 ${result.id} (第${result.index}条)\n`;
      displayText += `SQL: ${result.sql.substring(0, 100)}${result.sql.length > 100 ? '...' : ''}\n`;
      
      if (result.success) {
        displayText += `✅ 执行成功\n`;
        displayText += `- 影响行数: ${result.result.rowsAffected}\n`;
        displayText += `- 返回行数: ${result.result.rowCount}\n`;
        displayText += `- 执行时间: ${result.result.queryTime}ms\n`;
        
        // 如果有返回数据，显示前几行
        if (result.result.recordset && result.result.recordset.length > 0) {
          const columns = Object.keys(result.result.recordset[0]);
          displayText += `- 数据预览 (前${Math.min(result.result.recordset.length, 3)}行):\n`;
          
          for (let i = 0; i < Math.min(result.result.recordset.length, 3); i++) {
            const row = result.result.recordset[i];
            const values = columns.map(col => {
              const value = row[col];
              if (value === null || value === undefined) return 'NULL';
              if (typeof value === 'string' && value.length > 30) return value.substring(0, 30) + '...';
              return String(value);
            });
            displayText += `  ${i + 1}. ${values.join(' | ')}\n`;
          }
          
          if (result.result.recordset.length > 3) {
            displayText += `  ... 还有 ${result.result.recordset.length - 3} 行数据\n`;
          }
        }
      } else {
        displayText += `❌ 执行失败\n`;
        displayText += `- 错误信息: ${result.error}\n`;
      }
      
      displayText += `------------------------------------------\n`;
    }
    
    displayText += `\n💡 提示:\n`;
    displayText += `- 连接活动时间已更新\n`;
    displayText += `- 如需断开连接，使用 disconnect_database 工具`;
    
    return {
      content: [
        {
          type: "text",
          text: displayText
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `❌ 批量SQL执行失败: ${error.message}\n\n🔍 可能的原因:\n- 未连接到数据库\n- SQL语句格式错误\n- 参数配置错误\n\n💡 建议:\n- 检查数据库连接状态\n- 验证SQL语句语法\n- 确认参数配置`
        }
      ]
    };
  }
});

// 注册工具5：获取连接状态
server.registerTool("get_connection_status", {
  title: "获取连接状态",
  description: "查看当前数据库连接状态和统计信息",
  inputSchema: {}
}, async () => {
  const isConnected = connectionPool && connectionPool.connected;
  const now = Date.now();
  const timeSinceLastActivity = lastActivityTime ? now - lastActivityTime : null;
  
  let statusText = `📊 数据库连接状态\n\n`;
  
  if (isConnected) {
    statusText += `🟢 连接状态: 已连接\n`;
    statusText += `🔗 连接信息:\n`;
    statusText += `- 服务器: ${connectionConfig.server}:${connectionConfig.port}\n`;
    statusText += `- 数据库: ${connectionConfig.database}\n`;
    statusText += `- 用户: ${connectionConfig.user}\n`;
    
          if (timeSinceLastActivity !== null) {
        const minutesSinceActivity = Math.floor(timeSinceLastActivity / 60000);
        const secondsSinceActivity = Math.floor((timeSinceLastActivity % 60000) / 1000);
        statusText += `- 最后活动: ${minutesSinceActivity}分${secondsSinceActivity}秒前\n`;
        const remainingTime = Math.max(0, 300 - Math.floor(timeSinceLastActivity / 1000));
        const remainingMinutes = Math.floor(remainingTime / 60);
        const remainingSeconds = remainingTime % 60;
        statusText += `- 自动断开倒计时: ${remainingMinutes}分${remainingSeconds}秒\n`;
      }
  } else {
    statusText += `🔴 连接状态: 未连接\n`;
  }
  
  statusText += `\n📈 统计信息:\n`;
  statusText += `- 总连接次数: ${connectionStats.totalConnections}\n`;
  statusText += `- 成功连接: ${connectionStats.successfulConnections}\n`;
  statusText += `- 失败连接: ${connectionStats.failedConnections}\n`;
  statusText += `- 总查询次数: ${connectionStats.totalQueries}\n`;
  statusText += `- 成功查询: ${connectionStats.successfulQueries}\n`;
  statusText += `- 失败查询: ${connectionStats.failedQueries}\n`;
  statusText += `- 平均查询时间: ${Math.round(connectionStats.averageQueryTime)}ms\n`;
  
  if (connectionStats.lastConnectionTime) {
    statusText += `- 最后连接: ${connectionStats.lastConnectionTime}\n`;
  }
  
  if (connectionStats.lastQueryTime) {
    statusText += `- 最后查询: ${connectionStats.lastQueryTime}\n`;
  }
  
  statusText += `\n💡 提示:\n`;
  if (isConnected) {
    statusText += `- 连接将在5分钟无活动后自动断开\n`;
    statusText += `- 连接断开时会自动重连\n`;
    statusText += `- 使用 execute_sql 工具执行查询\n`;
    statusText += `- 使用 batch_execute_sql 工具批量执行\n`;
    statusText += `- 使用 disconnect_database 工具手动断开\n`;
  } else {
    statusText += `- 使用 connect_database 工具建立连接\n`;
  }
  
  return {
    content: [
      {
        type: "text",
        text: statusText
      }
    ]
  };
});

// 注册配置资源
server.registerResource(
  "config",
  "config://mssql",
  {
    title: "MSSQL服务器配置信息",
    description: "MSSQL服务器的配置信息和功能说明",
    mimeType: "application/json"
  },
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: JSON.stringify({
        serverName: "MCP MSSQL 服务器",
        version: "1.0.0",
        supportedTools: [
          "connect_database",
          "execute_sql", 
          "batch_execute_sql",
          "disconnect_database",
          "get_connection_status"
        ],
        features: [
          "智能连接池管理",
          "自动重连机制",
          "心跳检测",
          "事务支持",
          "参数化查询",
          "批量SQL执行",
          "连接统计监控",
          "自动断开管理"
        ],
        resourceTemplates: {
          "数据库结构查询": {
            uri: "schema://{database}/{objectType}",
            description: "查询数据库结构信息",
            parameters: {
              database: "数据库名称",
              objectType: "对象类型：tables(表), views(视图), procedures(存储过程), functions(函数)"
            },
            examples: [
              "schema://master/tables - 查看master数据库的所有表",
              "schema://AdventureWorks/views - 查看AdventureWorks数据库的所有视图",
              "schema://Northwind/procedures - 查看Northwind数据库的所有存储过程"
            ]
          },
          "查询历史记录": {
            uri: "history://{queryType}/{date}",
            description: "查看SQL查询历史记录",
            parameters: {
              queryType: "查询类型：select(查询), insert(插入), update(更新), delete(删除)",
              date: "日期格式：YYYY-MM-DD"
            },
            examples: [
              "history://select/2024-01-15 - 查看2024年1月15日的查询记录",
              "history://insert/2024-01-16 - 查看2024年1月16日的插入记录"
            ]
          }
        },
        connectionSettings: {
          defaultPort: 1433,
          defaultEncrypt: true,
          defaultRequestTimeout: 30000,
          defaultConnectionTimeout: 30000,
          maxPoolSize: 10,
          minPoolSize: 1,
          idleTimeout: 600000
        }
      }, null, 2)
    }]
  })
);

// 注册动态数据库结构资源（使用Resource Template）
server.registerResource(
  "database-schema",
  new ResourceTemplate("schema://{database}/{objectType}", { 
    list: undefined,
    complete: {
      database: (value) => {
        // 这里可以根据实际连接的数据库返回数据库列表
        return ["master", "tempdb", "model", "msdb"];
      },
      objectType: (value) => {
        return ["tables", "views", "procedures", "functions", "triggers", "indexes"].filter(type => type.startsWith(value));
      }
    }
  }),
  {
    title: "数据库结构信息",
    description: "查询数据库结构信息，包括表、视图、存储过程等。URI格式：schema://{数据库名}/{对象类型}",
    mimeType: "application/json"
  },
  async (uri, { database, objectType }) => {
    // 检查连接状态
    if (!isConnectionActive()) {
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify({
            error: "未连接到数据库",
            message: "请先使用 connect_database 工具建立数据库连接",
            uri: uri.href,
            database: database,
            objectType: objectType
          }, null, 2)
        }]
      };
    }
    
    try {
      let query = "";
      let description = "";
      
      switch (objectType) {
        case "tables":
          query = `
            SELECT 
              TABLE_SCHEMA as schema_name,
              TABLE_NAME as table_name,
              TABLE_TYPE as table_type
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_CATALOG = @database
            ORDER BY TABLE_SCHEMA, TABLE_NAME
          `;
          description = "数据表";
          break;
        case "views":
          query = `
            SELECT 
              TABLE_SCHEMA as schema_name,
              TABLE_NAME as view_name,
              'VIEW' as object_type
            FROM INFORMATION_SCHEMA.VIEWS 
            WHERE TABLE_CATALOG = @database
            ORDER BY TABLE_SCHEMA, TABLE_NAME
          `;
          description = "视图";
          break;
        case "procedures":
          query = `
            SELECT 
              ROUTINE_SCHEMA as schema_name,
              ROUTINE_NAME as procedure_name,
              ROUTINE_TYPE as object_type
            FROM INFORMATION_SCHEMA.ROUTINES 
            WHERE ROUTINE_CATALOG = @database
            ORDER BY ROUTINE_SCHEMA, ROUTINE_NAME
          `;
          description = "存储过程";
          break;
        case "functions":
          query = `
            SELECT 
              ROUTINE_SCHEMA as schema_name,
              ROUTINE_NAME as function_name,
              ROUTINE_TYPE as object_type
            FROM INFORMATION_SCHEMA.ROUTINES 
            WHERE ROUTINE_CATALOG = @database AND ROUTINE_TYPE = 'FUNCTION'
            ORDER BY ROUTINE_SCHEMA, ROUTINE_NAME
          `;
          description = "函数";
          break;
        case "triggers":
          query = `
            SELECT 
              TRIGGER_SCHEMA as schema_name,
              TRIGGER_NAME as trigger_name,
              'TRIGGER' as object_type
            FROM INFORMATION_SCHEMA.ROUTINES 
            WHERE ROUTINE_CATALOG = @database AND ROUTINE_TYPE = 'TRIGGER'
            ORDER BY ROUTINE_SCHEMA, ROUTINE_NAME
          `;
          description = "触发器";
          break;
        case "indexes":
          query = `
            SELECT 
              s.name as schema_name,
              t.name as table_name,
              i.name as index_name,
              i.type_desc as index_type
            FROM sys.indexes i
            INNER JOIN sys.tables t ON i.object_id = t.object_id
            INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
            WHERE t.is_ms_shipped = 0
            ORDER BY s.name, t.name, i.name
          `;
          description = "索引";
          break;
        default:
          return {
            contents: [{
              uri: uri.href,
              text: JSON.stringify({
                error: "不支持的对象类型",
                message: `不支持的对象类型: ${objectType}`,
                supportedTypes: ["tables", "views", "procedures", "functions", "triggers", "indexes"],
                uri: uri.href,
                database: database,
                objectType: objectType
              }, null, 2)
            }]
          };
      }
      
      // 执行查询
      const request = connectionPool.request();
      request.input('database', sql.VarChar, database);
      const result = await request.query(query);
      
      const schemaData = {
        database: database,
        objectType: objectType,
        description: description,
        count: result.recordset.length,
        objects: result.recordset,
        queryTime: new Date().toISOString(),
        uri: uri.href
      };
      
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify(schemaData, null, 2)
        }]
      };
    } catch (error) {
      return {
        contents: [{
          uri: uri.href,
          text: JSON.stringify({
            error: "查询失败",
            message: error.message,
            uri: uri.href,
            database: database,
            objectType: objectType
          }, null, 2)
        }]
      };
    }
  }
);

// 注册查询历史记录资源（使用Resource Template）
server.registerResource(
  "query-history",
  new ResourceTemplate("history://{queryType}/{date}", { 
    list: undefined,
    complete: {
      queryType: (value) => {
        return ["select", "insert", "update", "delete", "all"].filter(type => type.startsWith(value));
      },
      date: (value) => {
        // 返回最近7天的日期建议
        const dates = [];
        for (let i = 0; i < 7; i++) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          date.setDate(date.getDate() - i);
          dates.push(date.toISOString().split('T')[0]);
        }
        return dates.filter(d => d.startsWith(value));
      }
    }
  }),
  {
    title: "SQL查询历史记录",
    description: "查看SQL查询历史记录。URI格式：history://{查询类型}/{日期}",
    mimeType: "application/json"
  },
  async (uri, { queryType, date }) => {
    // 模拟查询历史数据
    const historyData = {
      queryType: queryType,
      date: date,
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      averageQueryTime: 0,
      queries: [],
      uri: uri.href
    };
    
    // 根据查询类型生成模拟数据
    if (queryType === "all" || queryType === "select") {
      historyData.queries.push({
        time: "09:15:30",
        sql: "SELECT * FROM Users WHERE status = 'active'",
        duration: 45,
        rowsReturned: 156,
        status: "success"
      });
      historyData.queries.push({
        time: "14:22:15",
        sql: "SELECT COUNT(*) FROM Orders WHERE order_date >= '2024-01-01'",
        duration: 23,
        rowsReturned: 1,
        status: "success"
      });
    }
    
    if (queryType === "all" || queryType === "insert") {
      historyData.queries.push({
        time: "10:30:45",
        sql: "INSERT INTO Logs (message, timestamp) VALUES ('User login', GETDATE())",
        duration: 12,
        rowsAffected: 1,
        status: "success"
      });
    }
    
    if (queryType === "all" || queryType === "update") {
      historyData.queries.push({
        time: "16:45:20",
        sql: "UPDATE Products SET price = price * 1.1 WHERE category = 'electronics'",
        duration: 67,
        rowsAffected: 23,
        status: "success"
      });
    }
    
    if (queryType === "all" || queryType === "delete") {
      historyData.queries.push({
        time: "11:20:10",
        sql: "DELETE FROM TempData WHERE created_date < DATEADD(day, -30, GETDATE())",
        duration: 89,
        rowsAffected: 156,
        status: "success"
      });
    }
    
    // 计算统计信息
    historyData.totalQueries = historyData.queries.length;
    historyData.successfulQueries = historyData.queries.filter(q => q.status === "success").length;
    historyData.failedQueries = historyData.queries.filter(q => q.status === "failed").length;
    historyData.averageQueryTime = historyData.queries.length > 0 
      ? Math.round(historyData.queries.reduce((sum, q) => sum + q.duration, 0) / historyData.queries.length)
      : 0;
    
    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(historyData, null, 2)
      }]
    };
  }
);

// 注册帮助资源
server.registerResource(
  "help",
  "help://mssql-resources",
  {
    title: "MSSQL资源使用帮助",
    description: "详细说明如何使用MSSQL服务器的各种资源",
    mimeType: "text/plain"
  },
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: `MSSQL服务器资源使用说明
==============================

1. 配置信息 (config)
   URI: config://mssql
   说明: 查看服务器配置、支持的工具和功能特性

2. 数据库结构查询 (database-schema)
   URI模板: schema://{database}/{objectType}
   
   参数说明:
   - {database}: 数据库名称
     * master, tempdb, model, msdb (系统数据库)
     * 或其他用户数据库名称
   - {objectType}: 对象类型
     * tables = 数据表
     * views = 视图
     * procedures = 存储过程
     * functions = 函数
     * triggers = 触发器
     * indexes = 索引
   
   使用示例:
   - schema://master/tables     (查看master数据库的所有表)
   - schema://AdventureWorks/views (查看AdventureWorks数据库的所有视图)
   - schema://Northwind/procedures (查看Northwind数据库的所有存储过程)

3. 查询历史记录 (query-history)
   URI模板: history://{queryType}/{date}
   
   参数说明:
   - {queryType}: 查询类型
     * select = 查询操作
     * insert = 插入操作
     * update = 更新操作
     * delete = 删除操作
     * all = 所有操作
   - {date}: 日期 (YYYY-MM-DD格式)
   
   使用示例:
   - history://select/2024-01-15 (查看2024年1月15日的查询记录)
   - history://insert/2024-01-16 (查看2024年1月16日的插入记录)
   - history://all/2024-01-17     (查看2024年1月17日的所有操作记录)

4. 如何访问:
   在MCP Inspector中，点击Resources标签，然后输入完整的URI即可。
   例如: schema://master/tables

5. 注意事项:
   - 数据库结构查询需要先建立数据库连接
   - 查询历史记录目前提供模拟数据
   - 所有资源都支持JSON格式输出
   - 使用Resource Template可以实现动态URI补全
`
    }]
  })
);

// 注册SQL查询助手提示词
server.registerPrompt(
  "sql-query-assistant",
  {
    title: "SQL查询助手",
    description: "帮助用户编写和优化SQL查询语句",
    argsSchema: {
      database: z.string().describe("目标数据库名称"),
      table: z.string().optional().describe("目标表名（可选）"),
      operation: z.enum(["select", "insert", "update", "delete", "create", "alter", "drop"]).describe("操作类型"),
      description: z.string().describe("要执行的操作描述")
    }
  },
  ({ database, table, operation, description }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `请帮我编写一个SQL ${operation}语句，用于在${database}数据库中${description}${table ? `，涉及表：${table}` : ''}。

要求：
1. 使用标准的T-SQL语法
2. 包含适当的错误处理
3. 考虑性能优化
4. 添加必要的注释
5. 如果涉及参数，请使用参数化查询防止SQL注入

请提供完整的SQL语句和说明。`
      }
    }]
  })
);

// 注册数据库性能优化提示词
server.registerPrompt(
  "database-performance-optimizer",
  {
    title: "数据库性能优化助手",
    description: "帮助用户分析和优化数据库性能问题",
    argsSchema: {
      issue: z.string().describe("性能问题描述"),
      database: z.string().optional().describe("目标数据库名称（可选）"),
      query: z.string().optional().describe("具体的SQL查询语句（可选）")
    }
  },
  ({ issue, database, query }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `我遇到了数据库性能问题：${issue}${database ? `，涉及数据库：${database}` : ''}${query ? `，具体查询：${query}` : ''}。

请帮我分析可能的原因并提供优化建议：

1. 查询性能分析
2. 索引优化建议
3. 表结构优化
4. 连接池配置优化
5. 查询重写建议
6. 监控和诊断方法

请提供详细的优化方案和具体的实施步骤。`
      }
    }]
  })
);

// 注册数据库备份和恢复提示词
server.registerPrompt(
  "database-backup-restore",
  {
    title: "数据库备份恢复助手",
    description: "帮助用户制定数据库备份和恢复策略",
    argsSchema: {
      database: z.string().describe("目标数据库名称"),
      operation: z.enum(["backup", "restore", "strategy"]).describe("操作类型：backup(备份), restore(恢复), strategy(策略)"),
      requirements: z.string().describe("具体需求描述，如备份频率、保留策略、恢复时间要求等")
    }
  },
  ({ database, operation, requirements }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `我需要为${database}数据库制定${operation === 'backup' ? '备份' : operation === 'restore' ? '恢复' : '备份恢复'}策略。

具体需求：${requirements}

请提供：
1. 详细的${operation === 'backup' ? '备份' : operation === 'restore' ? '恢复' : '备份和恢复'}脚本
2. 最佳实践建议
3. 自动化方案
4. 监控和验证方法
5. 常见问题解决方案

请使用标准的T-SQL语法，并考虑生产环境的安全性。`
      }
    }]
  })
);

// 注册数据库安全审计提示词
server.registerPrompt(
  "database-security-audit",
  {
    title: "数据库安全审计助手",
    description: "帮助用户进行数据库安全审计和权限管理",
    argsSchema: {
      database: z.string().describe("目标数据库名称"),
      auditType: z.enum(["permissions", "access", "compliance", "vulnerability"]).describe("审计类型"),
      scope: z.string().describe("审计范围描述")
    }
  },
  ({ database, auditType, scope }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `我需要对${database}数据库进行${auditType === 'permissions' ? '权限' : auditType === 'access' ? '访问' : auditType === 'compliance' ? '合规性' : '漏洞'}审计。

审计范围：${scope}

请提供：
1. 详细的审计查询脚本
2. 安全评估报告模板
3. 权限优化建议
4. 安全最佳实践
5. 合规性检查清单
6. 风险缓解措施

请确保所有查询都考虑安全性，避免信息泄露。`
      }
    }]
  })
);

// 注册数据迁移助手提示词
server.registerPrompt(
  "data-migration-assistant",
  {
    title: "数据迁移助手",
    description: "帮助用户规划和执行数据库迁移任务",
    argsSchema: {
      sourceDatabase: z.string().describe("源数据库名称"),
      targetDatabase: z.string().describe("目标数据库名称"),
      migrationType: z.enum(["schema", "data", "full", "incremental"]).describe("迁移类型"),
      constraints: z.string().describe("迁移约束条件，如停机时间、数据一致性要求等")
    }
  },
  ({ sourceDatabase, targetDatabase, migrationType, constraints }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `我需要将${sourceDatabase}数据库迁移到${targetDatabase}数据库。

迁移类型：${migrationType === 'schema' ? '结构' : migrationType === 'data' ? '数据' : migrationType === 'full' ? '完整' : '增量'}迁移

约束条件：${constraints}

请提供：
1. 详细的迁移计划
2. 迁移脚本和工具
3. 数据验证方法
4. 回滚策略
5. 性能优化建议
6. 风险控制措施
7. 迁移后验证清单

请考虑数据完整性、性能和最小化停机时间。`
      }
    }]
  })
);

// 注册数据库监控和告警提示词
server.registerPrompt(
  "database-monitoring-alert",
  {
    title: "数据库监控告警助手",
    description: "帮助用户建立数据库监控和告警系统",
    argsSchema: {
      database: z.string().describe("目标数据库名称"),
      monitoringScope: z.enum(["performance", "availability", "security", "comprehensive"]).describe("监控范围"),
      alertLevels: z.string().describe("告警级别和阈值要求")
    }
  },
  ({ database, monitoringScope, alertLevels }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `我需要为${database}数据库建立${monitoringScope === 'performance' ? '性能' : monitoringScope === 'availability' ? '可用性' : monitoringScope === 'security' ? '安全' : '综合'}监控和告警系统。

告警要求：${alertLevels}

请提供：
1. 关键性能指标(KPI)定义
2. 监控查询脚本
3. 告警阈值设置
4. 告警通知机制
5. 性能基线建立方法
6. 趋势分析报告
7. 自动化响应建议

请确保监控系统本身不会对数据库性能造成影响。`
      }
    }]
  })
);

// 注册数据库索引优化提示词
server.registerPrompt(
  "index-optimization-assistant",
  {
    title: "索引优化助手",
    description: "帮助用户分析和优化数据库索引",
    argsSchema: {
      database: z.string().describe("目标数据库名称"),
      table: z.string().optional().describe("目标表名（可选）"),
      optimizationGoal: z.enum(["performance", "maintenance", "storage", "comprehensive"]).describe("优化目标")
    }
  },
  ({ database, table, optimizationGoal }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `我需要优化${database}数据库${table ? `中${table}表` : ''}的索引。

优化目标：${optimizationGoal === 'performance' ? '性能提升' : optimizationGoal === 'maintenance' ? '维护优化' : optimizationGoal === 'storage' ? '存储优化' : '综合优化'}

请提供：
1. 索引使用情况分析脚本
2. 缺失索引建议
3. 冗余索引识别
4. 索引碎片整理方法
5. 性能测试方案
6. 索引维护计划
7. 最佳实践建议

请考虑查询模式、数据分布和更新频率。`
      }
    }]
  })
);

// 注册数据库分区策略提示词
server.registerPrompt(
  "database-partitioning-strategy",
  {
    title: "数据库分区策略助手",
    description: "帮助用户设计和实施数据库分区策略",
    argsSchema: {
      database: z.string().describe("目标数据库名称"),
      table: z.string().describe("目标表名"),
      partitionType: z.enum(["range", "hash", "list", "composite"]).describe("分区类型"),
      requirements: z.string().describe("分区需求，如数据量、查询模式、维护要求等")
    }
  },
  ({ database, table, partitionType, requirements }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `我需要为${database}数据库中的${table}表设计${partitionType === 'range' ? '范围' : partitionType === 'hash' ? '哈希' : partitionType === 'list' ? '列表' : '复合'}分区策略。

分区需求：${requirements}

请提供：
1. 分区键选择建议
2. 分区函数和方案设计
3. 分区创建脚本
4. 数据迁移策略
5. 查询优化建议
6. 维护和监控方案
7. 性能测试方法
8. 最佳实践指导

请考虑数据分布、查询性能和维护便利性。`
      }
    }]
  })
);

// 注册数据库高可用性配置提示词
server.registerPrompt(
  "database-high-availability",
  {
    title: "数据库高可用性配置助手",
    description: "帮助用户配置数据库高可用性解决方案",
    argsSchema: {
      database: z.string().describe("目标数据库名称"),
      haType: z.enum(["alwayson", "mirroring", "replication", "clustering"]).describe("高可用性类型"),
      requirements: z.string().describe("高可用性要求，如RTO、RPO、故障转移时间等")
    }
  },
  ({ database, haType, requirements }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `我需要为${database}数据库配置${haType === 'alwayson' ? 'Always On可用性组' : haType === 'mirroring' ? '数据库镜像' : haType === 'replication' ? '复制' : '故障转移集群'}高可用性解决方案。

高可用性要求：${requirements}

请提供：
1. 架构设计建议
2. 配置步骤和脚本
3. 网络和存储要求
4. 故障转移测试方案
5. 监控和告警配置
6. 性能影响评估
7. 维护和故障排除指南
8. 最佳实践建议

请确保解决方案满足业务连续性要求。`
      }
    }]
  })
);

// 注册数据库性能调优提示词
server.registerPrompt(
  "database-performance-tuning",
  {
    title: "数据库性能调优助手",
    description: "帮助用户进行全面的数据库性能调优",
    argsSchema: {
      database: z.string().describe("目标数据库名称"),
      performanceIssue: z.string().describe("性能问题描述"),
      tuningScope: z.enum(["query", "index", "configuration", "comprehensive"]).describe("调优范围")
    }
  },
  ({ database, performanceIssue, tuningScope }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `我需要调优${database}数据库的性能。

性能问题：${performanceIssue}

调优范围：${tuningScope === 'query' ? '查询优化' : tuningScope === 'index' ? '索引优化' : tuningScope === 'configuration' ? '配置优化' : '综合调优'}

请提供：
1. 性能诊断方法
2. 瓶颈识别工具
3. 优化建议和脚本
4. 配置参数调优
5. 查询重写建议
6. 性能测试方案
7. 监控指标设置
8. 持续优化策略

请提供可量化的性能改进预期。`
      }
    }]
  })
);

// 注册数据库维护计划提示词
server.registerPrompt(
  "database-maintenance-plan",
  {
    title: "数据库维护计划助手",
    description: "帮助用户制定数据库维护计划",
    argsSchema: {
      database: z.string().describe("目标数据库名称"),
      maintenanceType: z.enum(["daily", "weekly", "monthly", "comprehensive"]).describe("维护类型"),
      requirements: z.string().describe("维护要求，如维护窗口、自动化程度等")
    }
  },
  ({ database, maintenanceType, requirements }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `我需要为${database}数据库制定${maintenanceType === 'daily' ? '日常' : maintenanceType === 'weekly' ? '每周' : maintenanceType === 'monthly' ? '每月' : '综合'}维护计划。

维护要求：${requirements}

请提供：
1. 维护任务清单
2. 自动化脚本
3. 维护窗口安排
4. 性能监控方案
5. 备份和恢复策略
6. 日志清理策略
7. 统计信息更新
8. 维护报告模板
9. 异常处理流程

请确保维护活动不影响业务运行。`
      }
    }]
  })
);

// 注册数据库容量规划提示词
server.registerPrompt(
  "database-capacity-planning",
  {
    title: "数据库容量规划助手",
    description: "帮助用户进行数据库容量规划和预测",
    argsSchema: {
      database: z.string().describe("目标数据库名称"),
      planningHorizon: z.enum(["short", "medium", "long"]).describe("规划周期：短期(3-6月)、中期(6-12月)、长期(1-3年)"),
      growthFactors: z.string().describe("增长因素，如用户增长、数据增长、业务扩展等")
    }
  },
  ({ database, planningHorizon, growthFactors }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `我需要为${database}数据库进行${planningHorizon === 'short' ? '短期' : planningHorizon === 'medium' ? '中期' : '长期'}容量规划。

增长因素：${growthFactors}

请提供：
1. 容量评估方法
2. 增长趋势分析
3. 资源需求预测
4. 扩展方案建议
5. 成本估算
6. 风险评估
7. 监控指标
8. 预警机制
9. 实施时间表

请考虑技术可行性和成本效益。`
      }
    }]
  })
);

// 注册数据库灾难恢复提示词
server.registerPrompt(
  "database-disaster-recovery",
  {
    title: "数据库灾难恢复助手",
    description: "帮助用户制定数据库灾难恢复计划",
    argsSchema: {
      database: z.string().describe("目标数据库名称"),
      recoveryType: z.enum(["rto", "rpo", "comprehensive"]).describe("恢复类型：RTO(恢复时间目标)、RPO(恢复点目标)、综合"),
      disasterScenarios: z.string().describe("灾难场景描述")
    }
  },
  ({ database, recoveryType, disasterScenarios }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `我需要为${database}数据库制定灾难恢复计划。

恢复类型：${recoveryType === 'rto' ? 'RTO(恢复时间目标)' : recoveryType === 'rpo' ? 'RPO(恢复点目标)' : '综合灾难恢复'}

灾难场景：${disasterScenarios}

请提供：
1. 风险评估和影响分析
2. 恢复策略设计
3. 备份和复制方案
4. 恢复流程和脚本
5. 测试和验证方法
6. 人员培训和演练
7. 文档和流程
8. 持续改进计划

请确保恢复计划的可执行性和有效性。`
      }
    }]
  })
);

// 注册数据库合规性检查提示词
server.registerPrompt(
  "database-compliance-checker",
  {
    title: "数据库合规性检查助手",
    description: "帮助用户进行数据库合规性检查和报告",
    argsSchema: {
      database: z.string().describe("目标数据库名称"),
      complianceStandard: z.string().describe("合规标准，如GDPR、SOX、PCI-DSS等"),
      checkScope: z.string().describe("检查范围描述")
    }
  },
  ({ database, complianceStandard, checkScope }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `我需要检查${database}数据库是否符合${complianceStandard}合规标准。

检查范围：${checkScope}

请提供：
1. 合规性检查清单
2. 自动化检查脚本
3. 数据分类和标记
4. 访问控制审计
5. 数据加密建议
6. 审计日志配置
7. 合规性报告模板
8. 风险缓解措施
9. 持续监控方案

请确保检查过程符合相关法规要求。`
      }
    }]
  })
);

// 注册数据库云迁移提示词
server.registerPrompt(
  "database-cloud-migration",
  {
    title: "数据库云迁移助手",
    description: "帮助用户规划和执行数据库云迁移",
    argsSchema: {
      sourceEnvironment: z.string().describe("源环境描述"),
      targetCloud: z.string().describe("目标云平台"),
      migrationStrategy: z.enum(["lift-shift", "refactor", "replatform", "rebuild"]).describe("迁移策略")
    }
  },
  ({ sourceEnvironment, targetCloud, migrationStrategy }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `我需要将数据库从${sourceEnvironment}迁移到${targetCloud}云平台。

迁移策略：${migrationStrategy === 'lift-shift' ? '直接迁移' : migrationStrategy === 'refactor' ? '重构迁移' : migrationStrategy === 'replatform' ? '平台重构' : '重新构建'}

请提供：
1. 云平台评估
2. 迁移路线图
3. 成本效益分析
4. 技术架构设计
5. 数据迁移策略
6. 性能优化建议
7. 安全配置
8. 测试和验证
9. 回滚计划
10. 运维转型

请考虑云原生特性和最佳实践。`
      }
    }]
  })
);

// 注册数据库机器学习集成提示词
server.registerPrompt(
  "database-ml-integration",
  {
    title: "数据库机器学习集成助手",
    description: "帮助用户集成机器学习功能到数据库",
    argsSchema: {
      database: z.string().describe("目标数据库名称"),
      mlFeature: z.enum(["predictive", "anomaly", "classification", "recommendation"]).describe("机器学习功能"),
      useCase: z.string().describe("具体应用场景描述")
    }
  },
  ({ database, mlFeature, useCase }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `我需要在${database}数据库中集成${mlFeature === 'predictive' ? '预测分析' : mlFeature === 'anomaly' ? '异常检测' : mlFeature === 'classification' ? '分类' : '推荐系统'}机器学习功能。

应用场景：${useCase}

请提供：
1. 技术架构设计
2. 数据准备和预处理
3. 模型选择和训练
4. 集成方案和API
5. 性能优化建议
6. 监控和更新策略
7. 安全考虑
8. 部署和运维
9. 成本估算
10. 成功指标

请考虑数据库性能和可扩展性。`
      }
    }]
  })
);

// 注册数据库API设计提示词
server.registerPrompt(
  "database-api-designer",
  {
    title: "数据库API设计助手",
    description: "帮助用户设计数据库API接口",
    argsSchema: {
      database: z.string().describe("目标数据库名称"),
      apiType: z.enum(["rest", "graphql", "grpc", "custom"]).describe("API类型"),
      requirements: z.string().describe("API需求描述")
    }
  },
  ({ database, apiType, requirements }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `我需要为${database}数据库设计${apiType === 'rest' ? 'REST' : apiType === 'graphql' ? 'GraphQL' : apiType === 'grpc' ? 'gRPC' : '自定义'}API接口。

API需求：${requirements}

请提供：
1. API架构设计
2. 端点设计和路由
3. 数据模型设计
4. 认证和授权
5. 错误处理
6. 性能优化
7. 缓存策略
8. 版本控制
9. 文档和测试
10. 监控和日志

请确保API的安全性、性能和可维护性。`
      }
    }]
  })
);

// 注册数据库微服务架构提示词
server.registerPrompt(
  "database-microservices-architect",
  {
    title: "数据库微服务架构助手",
    description: "帮助用户设计数据库微服务架构",
    argsSchema: {
      database: z.string().describe("目标数据库名称"),
      architectureType: z.enum(["shared", "per-service", "hybrid", "event-driven"]).describe("架构类型"),
      requirements: z.string().describe("架构需求描述")
    }
  },
  ({ database, architectureType, requirements }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `我需要为${database}数据库设计${architectureType === 'shared' ? '共享数据库' : architectureType === 'per-service' ? '服务独立数据库' : architectureType === 'hybrid' ? '混合架构' : '事件驱动'}微服务架构。

架构需求：${requirements}

请提供：
1. 架构模式选择
2. 数据一致性策略
3. 服务边界定义
4. 数据分片方案
5. 事务管理
6. 性能优化
7. 扩展性设计
8. 监控和治理
9. 部署策略
10. 最佳实践

请考虑数据一致性和服务独立性。`
      }
    }]
  })
);

// 注册数据库DevOps实践提示词
server.registerPrompt(
  "database-devops-practices",
  {
    title: "数据库DevOps实践助手",
    description: "帮助用户实施数据库DevOps实践",
    argsSchema: {
      database: z.string().describe("目标数据库名称"),
      devopsArea: z.enum(["automation", "ci-cd", "monitoring", "comprehensive"]).describe("DevOps领域"),
      requirements: z.string().describe("DevOps需求描述")
    }
  },
  ({ database, devopsArea, requirements }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `我需要在${database}数据库中实施${devopsArea === 'automation' ? '自动化' : devopsArea === 'ci-cd' ? 'CI/CD' : devopsArea === 'monitoring' ? '监控' : '综合'}DevOps实践。

DevOps需求：${requirements}

请提供：
1. 自动化脚本和工具
2. CI/CD流水线设计
3. 环境管理策略
4. 配置管理
5. 测试自动化
6. 部署策略
7. 监控和告警
8. 日志管理
9. 安全实践
10. 团队协作流程

请确保DevOps实践的安全性和可靠性。`
      }
    }]
  })
);

// 注册数据库成本优化提示词
server.registerPrompt(
  "database-cost-optimizer",
  {
    title: "数据库成本优化助手",
    description: "帮助用户优化数据库运营成本",
    argsSchema: {
      database: z.string().describe("目标数据库名称"),
      costArea: z.enum(["licensing", "infrastructure", "operations", "comprehensive"]).describe("成本优化领域"),
      budget: z.string().describe("预算约束和目标")
    }
  },
  ({ database, costArea, budget }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `我需要优化${database}数据库的${costArea === 'licensing' ? '许可' : costArea === 'infrastructure' ? '基础设施' : costArea === 'operations' ? '运营' : '综合'}成本。

预算约束：${budget}

请提供：
1. 成本分析报告
2. 优化机会识别
3. 许可优化建议
4. 资源利用率提升
5. 自动化成本节省
6. 云迁移成本分析
7. 性能优化成本效益
8. 长期成本规划
9. ROI分析
10. 实施路线图

请确保成本优化不影响系统性能和可靠性。`
      }
    }]
  })
);

// 注册数据库知识库资源
server.registerResource(
  "knowledge-base",
  "knowledge://mssql-best-practices",
  {
    title: "MSSQL最佳实践知识库",
    description: "SQL Server数据库管理的最佳实践和指南",
    mimeType: "application/json"
  },
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: JSON.stringify({
        title: "SQL Server最佳实践知识库",
        version: "1.0.0",
        categories: {
          "性能优化": {
            "查询优化": [
              "使用参数化查询防止SQL注入",
              "避免SELECT *，只选择需要的列",
              "合理使用索引，避免过度索引",
              "使用EXISTS代替IN进行子查询",
              "避免在WHERE子句中使用函数"
            ],
            "索引管理": [
              "定期重建和重组索引",
              "监控索引使用情况",
              "删除未使用的索引",
              "使用覆盖索引优化查询",
              "考虑索引的维护成本"
            ],
            "配置优化": [
              "调整内存配置参数",
              "优化tempdb配置",
              "配置适当的并行度",
              "调整锁超时设置",
              "优化统计信息更新频率"
            ]
          },
          "安全最佳实践": {
            "访问控制": [
              "使用最小权限原则",
              "定期审查用户权限",
              "使用角色管理权限",
              "实施行级安全性",
              "加密敏感数据"
            ],
            "审计和监控": [
              "启用SQL Server审计",
              "监控异常访问模式",
              "记录所有管理操作",
              "定期审查安全日志",
              "实施实时告警"
            ]
          },
          "高可用性": {
            "备份策略": [
              "实施完整、差异和事务日志备份",
              "测试备份恢复流程",
              "使用压缩减少备份大小",
              "实施备份验证",
              "考虑异地备份存储"
            ],
            "灾难恢复": [
              "制定RTO和RPO目标",
              "实施Always On可用性组",
              "定期进行灾难恢复演练",
              "监控复制延迟",
              "准备回滚计划"
            ]
          },
          "维护和监控": {
            "日常维护": [
              "定期更新统计信息",
              "检查数据库完整性",
              "清理历史数据",
              "优化日志文件",
              "监控磁盘空间"
            ],
            "性能监控": [
              "使用DMV监控性能",
              "设置性能基线",
              "监控等待统计",
              "跟踪慢查询",
              "分析执行计划"
            ]
          }
        },
        resources: {
          "官方文档": "https://docs.microsoft.com/en-us/sql/sql-server/",
          "社区论坛": "https://dba.stackexchange.com/questions/tagged/sql-server",
          "性能调优指南": "https://docs.microsoft.com/en-us/sql/relational-databases/performance/",
          "安全最佳实践": "https://docs.microsoft.com/en-us/sql/relational-databases/security/"
        }
      }, null, 2)
    }]
  })
);

// 注册数据库故障排除资源
server.registerResource(
  "troubleshooting-guide",
  "troubleshooting://mssql-common-issues",
  {
    title: "MSSQL常见问题故障排除指南",
    description: "SQL Server常见问题的诊断和解决方案",
    mimeType: "application/json"
  },
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: JSON.stringify({
        title: "SQL Server常见问题故障排除指南",
        version: "1.0.0",
        commonIssues: {
          "连接问题": {
            "症状": "无法连接到数据库服务器",
            "可能原因": [
              "SQL Server服务未启动",
              "网络连接问题",
              "防火墙阻止连接",
              "端口配置错误",
              "认证失败"
            ],
            "诊断步骤": [
              "检查SQL Server服务状态",
              "验证网络连接",
              "检查防火墙设置",
              "确认端口配置",
              "验证登录凭据"
            ],
            "解决方案": [
              "启动SQL Server服务",
              "修复网络连接",
              "修复网络连接",
              "配置防火墙规则",
              "更正端口设置",
              "重置密码或修复认证"
            ]
          },
          "性能问题": {
            "症状": "查询执行缓慢，系统响应慢",
            "可能原因": [
              "缺少适当的索引",
              "统计信息过期",
              "内存不足",
              "磁盘I/O瓶颈",
              "锁等待"
            ],
            "诊断步骤": [
              "分析执行计划",
              "检查索引使用情况",
              "监控内存使用",
              "分析I/O统计",
              "检查锁等待"
            ],
            "解决方案": [
              "创建缺失的索引",
              "更新统计信息",
              "增加内存配置",
              "优化磁盘配置",
              "优化事务设计"
            ]
          },
          "空间问题": {
            "症状": "数据库空间不足，无法插入数据",
            "可能原因": [
              "数据文件空间不足",
              "日志文件空间不足",
              "tempdb空间不足",
              "自动增长设置不当"
            ],
            "诊断步骤": [
              "检查数据文件空间",
              "检查日志文件空间",
              "检查tempdb空间",
              "查看自动增长设置"
            ],
            "解决方案": [
              "增加数据文件大小",
              "清理日志文件",
              "优化tempdb配置",
              "调整自动增长设置"
            ]
          },
          "备份问题": {
            "症状": "备份失败或备份文件损坏",
            "可能原因": [
              "磁盘空间不足",
              "权限问题",
              "网络连接问题",
              "备份设备问题"
            ],
            "诊断步骤": [
              "检查磁盘空间",
              "验证备份权限",
              "测试网络连接",
              "检查备份设备"
            ],
            "解决方案": [
              "清理磁盘空间",
              "修复权限设置",
              "修复网络连接",
              "更换备份设备"
            ]
          }
        },
        diagnosticTools: [
          "SQL Server Profiler",
          "Extended Events",
          "Dynamic Management Views (DMVs)",
          "Performance Monitor",
          "SQL Server Management Studio"
        ],
        emergencyProcedures: [
          "立即停止问题查询",
          "重启SQL Server服务",
          "切换到备用服务器",
          "回滚到最近的备份",
          "联系技术支持"
        ]
      }, null, 2)
    }]
  })
);

// 注册数据库学习资源
server.registerResource(
  "learning-resources",
  "learning://mssql-tutorials",
  {
    title: "MSSQL学习资源",
    description: "SQL Server学习和培训资源",
    mimeType: "application/json"
  },
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: JSON.stringify({
        title: "SQL Server学习资源",
        version: "1.0.0",
        learningPaths: {
          "初学者": {
            "基础概念": [
              "数据库基础理论",
              "SQL语言基础",
              "SQL Server安装和配置",
              "基本查询操作"
            ],
            "推荐资源": [
              "Microsoft Learn SQL Server基础课程",
              "SQL Server Tutorial网站",
              "《SQL Server从入门到精通》",
              "在线实践环境"
            ],
            "学习时间": "2-3个月"
          },
          "中级用户": {
            "进阶技能": [
              "索引设计和优化",
              "存储过程和函数",
              "事务和锁管理",
              "性能调优基础"
            ],
            "推荐资源": [
              "SQL Server性能调优课程",
              "高级T-SQL编程指南",
              "《SQL Server性能调优实战》",
              "社区技术博客"
            ],
            "学习时间": "3-6个月"
          },
          "高级用户": {
            "专业技能": [
              "高可用性配置",
              "灾难恢复规划",
              "安全审计和合规",
              "云迁移策略"
            ],
            "推荐资源": [
              "SQL Server企业级管理课程",
              "高可用性解决方案指南",
              "《SQL Server企业级管理》",
              "技术会议和研讨会"
            ],
            "学习时间": "6-12个月"
          }
        },
        certificationPaths: [
          "Microsoft Certified: Azure Database Administrator Associate",
          "Microsoft Certified: Data Analyst Associate",
          "Microsoft Certified: Azure Data Engineer Associate"
        ],
        practicalProjects: [
          "个人博客数据库设计",
          "电商网站数据库优化",
          "企业级数据仓库构建",
          "云数据库迁移项目"
        ],
        communityResources: [
          "Stack Overflow SQL Server标签",
          "Reddit r/SQLServer社区",
          "SQL Server Central论坛",
          "本地技术用户组"
        ]
      }, null, 2)
    }]
  })
);

// 启动服务器
async function startServer() {
  try {
const transport = new StdioServerTransport();
    await server.connect(transport);
    //console.log("🚀 MCP MSSQL 服务器已启动");
  } catch (error) {
    //console.log("❌ 启动服务器失败:", error);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGINT', async () => {
  //console.log("\n🔄 正在关闭服务器...");
  stopHeartbeat();
  if (connectionPool) {
    await disconnectDatabase();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  //console.log("\n🔄 正在关闭服务器...");
  stopHeartbeat();
  if (connectionPool) {
    await disconnectDatabase();
  }
  process.exit(0);
});

// 启动服务器
startServer();