# Bitrix Task Manager

Universal MCP plugin for Bitrix24 task management.

The plugin is safe to publish as a private GitHub repository because it does not contain any real Bitrix24 webhook. Each installer provides their own incoming webhook during setup. The setup script stores it locally in `.bitrix-task-manager.json` and `.env`; both files are ignored by Git.

## Install Flow for AI Agents

1. Clone or install this plugin.
2. Run `npm install`.
3. Ask the user for their Bitrix24 incoming webhook URL.
4. Run:

```bash
npm run configure -- --webhook-url "https://your-domain.bitrix24.com/rest/USER_ID/WEBHOOK_TOKEN/"
```

5. Run:

```bash
npm run build
npm run verify
```

6. Start the MCP server from `.mcp.json`.

Never edit source code to insert the webhook. The webhook is a local installation secret.

## Security Model

The server calls `profile` with the configured webhook and caches the webhook owner's user ID. All task tools scope operations to that user:

- list uses `filter.RESPONSIBLE_ID = currentUserId`
- get checks that `task.responsibleId === currentUserId`
- update/complete/start first check the task belongs to the current user
- create assigns the new task to the current user

This is intentional. Even if the webhook belongs to an admin, the MCP tools expose only tasks assigned to the webhook owner.

## Tools

- `bitrix_whoami`
- `bitrix_my_tasks_list`
- `bitrix_my_tasks_get`
- `bitrix_my_tasks_create`
- `bitrix_my_tasks_update`
- `bitrix_my_tasks_start`
- `bitrix_my_tasks_complete`

## Bitrix24 Webhook Requirements

Create an incoming webhook in Bitrix24 with task access. The webhook URL should look like:

```text
https://your-domain.bitrix24.com/rest/USER_ID/WEBHOOK_TOKEN/
```

The plugin validates the webhook with `profile.json`.
