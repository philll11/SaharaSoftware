import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Every page the sitemap lists, so a new page is covered without editing this file.
const PAGES = [...readFileSync("dist/sitemap-0.xml", "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map(
  (m) => new URL(m[1]!).pathname,
);

/** Collects console errors and warnings, which include CSP violations. */
function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}

test("the sitemap lists the site's pages", () => {
  expect(PAGES).toContain("/");
  expect(PAGES).toContain("/experience");
  expect(PAGES.filter((p) => p.startsWith("/work/")).length).toBeGreaterThanOrEqual(4);
});

for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} theme`, () => {
    test.use({ colorScheme: scheme });

    for (const path of PAGES) {
      test(`${path} loads cleanly and passes WCAG 2.2 AA checks`, async ({ page }) => {
        const problems = watchConsole(page);
        const res = await page.goto(path, { waitUntil: "networkidle" });
        expect(res?.status()).toBe(200);

        await expect(page.locator("h1")).toHaveCount(1);
        expect(problems).toEqual([]);

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, "no horizontal scroll").toBeLessThanOrEqual(0);

        // Lazy images below the fold load once scrolled into view.
        await page.evaluate(async () => {
          for (const img of document.images) {
            if (img.checkVisibility()) {
              img.scrollIntoView();
              await img.decode().catch(() => undefined);
            }
          }
        });
        const broken = await page.evaluate(() =>
          [...document.images].filter((img) => img.checkVisibility() && img.naturalWidth === 0).map((img) => img.src),
        );
        expect(broken, "every visible image loads").toEqual([]);

        const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
        expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
      });
    }
  });
}

test("every internal link and anchor resolves", async ({ page, request }) => {
  const seen = new Set<string>();
  for (const path of PAGES) {
    await page.goto(path);
    const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href") ?? ""));
    for (const href of hrefs.filter((h) => h.startsWith("/") || h.startsWith("#"))) {
      const url = new URL(href, `http://localhost:4321${path}`);
      const key = url.pathname + url.hash;
      if (seen.has(key)) continue;
      seen.add(key);
      const res = await request.get(url.pathname);
      expect(res.status(), `${href} on ${path}`).toBe(200);
      if (url.hash) {
        const target = await request.get(url.pathname).then((r) => r.text());
        expect(target, `${href} on ${path}`).toContain(`id="${url.hash.slice(1)}"`);
      }
    }
  }
});

test("an unknown address, and the retired Postify pages, answer 404", async ({ request }) => {
  for (const path of ["/no-such-page", "/terms", "/data-deletion"]) {
    expect((await request.get(path)).status(), path).toBe(404);
  }
});

test("the theme choice applies and is remembered", async ({ page }) => {
  await page.goto("/");
  const burger = page.getByRole("button", { name: "Menu" });
  if (await burger.isVisible()) await burger.click();
  await page.getByRole("button", { name: "Dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  if (await burger.isVisible()) await burger.click();
  await expect(page.getByRole("button", { name: "Dark theme" })).toHaveAttribute("aria-pressed", "true");
});

test("the menu opens on a phone and closes with Escape", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the menu button shows on narrow screens only");
  await page.goto("/");
  const burger = page.getByRole("button", { name: "Menu" });
  await burger.click();
  await expect(burger).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Experience" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(burger).toHaveAttribute("aria-expanded", "false");
});
