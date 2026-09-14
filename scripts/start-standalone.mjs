#!/usr/bin/env node
/**
 * Production launcher for the `output: "standalone"` build.
 *
 * `next start` refuses to run a standalone build, and the standalone server does not
 * copy `public/` or `.next/static/` into its bundle — so both must be copied next to
 * the standalone server before it starts. Getting this wrong produces a server that
 * boots fine and then 404s every asset, which is a confusing way to lose an afternoon.
 *
 * It also loads `.env` / `.env.local` (Next's convention) so the standalone server
 * gets DATABASE_URL, MEDIA_ROOT, AUTH_SECRET etc. when run locally. In production
 * those come from the systemd unit's `EnvironmentFile` instead.
 */
import { cp, mkdir, access } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const standalone = path.join(root, ".next", "standalone");

// Load Next-style env files; real environment variables always win.
for (const name of [".env", ".env.local"]) {
  const file = path.join(root, name);
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const raw = trimmed.slice(eq + 1).trim();
    const value = raw.replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

// The standalone server chdirs into .next/standalone, so a relative MEDIA_ROOT would
// resolve to the wrong place. Resolve it against the project root here.
if (process.env.MEDIA_ROOT && !path.isAbsolute(process.env.MEDIA_ROOT)) {
  process.env.MEDIA_ROOT = path.resolve(root, process.env.MEDIA_ROOT);
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(standalone))) {
  console.error(
    "No standalone build found at .next/standalone.\nRun `npm run build` first.",
  );
  process.exit(1);
}

// Copy the browser-facing assets the standalone bundle does not carry.
await mkdir(path.join(standalone, ".next"), { recursive: true });
await cp(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), {
  recursive: true,
});
if (await exists(path.join(root, "public"))) {
  await cp(path.join(root, "public"), path.join(standalone, "public"), { recursive: true });
}

const port = process.env.PORT ?? "3000";
const hostname = process.env.HOSTNAME ?? "0.0.0.0";

console.log(`Starting CoolSpot (standalone) on http://${hostname}:${port}`);

const child = spawn(process.execPath, [path.join(standalone, "server.js")], {
  stdio: "inherit",
  env: { ...process.env, PORT: port, HOSTNAME: hostname },
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code) => process.exit(code ?? 0));
