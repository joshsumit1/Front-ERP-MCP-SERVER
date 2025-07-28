import express from "express";
import axios from 'axios';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
//import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js"; FOR CUSTOM CLIENT USING CLIENT/PUBLIC/INDEX
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
//import dotenv from 'dotenv';
//dotenv.config();
import { z } from "zod";


let authSession = {
  user: null,
  password: null,
  companyId: null
};

function isLoggedIn() {
  return !!(authSession.user && authSession.password && authSession.companyId);
}

function getAuthHeaders() {
  if (!isLoggedIn()) {
    throw new Error(" Not logged in. Please call 'loginFrontAccounting' first.");
  }
  return {
    Accept: 'application/json',
    'X-COMPANY': authSession.companyId,
    'X-USER': authSession.user,
    'X-PASSWORD': authSession.password,
  };
}

const server = new McpServer({
    name: "example-server",
    version: "1.0.0"
});

// tools...

const app = express(); 


// In-memory undo stack
let undoStack = [];

function addToUndoHistory(entry) {
  undoStack.push(entry);
}

server.tool(
  'undoLastOperation',
  `Undoes the last destructive operation if supported (like DELETE).`,
  {},
  async () => {
    if (undoStack.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: ` No operations to undo.`,
          },
        ],
      };
    }

    const last = undoStack.pop();

    if (last.action === 'DELETE' && last.endpoint && last.id) {
      return {
        content: [
          {
            type: 'text',
            text: ` Undo not supported for DELETE /${last.endpoint}/${last.id}.\nYou must manually recreate the deleted data.`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: ` Undo for this action type (${last.action}) is not implemented.`,
        },
      ],
    };
  }
);

