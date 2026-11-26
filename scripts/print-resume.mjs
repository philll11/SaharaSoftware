// Prints the resume pages of a built site to PDF with Playwright's Chromium.
//
//   node scripts/print-resume.mjs            after `astro build`: writes the public
//                                            resume into dist/ (part of `pnpm build`)
//   node scripts/print-resume.mjs --private  builds the site with the private photo
//                                            design into a temporary directory and
//                                            saves both resumes to Downloads (`pnpm resume`)
//
// It stops with an error when a page logs one (a CSP violation among them) or
// when a sheet's text would be cut off: every [data-fit] box must hold its
// content. Move the page split in the design when the content outgrows a sheet.
import { mkdtemp, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { build, preview } from "astro";
import { chromium } from "@playwright/test";

const isPrivate = process.argv.includes("--private");

let outDir = "dist";
// The public file name matches RESUME_URL in src/config.ts.
let targets = [{ page: "/resume/sheet", out: path.join(outDir, "leonard-phillips-resume.pdf") }];

if (isPrivate) {
  process.env["RESUME_PRIVATE"] = "1";
  outDir = await mkdtemp(path.join(tmpdir(), "resume-"));
  await build({ outDir, logLevel: "warn" });
  const downloads = path.join(homedir(), "Downloads");
  targets = [
    { page: "/resume/sheet", out: path.join(downloads, "Leonard Phillips Resume.pdf") },
    { page: "/resume/photo", out: path.join(downloads, "Leonard Phillips Resume (photo).pdf") },
  ];
}

const server = await preview({ outDir, logLevel: "warn" });
const browser = await chromium.launch();
try {
  for (const { page: pagePath, out } of targets) {
    const page = await browser.newPage();
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));

    const res = await page.goto(`http://localhost:${server.port}${pagePath}`, { waitUntil: "networkidle" });
    if (!res?.ok()) throw new Error(`${pagePath} answered ${res?.status()}`);
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMedia({ media: "print" });

    const overflowing = await page.$$eval("[data-fit]", (boxes) =>
      boxes
        .filter((b) => b.scrollHeight > b.clientHeight + 1)
        .map((b) => `${b.closest(".sheet")?.getAttribute("aria-label")}, ${Math.ceil(((b.scrollHeight - b.clientHeight) * 25.4) / 96)} mm over`),
    );
    if (overflowing.length) {
      throw new Error(`${pagePath} does not fit its sheets (${overflowing.join("; ")}). Move the page split in its design.`);
    }
    if (errors.length) throw new Error(`${pagePath} logged errors: ${errors.join(" | ")}`);

    await page.pdf({ path: out, preferCSSPageSize: true, printBackground: true, tagged: true, outline: true });
    console.log(`resume: ${pagePath} printed to ${out}`);
    await page.close();
  }
} finally {
  await browser.close();
  await server.stop();
  if (isPrivate) await rm(outDir, { recursive: true, force: true });
}
