# 🌐 MCP Client Web UI

This is a lightweight MCP Client server built with Node.js and Express that connects to an MCP server using SSE transport. It serves a web-based UI and sends user prompts to Gemini (Google GenAI), enhanced with dynamic tool calling via the Model Context Protocol (MCP).

---

## 🚀 Features

- Connects to any MCP-compliant SSE server
- Automatically loads available MCP tools
- Sends user prompts to Gemini 2.0
- Handles function calls using MCP tools
- Serves a simple web UI via `/public`
- Maintains basic chat history with tool responses

---

## 🧱 Technologies Used

- [Express.js](https://expressjs.com/)
- [@google/genai](https://www.npmjs.com/package/@google/genai)
- [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk)
- [dotenv](https://www.npmjs.com/package/dotenv)
- [CORS](https://www.npmjs.com/package/cors)

---


