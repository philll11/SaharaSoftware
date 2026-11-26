// Prints the resume pages of a built site to PDF with Playwright's Chromium.
//
//   node scripts/print-resume.mjs            after `astro build`: writes the public
//                                            resume into dist/ (part of `pnpm build`)
//   node scripts/print-resume.mjs --private  builds the site with the private photo
//                                            design into a temporary directory and
//                                            saves both resumes to Downloads (`pnpm resume`)
//
// It stops with an error when a page logs one (a CSP violation among them) or
// when a sheet is nearly full: every [data-fit] box must keep MIN_SPARE_MM free
// below its content, or above its [data-foot] furniture. Chromium sets text a
// little differently on Linux, Windows and macOS, so a sheet that only just
// fits on one can overflow on another. Move the page split in the design, or
// tighten its spacing, when a sheet runs short.
import { mkdtemp, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { build, preview } from "astro";
import { chromium } from "@playwright/test";

const isPrivate = process.argv.includes("--private");
const MIN_SPARE_MM = 4;

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
// Chromium on Linux hints glyph advances by default, which places a PDF's letters
// unevenly enough that text extractors split words ("s aharas oftware"). Without
// hinting the text sets as it does on Windows and macOS.
const browser = await chromium.launch({ args: ["--font-render-hinting=none"] });
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

    // Free space in each box, in millimetres: from the bottom of its content to
    // its foot furniture, or to the inside of its bottom padding and border.
    const spare = await page.$$eval("[data-fit]", (boxes) =>
      boxes.map((box) => {
        const kids = [...box.children];
        const foot = kids.filter((k) => k.hasAttribute("data-foot"));
        const style = getComputedStyle(box);
        const limit = foot.length
          ? Math.min(...foot.map((f) => f.getBoundingClientRect().top))
          : box.getBoundingClientRect().bottom - parseFloat(style.paddingBottom) - parseFloat(style.borderBottomWidth);
        const used = Math.max(
          ...kids
            .filter((k) => !k.hasAttribute("data-foot"))
            .map((k) => k.getBoundingClientRect().bottom + parseFloat(getComputedStyle(k).marginBottom)),
        );
        const overflow = box.scrollHeight - box.clientHeight;
        const mm = ((overflow > 1 ? -overflow : limit - used) * 25.4) / 96;
        return { sheet: box.closest(".sheet")?.getAttribute("aria-label") ?? "a sheet", mm };
      }),
    );
    const tightest = spare.reduce((a, b) => (b.mm < a.mm ? b : a));
    if (tightest.mm < MIN_SPARE_MM) {
      throw new Error(
        `${pagePath}: ${tightest.sheet} has ${tightest.mm.toFixed(1)} mm to spare and needs ${MIN_SPARE_MM}. Move the page split in its design, or tighten its spacing.`,
      );
    }
    if (errors.length) throw new Error(`${pagePath} logged errors: ${errors.join(" | ")}`);

    await page.pdf({ path: out, preferCSSPageSize: true, printBackground: true, tagged: true, outline: true });
    console.log(`resume: ${pagePath} printed to ${out} (tightest: ${tightest.sheet}, ${tightest.mm.toFixed(1)} mm to spare)`);
    await page.close();
  }
} finally {
  await browser.close();
  await server.stop();
  if (isPrivate) await rm(outDir, { recursive: true, force: true });
}
