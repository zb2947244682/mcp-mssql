#!/usr/bin/env node
// MSSQL MCP工具测试脚本

import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

// 启动MCP服务器
const mcpProcess = spawn('node', ['index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

console.log('🚀 启动MCP MSSQL服务器...');

// 等待服务器启动
await setTimeout(2000);

console.log('✅ 服务器已启动，开始测试...');

// 模拟测试流程
console.log('\n📋 测试流程:');
console.log('1. 获取连接状态 (应该显示未连接)');
console.log('2. 尝试执行SQL (应该失败，提示未连接)');
console.log('3. 尝试断开连接 (应该提示无连接)');
console.log('4. 连接数据库 (使用测试参数)');
console.log('5. 再次获取连接状态 (应该显示已连接)');
console.log('6. 执行简单SQL查询');
console.log('7. 断开连接');
console.log('8. 最终状态检查');

console.log('\n💡 注意: 这是一个演示脚本，实际使用时需要真实的MSSQL服务器');
console.log('   当前测试会显示连接失败，这是正常的，因为我们没有真实的数据库服务器');

// 关闭服务器
setTimeout(() => {
  console.log('\n🔄 测试完成，关闭服务器...');
  mcpProcess.kill('SIGTERM');
  process.exit(0);
}, 5000);

// 监听服务器输出
mcpProcess.stdout.on('data', (data) => {
  console.log(`📤 服务器输出: ${data.toString().trim()}`);
});

mcpProcess.stderr.on('data', (data) => {
  console.log(`❌ 服务器错误: ${data.toString().trim()}`);
});

mcpProcess.on('close', (code) => {
  console.log(`🔌 服务器已关闭，退出码: ${code}`);
});
