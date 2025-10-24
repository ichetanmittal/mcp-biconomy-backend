import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { mcpClient } from './mcpClient.js';
import { signUpUser, signInUser, signOutUser, getUserSession } from './supabaseAuth.js';
import { createChat, getUserChats, getChatWithMessages, addMessageToChat, updateChatTitle, deleteChat } from './chatDatabase.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increase limit for large event data
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Middleware to extract user from auth token
const extractUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const result = await getUserSession(token);
    if (result.success) {
      req.user = result.user;
    }
  }
  next();
};

app.use(extractUser);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'MCP Backend API',
    version: '1.0.0',
    description: 'Express backend for OpenAI GPT with Blockza Podcasts MCP integration',
    aiProvider: 'OpenAI GPT-4',
    endpoints: {
      health: 'GET /api/health',
      tools: 'GET /api/tools',
      chat: 'POST /api/chat',
      chatContinue: 'POST /api/chat/continue'
    },
    mcpServer: 'https://blockza.fastmcp.app/mcp',
    status: mcpClient.isReady() ? 'Connected' : 'Disconnected'
  });
});

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mcpConnected: mcpClient.isReady(),
    timestamp: new Date().toISOString(),
  });
});

// Auth endpoints
// Sign up
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await signUpUser(email, password);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      user: result.user,
      session: result.session,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sign in
app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await signInUser(email, password);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      user: result.user,
      session: result.session,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sign out
app.post('/api/auth/signout', async (req, res) => {
  try {
    const result = await signOutUser();

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user session
app.post('/api/auth/session', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const result = await getUserSession(token);

    if (!result.success) {
      return res.status(401).json({ error: result.error });
    }

    res.json({
      success: true,
      user: result.user,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Chat endpoints (require authentication)
// Create a new chat
app.post('/api/chats', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const result = await createChat(req.user.id, title);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all chats for user
app.get('/api/chats', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await getUserChats(req.user.id);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific chat with messages
app.get('/api/chats/:chatId', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { chatId } = req.params;
    const result = await getChatWithMessages(chatId, req.user.id);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add message to chat
app.post('/api/chats/:chatId/messages', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { chatId } = req.params;
    const { role, content } = req.body;

    if (!role || !content) {
      return res.status(400).json({ error: 'Role and content are required' });
    }

    const result = await addMessageToChat(chatId, role, content, req.user.id);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update chat title
app.patch('/api/chats/:chatId', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { chatId } = req.params;
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const result = await updateChatTitle(chatId, title, req.user.id);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete chat
app.delete('/api/chats/:chatId', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { chatId } = req.params;
    const result = await deleteChat(chatId, req.user.id);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get available MCP tools
app.get('/api/tools', async (_req, res) => {
  try {
    // Ensure MCP client is initialized (for serverless environments)
    if (!mcpClient.isReady()) {
      console.log('🔄 MCP client not ready, initializing...');
      await mcpClient.initialize();
    }

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

    // Ensure MCP client is initialized (for serverless environments)
    if (!mcpClient.isReady()) {
      console.log('🔄 MCP client not ready, initializing...');
      const connected = await mcpClient.initialize();
      if (!connected) {
        return res.status(503).json({ error: 'MCP client failed to connect' });
      }
    }

    console.log('💬 Processing chat request...');

    // Clean messages - remove any extra properties
    const cleanedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Get MCP tools and transform to OpenAI function calling format
    const mcpTools = mcpClient.getTools();
    const openaiTools = mcpTools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      }
    }));

    // Call OpenAI API with function calling
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: cleanedMessages,
      tools: openaiTools,
      tool_choice: 'auto',
    });

    const message = response.choices[0].message;
    console.log(`📊 Response: ${message.tool_calls ? 'tool_calls' : 'text'}`);

    // Handle tool calls
    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolResults = [];

      for (const toolCall of message.tool_calls) {
        console.log(`🔧 Tool requested: ${toolCall.function.name}`);

        try {
          const args = JSON.parse(toolCall.function.arguments);
          // Call MCP tool
          const result = await mcpClient.callTool(toolCall.function.name, args);

          toolResults.push({
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            arguments: args,
            result: result,
          });
        } catch (error) {
          console.error(`Tool execution error:`, error);
          toolResults.push({
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            arguments: JSON.parse(toolCall.function.arguments),
            error: error.message,
          });
        }
      }

      // Send response with tool results
      res.json({
        response: message,
        toolResults: toolResults,
        needsToolResponse: true,
      });
    } else {
      // Regular text response
      res.json({
        response: message,
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
    // Ensure MCP client is initialized (for serverless environments)
    if (!mcpClient.isReady()) {
      console.log('🔄 MCP client not ready, initializing...');
      const connected = await mcpClient.initialize();
      if (!connected) {
        return res.status(503).json({ error: 'MCP client failed to connect' });
      }
    }

    const { messages, toolResults, assistantResponse } = req.body;

    // Clean messages - remove any extra properties (isToolCall, isError, etc.)
    const cleanedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Build tool result messages for OpenAI format
    const toolResultMessages = toolResults.map((tr) => ({
      role: 'tool',
      tool_call_id: tr.tool_call_id,
      content: tr.error ? `Error: ${tr.error}` : JSON.stringify(tr.result),
    }));

    // Proper conversation flow for OpenAI:
    // 1. Previous messages
    // 2. Assistant message with tool_calls
    // 3. Tool result messages
    const updatedMessages = [
      ...cleanedMessages,
      assistantResponse, // The assistant's message with tool_calls
      ...toolResultMessages, // Tool results as separate messages
    ];

    // Get MCP tools and transform to OpenAI format
    const mcpTools = mcpClient.getTools();
    const openaiTools = mcpTools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      }
    }));

    // Continue conversation with OpenAI
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: updatedMessages,
      tools: openaiTools,
      tool_choice: 'auto',
    });

    const message = response.choices[0].message;

    res.json({
      response: message,
      needsToolResponse: message.tool_calls && message.tool_calls.length > 0,
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

// Start server only if not in Vercel environment
if (process.env.VERCEL !== '1') {
  startServer();
} else {
  // Initialize MCP client for Vercel serverless
  mcpClient.initialize().catch(err => console.error('MCP init error:', err));
}

// Export for Vercel serverless
export default app;
