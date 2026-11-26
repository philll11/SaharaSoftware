# Sahara Software

The website at [saharasoftware.co.nz](https://www.saharasoftware.co.nz): Leonard Phillips' sole-trader business, with case studies of his work.

## Layout

| | |
|---|---|
| `src/pages/` | One file per page; `work/[slug].astro` renders every case study. |
| `src/content/work/` | The case studies, one MDX file each. The schema is in `src/content.config.ts`. |
| `src/data/resume.json` | Leonard's career in the [JSON Resume](https://jsonresume.org/schema) format: the one source for the Experience page and both resumes, checked by `src/resume.ts`. |
| `src/components/`, `src/layouts/` | The header, footer, work cards, screenshots and diagrams; `components/resume/` and `layouts/Print.astro` are the resume's A4 sheets. |
| `src/private/` | Pages only the private build makes (`pnpm resume`); no public build reads them. |
| `src/styles/global.css` | The "Dune" design system: colour tokens for light and dark, and every style. |
| `src/config.ts` | Site-wide constants: the address, the contact endpoint, the email and profile links (read from the resume data), the resume's address. |
| `src/assets/` | Images that Astro resizes and converts at build time. |
| `public/` | Files served as they are: favicons, share images in `og/`, `robots.txt`, `.well-known/security.txt`. |
| `scripts/print-resume.mjs` | Prints the resume pages to PDF; `pnpm build` and `pnpm resume` run it. |
| `tests/` | Playwright tests that run against the built site. |
| `contact-worker/` | The Cloudflare Worker behind the contact form, the only part of the site that runs code. |
| `docs/hosting.md` | DNS, domain verification, certificates, security headers and rollback. |

`src/assets/brand/icon.png` is derived from the brand originals, which live outside this repository.

## Working on it

It needs Node 24 and pnpm, at the version named by `packageManager` in `package.json`.

```powershell
pnpm install
pnpm dev                 # http://localhost:4321, with live reload
```

The Content Security Policy is written only by a production build, so check a change against the built site before pushing:

```powershell
pnpm check               # types and content schema
pnpm exec playwright install chromium   # once
pnpm build               # writes dist/, the public resume PDF among it
pnpm test                # every page, both themes, desktop and phone
```

The tests load every page in the sitemap, in light and dark at desktop and phone widths, and fail on a console error (a CSP violation among them), a WCAG 2.2 AA finding from axe, a broken image, horizontal scrolling or a broken internal link.
The contact form is tested against a mocked relay, so no message is sent.
The resume tests read the public PDF back: two tagged A4 pages whose text follows the order of the resume data, with no private contact details, and no trace of the private photo resume in `dist/`.

A case study is a new MDX file in `src/content/work/`; the homepage, the footer, the sitemap, the resume's Selected work and the tests pick it up.
Give it a share image in `public/og/`, 1200 by 630 pixels, and a `resume` entry in its front matter: one sentence and a short stack.

## The resume

The public resume, `/leonard-phillips-resume.pdf`, is printed from `/resume/sheet` on every build, so it always matches the site.
A second design with a photo is private: `pnpm resume` builds it into a temporary directory and saves both PDFs to your Downloads folder, and no public build can contain it.

To change the resume, edit `src/data/resume.json` (or a case study's `resume` front matter for Selected work) and set `meta.lastModified` to the day, which the resume shows as "Updated".
Each design fixes where page 2 begins (`SHEET_TWO_FROM`, `PAGE_TWO`).
When the content outgrows a sheet, the build stops and names the sheet and the overrun in millimetres; move the split to fit.

## Deploying

Pushing to `main` publishes.
[deploy-pages.yml](.github/workflows/deploy-pages.yml) runs the same checks on every pull request, and on `main` it also publishes `dist/` to GitHub Pages.
`contact-worker/**` triggers [deploy-worker.yml](.github/workflows/deploy-worker.yml).
Neither needs anything run by hand.
