// Test script to get detailed information about MCP tools
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

async function testMCPToolsDetailed() {
    console.log("Getting detailed MCP tool information...");
    
    try {
        const transport = new SSEClientTransport(new URL("http://localhost:56460/sse"));
        
        const client = new Client(
            {
                name: "test-client",
                version: "1.0.0",
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        await client.connect(transport);
        console.log("Connected!");
        
        const tools = await client.listTools();
        console.log("Available tools:");
        
        tools.tools.forEach((tool, index) => {
            console.log(`\n${index + 1}. ${tool.name}`);
            console.log(`   Description: ${tool.description || 'No description'}`);
            console.log(`   Input Schema:`, JSON.stringify(tool.inputSchema, null, 2));
        });

        // Test the add function with 44 + 22
        console.log("\n🧪 Testing the 'add' tool with 44 + 22:");
        try {
            const result = await client.callTool({
                name: 'add',
                arguments: { a: 44, b: 22 }
            });
            console.log("✅ Add tool result:", result);
        } catch (error) {
            console.error("❌ Add tool failed:", error);
        }

        await client.close();
        console.log("\nConnection closed successfully");
        
    } catch (error) {
        console.error("Connection failed:", error);
    }
}

testMCPToolsDetailed().catch(console.error);