server.tool(
  'loginFrontAccounting',
  'Logs into FrontAccounting and stores credentials for reuse.',
  {
    user: z.string(),
    password: z.string(),
    companyId: z.string()
  },
  async (input) => {
    try {
      const url = "https://pouch-account.oreem.com/";  //for claude
      //const url = `${process.env.FRONT_ACCOUNTING_URL}`;  //for custom mcp client
      const response = await axios.post(url, {
        user: input.user,
        password: input.password
      });

      // Save session
      authSession.user = input.user;
      authSession.password = input.password;
      authSession.companyId = input.companyId;

      return {
        content: [
          {
            type: 'text',
            text: ` Login successful.\nSession saved.`,
          }
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: ` Login failed.\nError:\n\`\`\`\n${error.message}\n\`\`\``,
          },
        ],
      };
    }
  }
);


  server.tool(
    'getBankAccounts',
    `Fetches all bank accounts from the API using HTTP GET.`,
    {},
    async () => {
      const response = await fetch(
        'https://pouch-account.oreem.com/modules/api/bankaccounts',
        {
          method: 'GET',
          headers: getAuthHeaders(),
        }
      );
  
      if (!response.ok) {
        return {
          content: [
            {
              type: 'text',
              text: `Error ${response.status}: ${response.statusText}`,
            },
          ],
        };
      }
  
      const data = await response.json();
  
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    'getBankAccountById',
    `Fetches a specific bank account by its ID from the API.`,
    {
      id: z.string().describe("The ID of the bank account to fetch"),
    },
    async ({ id }) => {
      const url = `https://pouch-account.oreem.com/modules/api/bankaccounts/${id}`;
  
      const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
  
      if (!response.ok) {
        return {
          content: [
            {
              type: 'text',
              text: `Error ${response.status}: ${response.statusText}`,
            },
          ],
        };
      }
  
      const data = await response.json();
  
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    }
  );
  
  server.tool(
    'updateBankAccountById',
    `Updates a specific bank account by ID using PUT request.`,
    {
      id: z.string(),
      payload: z.record(z.any()) // Accepts a generic object as payload
    },
    async ({ id, payload }) => {
      if (!isLoggedIn()) {
        return {
          content: [
            {
              type: 'text',
              text: ` Not logged in. Please call 'loginFrontAccounting' first.`,
            },
          ],
        };
      }
  
      const url = `https://pouch-account.oreem.com/modules/api/bankaccounts/${id}`;
  
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
      });
  
      if (!response.ok) {
        const errText = await response.text();
        return {
          content: [
            {
              type: 'text',
              text: ` Failed to update bank account ${id}.\nStatus: ${response.status} ${response.statusText}\n\n${errText}`,
            },
          ],
        };
      }
  
      const data = await response.json();
  
      return {
        content: [
          {
            type: 'text',
            text: ` Bank account ${id} updated successfully:\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``,
          },
        ],
      };
    }
  );
  
  server.tool(
    'searchBankAccountsByOwner',
    `Search bank accounts by owner name using HTTP GET.`,
    {
      owner: z.string().describe("The name of the bank account owner to search for"),
    },
    async ({ owner }) => {
      const response = await fetch(
        `https://pouch-account.oreem.com/modules/api/bankaccounts?owner=${encodeURIComponent(owner)}`,
        {
          method: 'GET',
          headers: getAuthHeaders(),
        }
      );
  
      if (!response.ok) {
        return {
          content: [
            {
              type: 'text',
              text: `Error ${response.status}: ${response.statusText}`,
            },
          ],
        };
      }
  
      const data = await response.json();
  
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    }
  );
  
  server.tool(
    'deleteBankAccountById',
    `Deletes a bank account by ID using DELETE /bankaccounts/{id}.`,
    {
      id: z.string()
    },
    async ({ id }) => {
      if (!isLoggedIn()) {
        return {
          content: [
            {
              type: 'text',
              text: ` Not logged in. Please run 'loginFrontAccounting' first.`,
            },
          ],
        };
      }
  
      const url = `https://pouch-account.oreem.com/modules/api/bankaccounts/${id}`;
  
      const response = await fetch(url, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
  
      if (!response.ok) {
        const errText = await response.text();
        return {
          content: [
            {
              type: 'text',
              text: ` Failed to delete bank account ${id}.\nStatus: ${response.status} ${response.statusText}\n\n${errText}`,
            },
          ],
        };
      }
  
      // Optionally track operation for undo
      addToUndoHistory({
        action: 'DELETE',
        endpoint: 'bankaccounts',
        id
      });
  
      return {
        content: [
          {
            type: 'text',
            text: `🗑️ Bank account ${id} deleted successfully.`,
          },
        ],
      };
    }
  );
  

  server.tool(
    'deleteBankAccountFields',
    `Deletes (nullifies) specific fields of a bank account using PUT /bankaccounts/{id}.`,
    {
      id: z.string(),
      fields: z.array(z.enum([
        "bank_name",
        "bank_account_number",
        "bank_curr_code",
        "bank_address",
        "dflt_curr_act"
      ]))
    },
    async ({ id, fields }) => {
      if (!isLoggedIn()) {
        return {
          content: [{ type: 'text', text: ` Not logged in. Please run 'loginFrontAccounting' first.` }],
        };
      }
  
      // Create payload with only the selected fields set to null
      const payload = {};
      for (const field of fields) {
        payload[field] = null;
      }
  
      const response = await fetch(
        `https://pouch-account.oreem.com/modules/api/bankaccounts/${id}`,
        {
          method: 'PUT',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );
  
      if (!response.ok) {
        const errText = await response.text();
        return {
          content: [
            { type: 'text', text: ` Failed to clear fields from bank account ${id}.` },
            { type: 'text', text: `Status: ${response.status} ${response.statusText}` },
            { type: 'text', text: errText }
          ],
        };
      }
  
      addToUndoHistory({
        action: 'UPDATE_FIELDS',
        endpoint: 'bankaccounts',
        id,
        clearedFields: fields
      });
  
      return {
        content: [
          { type: 'text', text: ` Cleared fields [${fields.join(', ')}] in bank account ${id}.` },
        ],
      };
    }
  );
  
  server.tool(
    'getDimensions',
    `Fetch dimensions data from the specified API endpoint using HTTP GET request.`,
    {},
    async () => {
      const response = await fetch(
        'https://pouch-account.oreem.com/modules/api/dimensions',
        {
          method: 'GET',
          headers: getAuthHeaders(),
        },
      )
      const data = await response.json()
      return { content: [{ type: 'text', text: JSON.stringify(data) }] }
    },
  )

  server.tool(
    'getDimensionById',
    `Fetch a single dimension by ID from the specified API endpoint using HTTP GET request.`,
    {},
    async () => {
      const response = await fetch(
        `https://pouch-account.oreem.com/modules/api/dimensions/${input.id}`,
        {
          method: 'GET',
          headers: getAuthHeaders(),
        }
      );
  
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch dimension: ${response.status} ${errorText}`);
      }
  
      const data = await response.json();
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    'updateDimensionById',
    `Updates a specific dimension (cost center) by ID using PUT /dimensions/{id}.`,
    {
      id: z.string(),
      payload: z.record(z.any()) // Accepts generic object to allow partial updates
    },
    async ({ id, payload }) => {
      if (!isLoggedIn()) {
        return {
          content: [
            {
              type: 'text',
              text: ` Not logged in. Please call 'loginFrontAccounting' first.`,
            },
          ],
        };
      }
  
      const url = `https://pouch-account.oreem.com/modules/api/dimensions/${id}`;
  
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
  
      if (!response.ok) {
        const errText = await response.text();
        return {
          content: [
            {
              type: 'text',
              text: ` Failed to update dimension ${id}.\nStatus: ${response.status} ${response.statusText}\n\n${errText}`,
            },
          ],
        };
      }
  
      const data = await response.json();
  
      return {
        content: [
          {
            type: 'text',
            text: ` Dimension ${id} updated successfully:\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``,
          },
        ],
      };
    }
  );

  server.tool(
    'deleteDimensionById',
    `Deletes a specific dimension by ID using DELETE /dimensions/{id}.`,
    {
      id: z.string()
    },
    async ({ id }) => {
      if (!isLoggedIn()) {
        return {
          content: [
            {
              type: 'text',
              text: ` Not logged in. Please run 'loginFrontAccounting' first.`,
            },
          ],
        };
      }
  
      const url = `https://pouch-account.oreem.com/modules/api/dimensions/${id}`;
  
      const response = await fetch(url, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        return {
          content: [
            {
              type: 'text',
              text: ` Failed to delete dimension with ID ${id}.\nStatus: ${response.status} ${response.statusText}\n\n${errorText}`,
            },
          ],
        };
      }
  
      return {
        content: [
          {
            type: 'text',
            text: ` Dimension with ID ${id} was successfully deleted.`,
          },
        ],
      };
    }
  );
  
  
  server.tool(
    'getExchangeRatesUSD',
    `Fetches exchange rates for USD from the API.`,
    {},
    async () => {
      const url = 'https://pouch-account.oreem.com/modules/api/exchangerates/usd';
  
      const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders(),
      });
  
      if (!response.ok) {
        return {
          content: [
            {
              type: 'text',
              text: `Error ${response.status}: ${response.statusText}`,
            },
          ],
        };
      }
  
      const data = await response.json();
  
      return {
        content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      };
    }
  );
  server.tool(
    'deleteExchangeRateById',
    `Deletes an exchange rate entry by currency and ID using DELETE /exchangerates/{currency}/{id}.`,
    {
      currency: z.string().describe("The 3-letter currency code (e.g., 'USD', 'EUR')"),
      id: z.string().describe("The ID of the exchange rate entry to delete")
    },
    async ({ currency, id }) => {
      if (!isLoggedIn()) {
        return {
          content: [
            {
              type: 'text',
              text: ` Not logged in. Please run 'loginFrontAccounting' first.`,
            },
          ],
        };
      }
  
      const url = `https://pouch-account.oreem.com/modules/api/exchangerates/${currency}/${id}`;
  
      const response = await fetch(url, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
  
      if (!response.ok) {
        const errorText = await response.text();
        return {
          content: [
            {
              type: 'text',
              text: ` Failed to delete exchange rate for currency ${currency} with ID ${id}.\nStatus: ${response.status} ${response.statusText}\n\n${errorText}`,
            },
          ],
        };
      }
  
      return {
        content: [
          {
            type: 'text',
            text: ` Exchange rate for ${currency} with ID ${id} was successfully deleted.`,
          },
        ],
      };
    }
  );
  

server.tool(
  'getGLAccounts',
  `Fetch general ledger accounts (GL Accounts) from the specified API endpoint using HTTP GET request.`,
  {},
  async () => {
    const response = await fetch(
      'https://pouch-account.oreem.com/modules/api/glaccounts',
      {
        method: 'GET',
        headers: getAuthHeaders(),
      }
    );

    const data = await response.json();

    return {
      content: [{ type: 'text', text: JSON.stringify(data) }],
    };
  }
);

server.tool(
  'getGLAccountByCode',
  `Fetch a specific General Ledger account by its account code from the API.`,
  {},
  async (input) => {
    const url = `https://pouch-account.oreem.com/modules/api/glaccounts/${input.account_code}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      return {
        content: [
          {
            type: 'text',
            text: `Error ${response.status}: ${response.statusText}`,
          },
        ],
      };
    }

    const data = await response.json();

    return {
      content: [{ type: 'text', text: JSON.stringify(data) }],
    };
  }
);
server.tool(
  'getGLAccountByName',
  `Fetches all GL accounts and filters them by account_name (case-insensitive match).`,
  { account_name: z.string() },
  async (input) => {
    const response = await fetch('https://pouch-account.oreem.com/modules/api/glaccounts', {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      return {
        content: [{ type: 'text', text: `Error ${response.status}: ${response.statusText}` }],
      };
    }

    const allAccounts = await response.json();

    // Filter by account_name (case-insensitive)
    const filtered = allAccounts.filter(account =>
      account.account_name?.toLowerCase().includes(input.account_name.toLowerCase())
    );

    return {
      content: [{ type: 'text', text: JSON.stringify(filtered, null, 2) }],
    };
  }
);

server.tool(
  'updateGLAccountById',
  `Updates a General Ledger (GL) account by ID using PUT /glaccounts/{id}.`,
  {
    id: z.string(),
    payload: z.record(z.any()) // Accepts any key-value pair object for update
  },
  async ({ id, payload }) => {
    if (!isLoggedIn()) {
      return {
        content: [
          {
            type: 'text',
            text: ` Not logged in. Please use 'loginFrontAccounting' first.`,
          },
        ],
      };
    }

    const url = `https://pouch-account.oreem.com/modules/api/glaccounts/${id}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        content: [
          {
            type: 'text',
            text: ` Failed to update GL account ${id}.\nStatus: ${response.status} ${response.statusText}\n\n${errText}`,
          },
        ],
      };
    }

    const data = await response.json();

    return {
      content: [
        {
          type: 'text',
          text: ` GL account ${id} updated successfully:\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``,
        },
      ],
    };
  }
);

server.tool(
  'deleteGLAccountById',
  `Deletes a GL account by ID using DELETE /glaccounts/{id}.`,
  {
    id: z.string().describe("The ID of the GL account to delete"),
  },
  async ({ id }) => {
    if (!isLoggedIn()) {
      return {
        content: [
          {
            type: 'text',
            text: ` Not logged in. Please run 'loginFrontAccounting' first.`,
          },
        ],
      };
    }

    const url = `https://pouch-account.oreem.com/modules/api/glaccounts/${id}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        content: [
          {
            type: 'text',
            text: ` Failed to delete GL account with ID ${id}.\nStatus: ${response.status} ${response.statusText}\n\n${errorText}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: ` GL account with ID ${id} was successfully deleted.`,
        },
      ],
    };
  }
);

server.tool(
  'getJournalEntries',
  `Fetches all journal entries from the specified API endpoint using HTTP GET.`,
  {},
  async () => {
    const response = await fetch(
      'https://pouch-account.oreem.com/modules/api/journal',
      {
        method: 'GET',
        headers: getAuthHeaders(),
      }
    );

    if (!response.ok) {
      return {
        content: [
          {
            type: 'text',
            text: `Error ${response.status}: ${response.statusText}`,
          },
        ],
      };
    }

    const data = await response.json();

    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    };
  }
);

server.tool(
  'getJournalEntryByTypeAndId',
  `Fetch a specific journal entry from the API using its type and ID.`,
  {},
  async () => {
    const url = `https://pouch-account.oreem.com/modules/api/journal/${input.type}/${input.id}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      return {
        content: [
          {
            type: 'text',
            text: `Error ${response.status}: ${response.statusText}`,
          },
        ],
      };
    }

    const data = await response.json();

    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    };
  }
);

server.tool(
  'updateJournalEntryById',
  `Updates a journal entry by ID using PUT /journal/{id}.`,
  {
    id: z.string(),
    payload: z.record(z.any())  // Accepts flexible journal data structure
  },
  async ({ id, payload }) => {
    if (!isLoggedIn()) {
      return {
        content: [
          {
            type: 'text',
            text: ` Not logged in. Please run 'loginFrontAccounting' first.`,
          },
        ],
      };
    }

    const url = `https://pouch-account.oreem.com/modules/api/journal/${id}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        content: [
          {
            type: 'text',
            text: ` Failed to update journal entry ${id}.\nStatus: ${response.status} ${response.statusText}\n\n${errText}`,
          },
        ],
      };
    }

    const data = await response.json();

    return {
      content: [
        {
          type: 'text',
          text: ` Journal entry ${id} updated successfully:\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``,
        },
      ],
    };
  }
);

