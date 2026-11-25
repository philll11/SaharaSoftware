# Sahara Software

The website at [saharasoftware.co.nz](https://www.saharasoftware.co.nz): Leonard Phillips' sole-trader business, with case studies of his work.

## Layout

| | |
|---|---|
| `src/pages/` | One file per page; `work/[slug].astro` renders every case study. |
| `src/content/work/` | The case studies, one MDX file each. The schema is in `src/content.config.ts`. |
| `src/components/`, `src/layouts/` | The header, footer, work cards, screenshots and diagrams. |
| `src/styles/global.css` | The "Dune" design system: colour tokens for light and dark, and every style. |
| `src/config.ts` | Site-wide constants: the address, the contact endpoint, the email and profile links. |
| `src/assets/` | Images that Astro resizes and converts at build time. |
| `public/` | Files served as they are: favicons, share images in `og/`, `robots.txt`, `.well-known/security.txt`. |
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
pnpm build               # writes dist/
pnpm exec playwright install chromium   # once
pnpm test                # every page, both themes, desktop and phone
```

The tests load every page in the sitemap, in light and dark at desktop and phone widths, and fail on a console error (a CSP violation among them), a WCAG 2.2 AA finding from axe, a broken image, horizontal scrolling or a broken internal link.
The contact form is tested against a mocked relay, so no message is sent.

A case study is a new MDX file in `src/content/work/`; the homepage, the footer, the sitemap and the tests pick it up.
Give it a share image in `public/og/`, 1200 by 630 pixels.

## Deploying

Pushing to `main` publishes.
[deploy-pages.yml](.github/workflows/deploy-pages.yml) runs the same checks on every pull request, and on `main` it also publishes `dist/` to GitHub Pages.
`contact-worker/**` triggers [deploy-worker.yml](.github/workflows/deploy-worker.yml).
Neither needs anything run by hand.
