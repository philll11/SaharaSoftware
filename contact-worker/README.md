# Contact relay

The Worker behind the contact form on [www.saharasoftware.co.nz](https://www.saharasoftware.co.nz).
GitHub Pages serves static files only, so this is the one piece of the site that
runs code and the only place the Resend key exists.

It validates the submission, rate-limits by client address, and hands the
message to Resend. Nothing is stored.

## First deploy

```powershell
npm install -g wrangler
wrangler login
wrangler deploy                          # from this directory
wrangler secret put RESEND_API_KEY       # send-only key from the Resend dashboard
```

`wrangler deploy` prints the `*.workers.dev` URL. That URL has to appear in two
places in the site or the form will not work:

- `CONTACT_ENDPOINT` in [site/main.js](../site/main.js)
- `connect-src` in the CSP `<meta>` of [site/index.html](../site/index.html)

## Continuous deploy

[deploy-worker.yml](../.github/workflows/deploy-worker.yml) redeploys on every
push to `main` that touches this directory. It needs a repository secret
`CLOUDFLARE_API_TOKEN` holding a token with the **Edit Cloudflare Workers**
template and nothing more. Secrets set with `wrangler secret put` are not
touched by a redeploy.

## Operating

```powershell
wrangler tail                # live requests and relay failures
wrangler versions list
wrangler rollback            # previous version
```

## Limits

`workers.dev` is documented by Cloudflare as a free-tier hostname intended for
projects that are not business-critical, and the free plan allows 100,000
requests a day. Both are comfortable for a contact form. Moving the Worker onto
a custom domain would require the zone to be served by Cloudflare, which the
rest of this setup deliberately avoids — see [docs/hosting.md](../docs/hosting.md).