server.tool(
  'deleteJournalEntryByTypeAndId',
  `Deletes a journal entry using DELETE /journal/{type}/{id}.`,
  {
    type: z.string().describe("The type of the journal entry (e.g., 'gl', 'bp', 'ar', etc.)"),
    id: z.string().describe("The ID of the journal entry to delete"),
  },
  async ({ type, id }) => {
    if (!isLoggedIn()) {
      return {
        content: [
          {
            type: 'text',
            text: ` Not logged in. Please run 'loginFrontAccounting' first.`,
          },
        ],
      };
    }

    const url = `https://pouch-account.oreem.com/modules/api/journal/${type}/${id}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        content: [
          {
            type: 'text',
            text: ` Failed to delete journal entry [${type}/${id}].\nStatus: ${response.status} ${response.statusText}\n\n${errorText}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: ` Journal entry [${type}/${id}] deleted successfully.`,
        },
      ],
    };
  }
);

server.tool(
  'getSales',
  `Fetches all sales records from the API using a GET request.`,
  {},
  async () => {
    const response = await fetch(
      'https://pouch-account.oreem.com/modules/api/sales/id',
      {
        method: 'GET',
        headers: getAuthHeaders(),
      }
    );

    if (!response.ok) {
      return {
        content: [
          {
            type: 'text',
            text: `Error ${response.status}: ${response.statusText}`,
          },
        ],
      };
    }

    const data = await response.json();

    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    };
  }
);
//You can create more tools by your own by just using the same syntax
server.tool(
  'updateSalesOrderById',
  `Updates a sales order by ID using PUT /sales/{id}.`,
  {
    id: z.string(),
    payload: z.record(z.any()) // Accepts flexible sales order data
  },
  async ({ id, payload }) => {
    if (!isLoggedIn()) {
      return {
        content: [
          {
            type: 'text',
            text: ` Not logged in. Please run 'loginFrontAccounting' first.`,
          },
        ],
      };
    }

    const url = `https://pouch-account.oreem.com/modules/api/sales/${id}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        content: [
          {
            type: 'text',
            text: ` Failed to update sales order ${id}.\nStatus: ${response.status} ${response.statusText}\n\n${errText}`,
          },
        ],
      };
    }

    const data = await response.json();

    return {
      content: [
        {
          type: 'text',
          text: ` Sales order ${id} updated successfully:\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``,
        },
      ],
    };
  }
);
// for personal
const transport = new StdioServerTransport();
await server.connect(transport);

//for remote deployment use this 
// to support multiple simultaneous connections we have a lookup object from
// sessionId to transport
//const transports = {};

//app.get("/sse", async (req, res) => {
//    const transport = new SSEServerTransport('/messages', res);
//    transports[ transport.sessionId ] = transport;
//    res.on("close", () => {
//        delete transports[ transport.sessionId ];
//    });
//    await server.connect(transport);
//});

//app.post("/messages", async (req, res) => {
//    const sessionId = req.query.sessionId;
//    const transport = transports[ sessionId ];
//    if (transport) {
//        await transport.handlePostMessage(req, res);
//    } else {
//        res.status(400).send('No transport found for sessionId');
//    }
//});

//app.listen(3001, () => {
//    console.log("Server is running on http://localhost:3001");
//});