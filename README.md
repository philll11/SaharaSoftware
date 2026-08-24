# Sahara Software

Company repository for [saharasoftware.co.nz](https://www.saharasoftware.co.nz) —
an independent New Zealand software studio, home of
[Postify](https://github.com/philll11/postify).

## Layout

| | |
|---|---|
| `site/` | The website exactly as published. GitHub Pages serves this directory verbatim; there is no build step. |
| `contact-worker/` | The Cloudflare Worker behind the contact form — the only part of the site that runs code. |
| `tools/check-csp.mjs` | Verifies the CSP hashes pinned in the pages. Runs in CI. |
| `docs/hosting.md` | DNS, domain verification, certificates, rollback. |

`site/assets/` is derived from the brand originals, which live outside this
repository along with the script that generates them.

## Running it locally

Any static file server rooted at `site/` will do:

```powershell
npx serve site           # http://localhost:3000
```

Use `serve` rather than `python -m http.server`: it resolves `/privacy` and
`/terms` to their `.html` files the way GitHub Pages does, and the plain Python
server does not.

The contact form posts to the deployed Worker, so submitting it locally will be
refused — the Worker only accepts requests from the live origin.

Before pushing a change to any page carrying an inline `<script>`:

```powershell
node tools/check-csp.mjs
```

## Deploying

Pushing to `main` publishes. `site/**` triggers
[deploy-pages.yml](.github/workflows/deploy-pages.yml); `contact-worker/**`
triggers [deploy-worker.yml](.github/workflows/deploy-worker.yml). Neither
needs anything run by hand.
