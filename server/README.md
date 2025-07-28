# 🧾 FrontAccounting MCP Server

A powerful and extensible [Model Context Protocol (MCP)](https://modelcontext.org) server that connects to a FrontAccounting ERP backend and provides natural language access to key financial APIs via Claude, ChatGPT, and any other MCP-compatible client.

> 🔐 Supports login and session management  
> 💳 Manage bank accounts, GL accounts, sales orders, journal entries, dimensions, and more  
> ✨ Built using `@modelcontextprotocol/sdk` and `FastAPI`/`Express` APIs for real-time collaboration

---

## 🔧 Features

- 🛡️ **Secure login session** to FrontAccounting instance
- 🏦 Full CRUD tools for:
  - Bank Accounts
  - Dimensions (Cost Centers)
  - General Ledger (GL) Accounts
  - Exchange Rates
  - Sales Orders
  - Journal Entries
- ♻️ **Undo last destructive operation**
- 🧠 Structured `zod` schemas for validation
- 🧩 Ready to use with Claude Desktop, ChatGPT, AgenticFlow, or any MCP-compatible client

---

## 📦 Installation

```bash
cd frontaccounting-mcp-server
npm install
---

## RUNNING THE SERVER

-Using Node:
-node index.js

-Using Nodemon (for auto-reloading):
-npx nodemon index.js