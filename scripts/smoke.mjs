#!/usr/bin/env node
/**
 * Smoke check — the ONLY automated test in this project (the owners declined a test
 * suite). Its job is narrow: prove that after each phase the server boots and the main
 * routes actually return a working, server-rendered page.
 *
 * What it asserts, per route:
 *   1. the HTTP status is 200 (and no 5xx anywhere)
 *   2. the response is real HTML with a <title>, not an empty shell
 *   3. the expected marker text is present in the RAW response body
 *
 * Point 3 is the important one. It catches the exact failure that made the legacy site
 * invisible to Google for two years: a 200 response whose body contains an empty
 * <div id="root"> and no content. A status-code check alone would have passed.
 *
 * Usage:
 *   npm run build && npm start          # in one terminal
 *   npm run smoke                       # in another
 *   npm run smoke -- http://localhost:3001
 */

const BASE = (process.argv[2] ?? process.env.SMOKE_BASE_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

/** route → text that must appear in the server-rendered HTML */
const ROUTES = [
  { path: "/", expect: "Trending", label: "feed" },
  { path: "/map", expect: "Map", label: "map" },
  { path: "/spots", expect: "All spots", label: "spot index" },
  { path: "/category/scenic", expect: "Scenic", label: "category" },
  { path: "/spots/new", expect: "Add a spot", label: "add a spot" },
  { path: "/leaderboard", expect: "Leaderboard", label: "leaderboard" },
  { path: "/profile", expect: "My Profile", label: "profile" },
  { path: "/signin", expect: "Sign in", label: "sign-in" },
  { path: "/robots.txt", expect: "Sitemap", label: "robots.txt" },
  { path: "/sitemap.xml", expect: "<urlset", label: "sitemap.xml" },
];

let failures = 0;

function ok(message) {
  console.log(`  \x1b[32m✓\x1b[0m ${message}`);
}
function fail(message) {
  failures += 1;
  console.log(`  \x1b[31m✗\x1b[0m ${message}`);
}

async function check({ path, expect, label }) {
  const url = `${BASE}${path}`;
  let response;
  try {
    response = await fetch(url, { redirect: "manual" });
  } catch (error) {
    fail(`${label.padEnd(12)} ${path} — could not connect (${error.message})`);
    return;
  }

  if (response.status !== 200) {
    fail(`${label.padEnd(12)} ${path} — expected 200, got ${response.status}`);
    return;
  }

  const body = await response.text();

  // /robots.txt and friend are not HTML — just confirm they are non-empty.
  if (!path.endsWith(".txt") && !path.endsWith(".xml")) {
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      fail(`${label.padEnd(12)} ${path} — expected HTML, got ${contentType}`);
      return;
    }
    if (!/<title>[^<]+<\/title>/i.test(body)) {
      fail(`${label.padEnd(12)} ${path} — no <title> in the server response`);
      return;
    }
  }

  if (!body.includes(expect)) {
    fail(`${label.padEnd(12)} ${path} — marker "${expect}" missing from the raw HTML`);
    return;
  }

  ok(`${label.padEnd(12)} ${path} — ${response.status}, ${body.length} bytes, server-rendered`);
}

console.log(`\nCoolSpot smoke check → ${BASE}\n`);

// Wait for the server rather than assuming it is up. Without this the first few
// requests race the boot and come back as non-200, which reads as a failure when the
// app is actually fine.
async function waitForServer(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "no response";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(BASE, { redirect: "manual" });
      if (response.status > 0) return true;
    } catch (error) {
      lastError = error.message;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  console.error(
    `\x1b[31mCannot reach ${BASE} after ${timeoutMs / 1000}s\x1b[0m (${lastError}).\n` +
      `Start the server first:\n\n  npm run build && npm run start:prod\n`,
  );
  return false;
}

if (!(await waitForServer())) process.exit(1);

for (const route of ROUTES) {
  await check(route);
}

// A 5xx anywhere is a failure even if the page above happened to render.
for (const path of ["/nonexistent-page-should-404"]) {
  const response = await fetch(`${BASE}${path}`, { redirect: "manual" });
  if (response.status >= 500) {
    fail(`unknown route returned ${response.status} — expected 404`);
  } else {
    ok(`unknown route returns ${response.status}, not a 5xx`);
  }
}

// The spot detail route is dynamic and DB-backed — a missing slug must 404 (proving
// the route and the database are wired) rather than crash with a 5xx.
{
  const response = await fetch(`${BASE}/spot/__smoke_test__`, { redirect: "manual" });
  if (response.status !== 404) {
    fail(`spot detail    /spot/__smoke_test__ — expected 404, got ${response.status}`);
  } else {
    ok(`spot detail    /spot/__smoke_test__ — 404 as expected (route + DB wired)`);
  }
}

console.log(
  failures === 0
    ? `\n\x1b[32mAll checks passed.\x1b[0m\n`
    : `\n\x1b[31m${failures} check(s) failed.\x1b[0m\n`,
);

process.exit(failures === 0 ? 0 : 1);
