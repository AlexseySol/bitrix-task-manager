import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function parseEnvFile(path) {
  if (!existsSync(path)) {
    return {};
  }

  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index), line.slice(index + 1)];
      })
  );
}

function loadWebhookUrl() {
  if (process.env.BITRIX_WEBHOOK_URL) {
    return process.env.BITRIX_WEBHOOK_URL;
  }

  const configPath = resolve(pluginRoot, ".bitrix-task-manager.json");
  if (existsSync(configPath)) {
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    if (config.webhookUrl) {
      return config.webhookUrl;
    }
  }

  const env = parseEnvFile(resolve(pluginRoot, ".env"));
  return env.BITRIX_WEBHOOK_URL;
}

const webhookUrl = loadWebhookUrl();
if (!webhookUrl) {
  throw new Error("BITRIX_WEBHOOK_URL is not configured. Run npm run configure first.");
}

const endpoint = new URL("profile.json", webhookUrl).toString();
const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    "accept": "application/json",
    "content-type": "application/json"
  },
  body: "{}"
});

const data = await response.json();
if (!response.ok || data.error) {
  throw new Error(data.error_description || data.error || `Bitrix24 returned HTTP ${response.status}`);
}

const profile = data.result;
const name = [profile.NAME, profile.LAST_NAME].filter(Boolean).join(" ").trim();
console.log(JSON.stringify({ ok: true, id: profile.ID, name }, null, 2));
