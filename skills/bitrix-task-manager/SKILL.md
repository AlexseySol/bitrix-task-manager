---
name: bitrix-task-manager
description: Install, configure, and use the Bitrix Task Manager MCP plugin. Use when a user asks to connect Bitrix24 tasks, configure a webhook, or manage their own Bitrix24 tasks through this plugin.
---

# Bitrix Task Manager

This plugin is universal. Do not edit source code to insert a user's Bitrix24 webhook.

## Installation Workflow

When installing this plugin for a user:

1. Ask the user for their Bitrix24 incoming webhook URL.
2. Run `npm install`.
3. Run `npm run configure -- --webhook-url "<user webhook URL>"`.
4. Run `npm run build`.
5. Run `npm run verify`.
6. Connect the MCP server using `.mcp.json`.

The configure script writes local secret files:

- `.bitrix-task-manager.json`
- `.env`

Both are ignored by Git and must never be committed.

## Task Scope Rules

Only expose tasks assigned to the webhook owner.

- Use `bitrix_whoami` to inspect the connected Bitrix24 user.
- Use `bitrix_my_tasks_list` for task lists.
- Never add a custom `RESPONSIBLE_ID` filter from the user's prompt.
- Never use a generic all-company task list.
- For get/update/start/complete, the server checks `responsibleId` against the webhook owner's profile ID before returning or mutating the task.

If the webhook is missing, ask the user for it and run the configure script.
