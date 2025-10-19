import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

class MCPClientManager {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.tools = [];
  }

  async initialize() {
    try {
      console.log('🔌 Connecting to Biconomy MCP server...');

      // Create MCP client
      this.client = new Client(
        {
          name: 'mcp-backend-client',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      // Connect to Biconomy MCP server via HTTP transport
      const transport = new StreamableHTTPClientTransport(
        new URL('https://docs.biconomy.io/mcp')
      );

      await this.client.connect(transport);
      this.isConnected = true;

      // Fetch available tools
      const toolsList = await this.client.listTools();
      this.tools = toolsList.tools;

      console.log('✅ Connected to Biconomy MCP server');
      console.log(`📦 Available tools: ${this.tools.length}`);
      this.tools.forEach((tool) => {
        console.log(`   - ${tool.name}: ${tool.description}`);
      });

      return true;
    } catch (error) {
      console.error('❌ Failed to connect to MCP server:', error);
      this.isConnected = false;
      return false;
    }
  }

  async callTool(toolName, args) {
    if (!this.isConnected) {
      throw new Error('MCP client not connected');
    }

    try {
      console.log(`🔧 Calling tool: ${toolName}`);
      const result = await this.client.callTool({
        name: toolName,
        arguments: args,
      });
      return result;
    } catch (error) {
      console.error(`❌ Tool call failed:`, error);
      throw error;
    }
  }

  getTools() {
    return this.tools;
  }

  isReady() {
    return this.isConnected;
  }
}

// Singleton instance
export const mcpClient = new MCPClientManager();
