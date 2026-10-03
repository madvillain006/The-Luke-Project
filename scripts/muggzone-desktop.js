#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { main: observe, loadPlaywright } = require("./muggzone-observe");

async function main() {
  const dataRoot = process.env.MUGGZONE_DATA_ROOT || "/workspace/muggzone-data";
  const repo = path.resolve(__dirname, "..");
  if (!path.isAbsolute(dataRoot) || dataRoot === "/" || dataRoot === repo || dataRoot.startsWith(`${repo}${path.sep}`)) throw new Error("Browser data must stay in a persistent directory outside the repository");
  const config = path.join(dataRoot, "observer/config.json");
  const profile = path.join(dataRoot, "firefox-profile");
  fs.mkdirSync(profile, { recursive: true, mode: 0o700 });
  const { firefox } = await loadPlaywright();
  const context = await firefox.launchPersistentContext(profile, { headless: false, viewport: null });
  const stop = async () => { await context.close().catch(() => {}); };
  process.once("SIGTERM", stop); process.once("SIGINT", stop);
  let closed = false;
  context.once("close", () => { closed = true; });
  try {
  const page = context.pages()[0] || await context.newPage();
  if (page.url() === "about:blank") await page.goto("https://discord.com/login");
  console.log("DESKTOP_READY: manual Discord sign-in; waiting for exact channel/author config");
  // No source observations or ledger are created before the explicit channel binding.
  while (!closed && !fs.existsSync(config)) await new Promise(resolve => setTimeout(resolve, 1000));
  if (!closed) await observe(["--config", config], { browserContext: context });
  // Keep the desktop available following an observer halt, without automatic retries.
  while (!closed) await new Promise(resolve => setTimeout(resolve, 1000));
  } finally {
    process.off("SIGTERM", stop); process.off("SIGINT", stop);
    await context.close().catch(() => {});
  }
}
module.exports = { main };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
