import { defineConfig, fontProviders } from "astro/config";
import type { AstroIntegration, AstroUserConfig } from "astro";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { CONTACT_ENDPOINT, SITE_URL } from "./src/config";

// The private photo resume exists only when `pnpm resume` builds with
// RESUME_PRIVATE=1, into a temporary directory. Any other build never reads its
// page and never configures its typeface, so neither the photo nor the font can
// reach dist/ (Astro copies every configured font there, used or not).
const privateBuild = process.env["RESUME_PRIVATE"] === "1";

const privateResume: AstroIntegration = {
  name: "private-resume",
  hooks: {
    "astro:config:setup": ({ injectRoute }) => {
      if (privateBuild) {
        injectRoute({ pattern: "/resume/photo", entrypoint: "./src/private/resume-photo.astro", prerender: true });
      }
    },
  },
};

export default defineConfig({
  site: SITE_URL,

  // GitHub Pages serves /privacy from privacy.html, so pages build as files
  // and links carry no trailing slash.
  trailingSlash: "never",
  build: { format: "file" },

  // The resume's print pages exist to be printed to PDF, not to be found.
  integrations: [
    mdx(),
    sitemap({ filter: (page) => !new URL(page).pathname.startsWith("/resume/") }),
    privateResume,
  ],

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
    // The photo resume's typeface, configured in the private build only.
    ...(privateBuild
      ? ([
          {
            provider: fontProviders.google(),
            name: "Raleway",
            cssVariable: "--font-raleway",
            weights: ["300 800"],
            styles: ["normal"],
            subsets: ["latin"],
            fallbacks: ["sans-serif"],
          },
        ] satisfies NonNullable<AstroUserConfig["fonts"]>)
      : []),
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
