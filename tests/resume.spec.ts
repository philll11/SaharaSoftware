import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

// The resume as the build prints it (scripts/print-resume.mjs), checked against
// its data. One run is enough; the device projects would only repeat it.
const PDF = "dist/leonard-phillips-resume.pdf";

interface WorkEntry {
  type?: string;
  name?: string;
  position?: string;
  highlights?: string[];
  custom?: { resumeHighlights?: string[] };
}
const data = JSON.parse(readFileSync("src/data/resume.json", "utf8")) as { work: WorkEntry[] };

interface Run {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

/**
 * A page's text as an extractor rebuilds it: a space where the gap between two
 * runs is wider than a fraction of the type size, or where a new line starts.
 * Chromium splits text into runs differently on each platform, sometimes inside
 * a word, so joining runs blindly would misread the same page.
 */
function rebuild(runs: Run[]): string {
  let out = "";
  let prev: Run | undefined;
  for (const run of runs.filter((r) => r.str)) {
    if (prev) {
      const size = Math.max(run.height, prev.height) || 8;
      const newLine = Math.abs(run.transform[5]! - prev.transform[5]!) > size * 0.5;
      const gap = run.transform[4]! - (prev.transform[4]! + prev.width);
      if (newLine || gap > size * 0.15) out += " ";
    }
    out += run.str;
    prev = run;
  }
  return out.replace(/\s+/g, " ");
}

async function pdfText(file: string) {
  const doc = await getDocument({ data: new Uint8Array(readFileSync(file)) }).promise;
  const pages: { width: number; height: number; text: string }[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const [, , width, height] = page.view as [number, number, number, number];
    const content = await page.getTextContent();
    pages.push({ width, height, text: rebuild(content.items.flatMap((item) => ("str" in item ? [item] : []))) });
  }
  // pdfjs gives the catalogue's MarkInfo as a Map.
  const markInfo = (await doc.getMarkInfo()) as Map<string, unknown> | null;
  const structure = JSON.stringify(await (await doc.getPage(1)).getStructTree());
  const { info } = (await doc.getMetadata()) as { info: { Title?: string; Language?: string } };
  return { pages, tagged: markInfo?.get("Marked") === true, structure, info };
}

test.describe("resume", () => {
  test.skip(({ isMobile }) => isMobile, "the resume is a document, not a page; one run covers it");

  test("the public resume is two tagged A4 pages", async () => {
    const { pages, tagged, structure, info } = await pdfText(PDF);
    expect(pages).toHaveLength(2);
    for (const p of pages) {
      expect([Math.round(p.width), Math.round(p.height)], "A4 in points").toEqual([595, 842]);
    }
    expect(tagged, "a tagged, accessible PDF").toBe(true);
    expect(structure, "headings in the structure tree").toContain('"role":"H1"');
    expect(info.Title).toBe("Leonard Phillips, Resume");
    expect(info.Language).toBe("en-NZ");
  });

  test("the public resume reads in the order of its data, as a parser sees it", async () => {
    const text = (await pdfText(PDF)).pages
      .map((p) => p.text)
      .join(" ")
      .replace(/\s+/g, " ");

    // Each role's title, then that role's own first highlight, in the data's order.
    let from = 0;
    for (const w of data.work) {
      const title = w.type === "career-break" ? "Career break" : w.position!;
      const at = text.indexOf(title, from);
      expect(at, `"${title}" after the role before it, in: ${text.slice(from, from + 400)}`).toBeGreaterThanOrEqual(from);
      from = at;
      const first = (w.custom?.resumeHighlights ?? w.highlights ?? [])[0];
      if (first) {
        const start = first.split(" ").slice(0, 5).join(" ");
        const h = text.indexOf(start, at);
        expect(h, `"${start}" under "${title}", in: ${text.slice(at, at + 400)}`).toBeGreaterThan(at);
        from = h;
      }
    }

    // Company names come out whole, not spaced into letters.
    for (const name of ["Sahara Software", "Emixa", "Datacom", "Archant"]) expect(text).toContain(name);

    // Only the business contact details: no phone number, personal email or client name.
    expect(text).toContain("leonard@saharasoftware.co.nz");
    expect(text).not.toMatch(/\+\d{2}\s*\(?0?\)?\s*\d{2,3}/);
    expect(text).not.toMatch(/gmail|heijmans/i);
  });

  test("the resume page loads cleanly in print and passes WCAG 2.2 AA checks", async ({ page }) => {
    const problems: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" || m.type() === "warning") problems.push(`${m.type()}: ${m.text()}`);
    });
    page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));

    await page.emulateMedia({ media: "print" });
    const res = await page.goto("/resume/sheet", { waitUntil: "networkidle" });
    expect(res?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    expect(problems).toEqual([]);

    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  });

  test("the private photo resume never reaches the public build", () => {
    expect(existsSync("dist/resume/photo.html")).toBe(false);
    const files = (readdirSync("dist", { recursive: true }) as string[]).map((f) => f.replaceAll("\\", "/"));
    expect(files.filter((f) => /leonard-round|PhotoResume/i.test(f))).toEqual([]);

    // Astro copies every configured font into dist/, so an unused font file
    // means the photo resume's typeface was configured in a public build.
    const text = files
      .filter((f) => /\.(html|css)$/.test(f))
      .map((f) => readFileSync(path.join("dist", f), "utf8"))
      .join("\n");
    const unused = files.filter((f) => f.endsWith(".woff2") && !text.includes(path.basename(f)));
    expect(unused, "every font file is used by a page").toEqual([]);
  });

  test("the print pages stay out of the sitemap", () => {
    expect(readFileSync("dist/sitemap-0.xml", "utf8")).not.toContain("/resume/");
  });
});
