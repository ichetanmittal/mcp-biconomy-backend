import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import { mcpClient } from './mcpClient.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mcpConnected: mcpClient.isReady(),
    timestamp: new Date().toISOString(),
  });
});

// Get available MCP tools
app.get('/api/tools', (req, res) => {
  try {
    const tools = mcpClient.getTools();
    res.json({ tools });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    if (!mcpClient.isReady()) {
      return res.status(503).json({ error: 'MCP client not connected' });
    }

    console.log('💬 Processing chat request...');

    // Clean messages - remove any extra properties that Claude API doesn't accept
    const cleanedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Get MCP tools and transform to Claude format
    const mcpTools = mcpClient.getTools();
    const claudeTools = mcpTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema
    }));

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      messages: cleanedMessages,
      tools: claudeTools,
    });

    console.log(`📊 Response: ${response.stop_reason}`);

    // Handle tool use
    if (response.stop_reason === 'tool_use') {
      const toolResults = [];

      for (const block of response.content) {
        if (block.type === 'tool_use') {
          console.log(`🔧 Tool requested: ${block.name}`);

          try {
            // Call MCP tool
            const result = await mcpClient.callTool(block.name, block.input);

            toolResults.push({
              tool_use_id: block.id,
              name: block.name,
              input: block.input,
              result: result,
            });
          } catch (error) {
            console.error(`Tool execution error:`, error);
            toolResults.push({
              tool_use_id: block.id,
              name: block.name,
              input: block.input,
              error: error.message,
            });
          }
        }
      }

      // Send response with tool results
      res.json({
        response: response,
        toolResults: toolResults,
        needsToolResponse: true,
      });
    } else {
      // Regular text response
      res.json({
        response: response,
        needsToolResponse: false,
      });
    }
  } catch (error) {
    console.error('❌ Chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Continue conversation after tool use
app.post('/api/chat/continue', async (req, res) => {
  try {
    const { messages, toolResults, assistantResponse } = req.body;

    // Clean messages - remove any extra properties (isToolCall, isError, etc.)
    const cleanedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Build tool result content
    const toolResultContent = toolResults.map((tr) => ({
      type: 'tool_result',
      tool_use_id: tr.tool_use_id,
      content: tr.error ? `Error: ${tr.error}` : JSON.stringify(tr.result),
    }));

    // Proper conversation flow:
    // 1. Previous messages (cleaned, user messages + any previous assistant messages)
    // 2. Assistant message with tool_use
    // 3. User message with tool_result
    const updatedMessages = [
      ...cleanedMessages,
      {
        role: 'assistant',
        content: assistantResponse.content, // The assistant's tool_use message
      },
      {
        role: 'user',
        content: toolResultContent, // Tool results must be in user message
      },
    ];

    // Get MCP tools and transform to Claude format
    const mcpTools = mcpClient.getTools();
    const claudeTools = mcpTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema
    }));

    // Continue conversation with Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      messages: updatedMessages,
      tools: claudeTools,
    });

    res.json({
      response: response,
      needsToolResponse: response.stop_reason === 'tool_use',
    });
  } catch (error) {
    console.error('❌ Continue chat error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Initialize MCP client and start server
async function startServer() {
  console.log('🚀 Starting MCP Backend Server...\n');

  // Connect to MCP server
  const connected = await mcpClient.initialize();

  if (!connected) {
    console.warn('⚠️  Server starting without MCP connection');
  }

  app.listen(PORT, () => {
    console.log(`\n✅ Server running on http://localhost:${PORT}`);
    console.log(`📡 MCP Status: ${mcpClient.isReady() ? 'Connected' : 'Disconnected'}`);
  });
}

startServer();
