import { readFile, writeFile } from "node:fs/promises";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
const databaseName = process.env.CLOUDFLARE_D1_DATABASE_NAME?.trim() || "gold-miner-saves";

if (!accountId || !apiToken) {
  throw new Error("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN are required.");
}

const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database`;
const headers = { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" };

async function cloudflare(path = "", init = {}) {
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { ...headers, ...init.headers } });
  const body = await response.json();
  if (!response.ok || !body.success) {
    const messages = body.errors?.map((entry) => entry.message).join("; ") || response.statusText;
    throw new Error(`Cloudflare API failed: ${messages}`);
  }
  return body.result;
}

const databases = await cloudflare("?per_page=100");
let database = databases.find((entry) => entry.name === databaseName);
if (!database) {
  database = await cloudflare("", { method: "POST", body: JSON.stringify({ name: databaseName }) });
  console.log(`Created D1 database: ${databaseName}`);
} else {
  console.log(`Using existing D1 database: ${databaseName}`);
}

if (!/^[0-9a-f-]{36}$/iu.test(database.uuid)) throw new Error("Cloudflare returned an invalid D1 database id.");
const source = await readFile("wrangler.jsonc", "utf8");
const output = source.replace("00000000-0000-4000-8000-000000000000", database.uuid);
if (output === source) throw new Error("D1 placeholder was not found in wrangler.jsonc.");
await writeFile(".wrangler.deploy.json", output, "utf8");
console.log(`Prepared deployment config for D1 ${database.uuid.slice(0, 8)}…`);
