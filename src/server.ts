import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { BitrixClient } from "./bitrix-client.js";
import { loadWebhookUrl } from "./config.js";

type ToolArgs = Record<string, unknown>;

const client = new BitrixClient(loadWebhookUrl());

const server = new Server(
  {
    name: "bitrix-task-manager",
    version: "0.1.0"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "bitrix_whoami",
      description: "Show the Bitrix24 profile connected to the configured webhook.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false
      }
    },
    {
      name: "bitrix_my_tasks_list",
      description: "List tasks assigned to the Bitrix24 webhook owner only.",
      inputSchema: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["open", "completed", "all"],
            description: "Defaults to open."
          },
          limit: {
            type: "number",
            minimum: 1,
            maximum: 100,
            description: "Maximum number of tasks to return. Defaults to 50."
          }
        },
        additionalProperties: false
      }
    },
    {
      name: "bitrix_my_tasks_get",
      description: "Get one task only if it is assigned to the Bitrix24 webhook owner.",
      inputSchema: {
        type: "object",
        properties: {
          taskId: {
            type: "number",
            minimum: 1
          }
        },
        required: ["taskId"],
        additionalProperties: false
      }
    },
    {
      name: "bitrix_my_tasks_create",
      description: "Create a task assigned to the Bitrix24 webhook owner.",
      inputSchema: {
        type: "object",
        properties: {
          title: {
            type: "string",
            minLength: 1
          },
          description: {
            type: "string"
          },
          deadline: {
            type: "string",
            description: "ISO date/time accepted by Bitrix24, for example 2026-06-01T18:00:00+03:00."
          },
          priority: {
            type: "string",
            enum: ["1", "2"],
            description: "1 is normal, 2 is high."
          }
        },
        required: ["title"],
        additionalProperties: false
      }
    },
    {
      name: "bitrix_my_tasks_update",
      description: "Update safe fields on a task assigned to the Bitrix24 webhook owner.",
      inputSchema: {
        type: "object",
        properties: {
          taskId: {
            type: "number",
            minimum: 1
          },
          title: {
            type: "string"
          },
          description: {
            type: "string"
          },
          deadline: {
            type: ["string", "null"]
          },
          priority: {
            type: "string",
            enum: ["1", "2"]
          }
        },
        required: ["taskId"],
        additionalProperties: false
      }
    },
    {
      name: "bitrix_my_tasks_start",
      description: "Move a task assigned to the Bitrix24 webhook owner to In Progress.",
      inputSchema: {
        type: "object",
        properties: {
          taskId: {
            type: "number",
            minimum: 1
          }
        },
        required: ["taskId"],
        additionalProperties: false
      }
    },
    {
      name: "bitrix_my_tasks_complete",
      description: "Complete a task assigned to the Bitrix24 webhook owner.",
      inputSchema: {
        type: "object",
        properties: {
          taskId: {
            type: "number",
            minimum: 1
          }
        },
        required: ["taskId"],
        additionalProperties: false
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const name = request.params.name;
    const args = (request.params.arguments ?? {}) as ToolArgs;

    if (name === "bitrix_whoami") {
      return ok(await client.profile());
    }

    if (name === "bitrix_my_tasks_list") {
      return ok(
        await client.listMyTasks({
          status: String(args.status ?? "open"),
          limit: numberArg(args.limit, 50)
        })
      );
    }

    if (name === "bitrix_my_tasks_get") {
      return ok(await client.getMyTask(requiredNumber(args.taskId, "taskId")));
    }

    if (name === "bitrix_my_tasks_create") {
      return ok(
        await client.createMyTask({
          title: requiredString(args.title, "title"),
          description: optionalString(args.description),
          deadline: optionalString(args.deadline),
          priority: optionalPriority(args.priority)
        })
      );
    }

    if (name === "bitrix_my_tasks_update") {
      return ok(
        await client.updateMyTask(requiredNumber(args.taskId, "taskId"), {
          title: optionalString(args.title),
          description: optionalString(args.description),
          deadline: args.deadline === null ? null : optionalString(args.deadline),
          priority: optionalPriority(args.priority)
        })
      );
    }

    if (name === "bitrix_my_tasks_start") {
      return ok(await client.startMyTask(requiredNumber(args.taskId, "taskId")));
    }

    if (name === "bitrix_my_tasks_complete") {
      return ok(await client.completeMyTask(requiredNumber(args.taskId, "taskId")));
    }

    return fail(`Unknown tool: ${name}`);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);

function ok(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2)
      }
    ]
  };
}

function fail(message: string) {
  return {
    isError: true,
    content: [
      {
        type: "text" as const,
        text: message
      }
    ]
  };
}

function requiredNumber(value: unknown, name: string): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return number;
}

function numberArg(value: unknown, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.max(1, Math.min(100, Math.trunc(number)));
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} must be a non-empty string.`);
  }

  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function optionalPriority(value: unknown): "1" | "2" | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === "1" || value === "2") {
    return value;
  }

  throw new Error("priority must be 1 or 2.");
}
