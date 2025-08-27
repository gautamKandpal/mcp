import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "node:fs/promises";
import { title } from "node:process";

// Create an MCP server
const server = new McpServer({
  name: "myTestServer",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
    prompts: {},
  },
});

server.tool(
  "create-user",
  "Creates a new user in the databse ",
  {
    name: z.string(),
    email: z.string(),
    address: z.string(),
    phone: z.string(),
  },
  {
    title: "Create User",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  async (params) => {
    try {
      const id = await createUser(params);
      return {
        content: [
          {
            type: "text",
            text: `User ${id} created successfully`,
          },
        ],
      };
    } catch {
      return {
        content: [
          {
            type: "text",
            text: "Failed to save user",
          },
        ],
      };
    }
  }
);

server.resource(
  "users",
  "users://all",
  {
    description: "Get all users from the database",
    title: "Users",
    mineType: "application/json",
  },
  async (uri) => {
    const users = await import("./data/user.json", {
      with: { type: "json" },
    }).then((m) => m.default);

    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(users),
          mimeType: "application/json",
        },
      ],
    };
  }
);

server.resource(
  "user-details",
  new ResourceTemplate("users://{userId}/profile", { list: undefined }),
  {
    description: "Get a user's detials from the database",
    title: "Users Details",
    mineType: "application/json",
  },
  async (uri, { userId }) => {
    const users = await import("./data/user.json", {
      with: { type: "json" },
    }).then((m) => m.default);

    const user = users.find((u) => u.id === parseInt(userId as string));

    if (user == null) {
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify({ error: "User not found" }),
            mimeType: "application/json",
          },
        ],
      };
    }

    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(user),
          mimeType: "application/json",
        },
      ],
    };
  }
);

server.prompt(
  "genrate-fake-user",
  "Genrate fake user based on the a given name",
  {
    name: z.string(),
  },
  async ({ name }) => {
    //insert only if name is not in user.json
    const users = await import("./data/user.json", {
      with: { type: "json" },
    }).then((m) => m.default);

    const existingUser = users.find(
      (u) => u.name.trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (existingUser) {
      return {
        message: [
          {
            role: "user",
            content: {
              type: "text",
              text: `User already exists: ${JSON.stringify(existingUser)}`,
            },
          },
        ],
      };
    }

    const fakeUser = {
      name,
      email: `${name.toLowerCase()}.patel92@gmail.com`,
      address: "742 Evergreen Terrace, Springfield, IL",
      phone: "312-555-0198",
    };
    users.push(fakeUser);
    await fs.writeFile("./src/data/user.json", JSON.stringify(users, null, 2));

    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Genrate a fake user with the name ${name}. The user should have a realistic email, address, and phone number.`,
          },
        },
      ],
    };
  }
);

async function createUser(user: {
  name: string;
  email: string;
  address: string;
  phone: string;
}): Promise<string> {
  const users = await import("./data/user.json", {
    with: { type: "json" },
  }).then((m) => m.default);

  const id = users.length + 1;
  users.push({ id, ...user });

  await fs.writeFile("./src/data/user.json", JSON.stringify(users, null, 2));
  return id.toString();
}

async function main() {
  // Start receiving messages on stdin and sending messages on stdout
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
