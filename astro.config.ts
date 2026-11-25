import { defineConfig, fontProviders } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { CONTACT_ENDPOINT, SITE_URL } from "./src/config";

export default defineConfig({
  site: SITE_URL,

  // GitHub Pages serves /privacy from privacy.html, so pages build as files
  // and links carry no trailing slash.
  trailingSlash: "never",
  build: { format: "file" },

  integrations: [mdx(), sitemap()],

  // Shiki highlights with inline styles, which the CSP below forbids. Prism
  // emits classes that styles.css colours instead.
  markdown: { syntaxHighlight: "prism" },

  // Fonts are downloaded at build time and served from this site, so no page
  // makes a request to Google.
  fonts: [
    {
      provider: fontProviders.google(),
      name: "Bricolage Grotesque",
      cssVariable: "--font-display",
      weights: ["400 800"],
      styles: ["normal"],
      subsets: ["latin"],
      fallbacks: ["sans-serif"],
    },
    {
      provider: fontProviders.google(),
      name: "Instrument Sans",
      cssVariable: "--font-body",
      weights: [400, 500, 600, 700],
      styles: ["normal"],
      subsets: ["latin"],
      fallbacks: ["sans-serif"],
    },
    {
      // The hand-lettered notes on figures, like a checker's marks on a drawing.
      provider: fontProviders.google(),
      name: "Architects Daughter",
      cssVariable: "--font-hand",
      weights: [400],
      styles: ["normal"],
      subsets: ["latin"],
      fallbacks: ["cursive"],
    },
    {
      provider: fontProviders.google(),
      name: "JetBrains Mono",
      cssVariable: "--font-mono",
      weights: [400, 500],
      styles: ["normal"],
      subsets: ["latin"],
      fallbacks: ["monospace"],
    },
  ],

  // GitHub Pages cannot send response headers, so the policy travels as a
  // <meta> tag that Astro writes on every page, with hashes for every script
  // and style it emits. frame-ancestors has no effect in a meta policy.
  security: {
    csp: {
      directives: [
        "default-src 'none'",
        "img-src 'self' data:",
        "font-src 'self'",
        `connect-src ${new URL(CONTACT_ENDPOINT).origin}`,
        "manifest-src 'self'",
        "base-uri 'none'",
        "form-action 'none'",
      ],
    },
  },
});
