import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

function readArg(name) {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  return args[index + 1];
}

function normalizeWebhookUrl(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    throw new Error("Bitrix24 webhook URL is required.");
  }

  const url = new URL(trimmed);
  if (url.protocol !== "https:") {
    throw new Error("Bitrix24 webhook URL must use https.");
  }

  return url.toString().replace(/\/+$/, "/");
}

async function askWebhookUrl() {
  const rl = createInterface({ input, output });
  try {
    return await rl.question("Bitrix24 incoming webhook URL: ");
  } finally {
    rl.close();
  }
}

async function callProfile(webhookUrl) {
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

  return data.result;
}

const rawWebhookUrl = readArg("--webhook-url") ?? await askWebhookUrl();
const webhookUrl = normalizeWebhookUrl(rawWebhookUrl);
const skipVerify = args.includes("--skip-verify");

let profile = undefined;
if (!skipVerify) {
  profile = await callProfile(webhookUrl);
}

await writeFile(
  resolve(pluginRoot, ".bitrix-task-manager.json"),
  `${JSON.stringify({ webhookUrl }, null, 2)}\n`,
  "utf8"
);

await writeFile(
  resolve(pluginRoot, ".env"),
  `BITRIX_WEBHOOK_URL=${webhookUrl}\n`,
  "utf8"
);

if (profile) {
  const name = [profile.NAME, profile.LAST_NAME].filter(Boolean).join(" ").trim();
  console.log(`Configured Bitrix24 webhook for user ${profile.ID}${name ? ` (${name})` : ""}.`);
} else {
  console.log("Configured Bitrix24 webhook without verification.");
}
