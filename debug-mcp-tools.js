#!/usr/bin/env node

/**
 * Debug script to check what MCP tools are available and test their functionality
 */

// Since the tools.ts file suggests there's a test math server configuration,
// let's check what tools should be available
console.log('🔍 Debugging MCP Tools Configuration...\n');

// Check if we can access any MCP tools that are configured
console.log('📋 Expected MCP Math Server Configuration:');
console.log('- Server ID: test-math-server');
console.log('- URL: http://localhost:64590/sse');
console.log('- Transport: SSE');
console.log('- Expected tools: add, subtract, multiply, divide, calculate');

console.log('\n🔌 Checking if test math server is running...');

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { execSync } = require('child_process');

try {
  // Check if anything is listening on port 64590
  const netstatResult = execSync('netstat -an | grep 64590', { encoding: 'utf8' });
  console.log('✅ Found processes on port 64590:');
  console.log(netstatResult);
} catch (error) {
  console.log('❌ No processes found listening on port 64590');
  console.log('This explains why the MCP math tools are failing.');
}

console.log('\n🛠️ Diagnosis:');
console.log('The MCP tools are expecting a local math server at localhost:64590');
console.log('but this server is not running. This is why the add operation');
console.log('(44 + 22) in the screenshot failed with a connection error.');

console.log('\n💡 Solutions:');
console.log('1. Start the MCP math server on localhost:64590');
console.log('2. Update the configuration to use a different MCP server');
console.log('3. Disable MCP tools and use built-in math operations');

console.log('\n📝 Next Steps:');
console.log('- Check if there\'s a math MCP server in the codebase');
console.log('- Start the server if it exists');
console.log('- Or configure the system to use available MCP servers');
