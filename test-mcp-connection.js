// Simple test script to debug MCP connection issues
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

async function testMCPConnection() {
    console.log("Testing MCP connection to localhost:56460...");
    
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

        console.log("Creating transport...");
        console.log("Connecting to server...");
        
        // Add timeout to prevent hanging
        const connectPromise = client.connect(transport);
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Connection timeout after 5 seconds")), 5000);
        });
        
        await Promise.race([connectPromise, timeoutPromise]);
        
        console.log("Connected! Listing tools...");
        const tools = await client.listTools();
        console.log("Available tools:", tools);
        
        await client.close();
        console.log("Connection closed successfully");
        
    } catch (error) {
        console.error("Connection failed:", error);
        console.error("Error details:", {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
    }
}

// Run the test
testMCPConnection().catch(console.error);
