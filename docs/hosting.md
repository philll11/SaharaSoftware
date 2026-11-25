# Hosting

`www.saharasoftware.co.nz` is an Astro site built by GitHub Actions and published by GitHub Pages from `dist/`.
The apex redirects to `www`.
The contact form is relayed by a Cloudflare Worker; everything else is static files.

| | |
|---|---|
| Publishing source | GitHub Actions: [deploy-pages.yml](../.github/workflows/deploy-pages.yml) builds, tests and publishes `dist/` |
| Custom domain | `www.saharasoftware.co.nz`, set in **Settings → Pages**. The root `CNAME` file GitHub wrote when the domain was saved is inert here, because the artifact contains only `dist/` |
| DNS | MyHost (`ns1`–`ns4.myhost.nz`). The zone stays there. |
| Certificate | Let's Encrypt, issued and renewed by GitHub |
| Contact relay | [contact-worker/](../contact-worker/) on Cloudflare Workers, at `sahara-contact.saharasoftware.workers.dev` |

The repository is public because GitHub Pages on the Free plan will not publish from a private one.

## DNS

Records this site depends on:

| Type | Host | Value |
|---|---|---|
| A | `@` | `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` |
| AAAA | `@` | `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153` |
| CNAME | `www` | `philll11.github.io.` |
| TXT | `_github-pages-challenge-philll11` | issued by GitHub, see below |
| CAA | `@` | `0 issue "letsencrypt.org"` |

The contact relay sends through Resend, which needs its own records.
They carry mail, not the website, but deleting them silently breaks the contact form:

| Type | Host | Value |
|---|---|---|
| TXT | `resend._domainkey` | Resend's DKIM key |
| MX | `send` | `feedback-smtp.ap-northeast-1.amazonses.com`, priority 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` |

`send` is the bounce return-path only.
The apex `SPF` and `MX` stay as they are; Resend's SPF belongs on `send` and must not be merged into the apex record.

Mail is unrelated to any of the above and must not be touched: `MX` points at `mail.saharasoftware.co.nz`, which has its own `A` record at MyHost.
Changing the apex `A` records does not affect it.

**The SPF record must not contain the `a` mechanism.**
`a` authorises whatever the apex `A` record points at, which is GitHub's shared Pages infrastructure.
`mx` already covers the real mail host:

```
v=spf1 mx include:_spf.myhost.co.nz ~all
```

The `CAA` record is safe only while every certificate issued for the domain and its subdomains comes from Let's Encrypt, as GitHub Pages and the MyHost mail certificate both do.
Check before adding a service that uses a different CA, or its renewals will start failing.

**Never add a wildcard record.**
Domain verification does not protect subdomains of subdomains, so `*.saharasoftware.co.nz` reopens the takeover risk that verification closes.

## Domain verification

`saharasoftware.co.nz` is verified against the `philll11` account, which means no other GitHub account can publish Pages to it.
Verify a domain **before** attaching it to a repository, not after.

**Settings → Pages → Add a domain**, then publish the `TXT` record it gives you.
Keep that record forever: removing it un-verifies the domain.

If Pages is ever disabled here while DNS still points at GitHub, remove the DNS records too.

## Contact relay

The Worker runs in the Cloudflare account registered to `leonard@saharasoftware.co.nz`, under that account's `saharasoftware.workers.dev` subdomain.
A workers.dev subdomain is claimed once per account and the API refuses to change it afterwards, so a different endpoint hostname means a different Cloudflare account.

The endpoint is `CONTACT_ENDPOINT` in [src/config.ts](../src/config.ts).
The form posts to it, and [astro.config.ts](../astro.config.ts) builds the CSP's `connect-src` from it, so the two cannot drift apart.
The Worker accepts requests only from the origin `https://www.saharasoftware.co.nz`, which is `ALLOWED_ORIGIN` in [contact-worker/src/index.js](../contact-worker/src/index.js).

`RESEND_API_KEY` is a Wrangler secret.
Redeploying the Worker does not touch it.

## Certificates

GitHub requests the certificate once the custom domain resolves to its servers, usually within minutes and at most 24 hours.
If it stalls, remove the custom domain in Settings and re-enter it, which cancels the pending attempt and starts a new one.
Enable **Enforce HTTPS** once the certificate exists.

## Security headers

GitHub Pages cannot set response headers.
There is no `_headers` file and no configuration surface, so the site carries what it can in markup and does without the rest:

| | |
|---|---|
| `Content-Security-Policy` | `<meta http-equiv>` on every page, written by Astro |
| `Referrer-Policy` | `<meta name="referrer">` on every page |
| `X-Frame-Options` / `frame-ancestors` | **absent.** `frame-ancestors` is ignored in a meta CSP |
| `X-Content-Type-Options` | **absent** |
| `Permissions-Policy` | **absent** |
| HSTS | **absent.** "Enforce HTTPS" redirects, but sends no header, so the domain cannot be preloaded |

This is accepted rather than overlooked.
The site has no authentication, no session and no state, so there is no action a framed or downgraded visitor could be tricked into taking.
Pages also sets `Access-Control-Allow-Origin: *` on every response, which costs nothing for content that is public anyway.

Closing those gaps means putting a proxy in front of Pages: in practice Cloudflare, with the zone moved to their nameservers and a Transform Rule adding the headers.
That trade is only worth making if the site stops being a brochure.

Astro's `security.csp` writes the policy into each page with a hash for every script and style it emits; the other directives are set in [astro.config.ts](../astro.config.ts).
Three things keep it working:

- An inline script Astro does not bundle needs its hash added by hand. [Base.astro](../src/layouts/Base.astro) does this for the theme script, from the exact bytes it sends.
- Astro does not hash the scoped `<style>` of a component rendered inside MDX, so those components keep their styles in `src/styles/global.css`.
- Inline `style` attributes are blocked; use a class.

The Playwright suite fails on any console error, which is how a CSP violation shows itself.
The JSON-LD block is a data block, not a script, so the policy does not apply to it.

Fonts are downloaded at build time and served from the site, so no page requests anything from a third party.

## Terms

GitHub Pages may not be used to run an online business, an e-commerce site, or anything primarily directed at facilitating commercial transactions or providing software as a service.
A marketing site with a contact form is within that.

Limits worth knowing: 1 GB published, 100 GB/month bandwidth and 10 builds/hour (both soft), and 10 minutes per deployment.

## Rollback

Reverting the site is a revert commit on `main`, and the workflow republishes.

Taking the domain off GitHub entirely is a DNS change: point the apex `A` back at the previous host and `www` back at the apex.
It takes effect within the TTL.
Nothing else needs undoing.
