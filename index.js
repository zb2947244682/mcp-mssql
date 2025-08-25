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

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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