import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) {
    return {};
  }

  const env: Record<string, string> = {};
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const index = line.indexOf("=");
    if (index > 0) {
      env[line.slice(0, index)] = line.slice(index + 1);
    }
  }

  return env;
}

function resolveFromRoot(path: string): string {
  return isAbsolute(path) ? path : resolve(pluginRoot, path);
}

export function loadWebhookUrl(): string {
  if (process.env.BITRIX_WEBHOOK_URL) {
    return process.env.BITRIX_WEBHOOK_URL;
  }

  const configPath = resolveFromRoot(process.env.BITRIX_CONFIG_PATH ?? ".bitrix-task-manager.json");
  if (existsSync(configPath)) {
    const config = JSON.parse(readFileSync(configPath, "utf8")) as { webhookUrl?: string };
    if (config.webhookUrl) {
      return config.webhookUrl;
    }
  }

  const env = parseEnvFile(resolve(pluginRoot, ".env"));
  if (env.BITRIX_WEBHOOK_URL) {
    return env.BITRIX_WEBHOOK_URL;
  }

  throw new Error(
    "Bitrix24 webhook is not configured. Ask the user for their incoming webhook URL, then run: npm run configure -- --webhook-url \"<url>\""
  );
}
