// Verifies that every inline <script> in site/*.html is covered by a sha256
// source expression in that page's own Content-Security-Policy <meta> tag.
//
// GitHub Pages cannot set response headers, so CSP ships in the markup and the
// hashes are pinned by hand. A pinned hash goes stale the moment anyone edits
// the markup it covers, and the only symptom is silently dropped metadata --
// so CI recomputes them and fails the build instead.
//
// Run:  node tools/check-csp.mjs

import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = fileURLToPath(new URL("../site/", import.meta.url));

const INLINE_SCRIPT = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi;
const META_CSP = /<meta\s+http-equiv=["']Content-Security-Policy["']\s+content="([^"]*)"/i;

const problems = [];

for (const name of (await readdir(SITE)).filter((f) => f.endsWith(".html"))) {
  const html = await readFile(join(SITE, name), "utf8");
  const policy = html.match(META_CSP)?.[1];

  if (!policy) {
    problems.push(`${name}: no Content-Security-Policy <meta> tag`);
    continue;
  }

  for (const [, body] of html.matchAll(INLINE_SCRIPT)) {
    const hash = `sha256-${createHash("sha256").update(body, "utf8").digest("base64")}`;
    if (!policy.includes(hash)) {
      problems.push(`${name}: inline <script> is not covered by the policy. Add '${hash}' to script-src.`);
    }
  }
}

if (problems.length > 0) {
  console.error("CSP check failed:\n" + problems.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}

console.log("CSP check passed.");
