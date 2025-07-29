// server.js
import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { GoogleGenAI } from "@google/genai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

config();

const app = express();
app.use(cors());
app.use(express.json());

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const mcpClient = new Client({
  name: "web-client",
  version: "1.0.0",
});

let tools = [];
const chatHistory = [];

await mcpClient.connect(new SSEClientTransport(new URL("http://localhost:3001/sse")));

tools = (await mcpClient.listTools()).tools.map(tool => {
  return {
    name: tool.name,
    description: tool.description,
    parameters: {
      type: tool.inputSchema.type,
      properties: tool.inputSchema.properties,
      required: tool.inputSchema.required
    }
  };
});

console.log("MCP Client connected");

// POST endpoint for web UI
app.post('/api/message', async (req, res) => {
  const userInput = req.body.message;

  chatHistory.push({
    role: "user",
    parts: [{ type: "text", text: userInput }]
  });

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: chatHistory,
    config: {
      tools: [{ functionDeclarations: tools }]
    }
  });

  const part = response.candidates[0].content.parts[0];

  if (part.functionCall) {
    const toolResult = await mcpClient.callTool({
      name: part.functionCall.name,
      arguments: part.functionCall.args
    });

    chatHistory.push({
      role: "user",
      parts: [{ type: "text", text: "Tool result: " + toolResult.content[0].text }]
    });

    return res.json({ reply: toolResult.content[0].text });
  }

  const replyText = part.text;
  chatHistory.push({
    role: "model",
    parts: [{ type: "text", text: replyText }]
  });

  return res.json({ reply: replyText });
});

app.use(express.static('public')); // to serve your HTML file

app.listen(4000, () => {
  console.log(' Web UI running at http://localhost:4000');
});
