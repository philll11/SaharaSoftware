import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

// One case study per file. The file name is the page's slug under /work/.
const work = defineCollection({
  loader: glob({ pattern: "*.mdx", base: "./src/content/work" }),
  schema: ({ image }) =>
    z.object({
      /** Product name, as the project itself writes it. */
      name: z.string(),
      /** The outcome headline. */
      title: z.string(),
      /** The lead paragraph under the headline. */
      summary: z.string(),
      /** The shorter text on the homepage card. */
      card: z.string(),
      /** The page's meta description. */
      description: z.string(),
      /** Position on the homepage and in the footer. */
      order: z.number().int(),
      status: z.object({
        label: z.string(),
        /** The few words on the homepage card's badge. */
        short: z.string(),
        live: z.boolean().default(false),
        /** The day the status line was last checked. */
        asOf: z.coerce.date(),
      }),
      role: z.string(),
      stack: z.array(z.string()).min(1),
      links: z.array(z.object({ label: z.string(), href: z.url() })).default([]),
      /** Screenshot shown under the headline and on the card. */
      shot: z
        .object({
          light: image(),
          dark: image().optional(),
          alt: z.string(),
          title: z.string().optional(),
        })
        .optional(),
      /** A closer crop for the homepage card; the card falls back to the shot. */
      cardShot: z.object({ light: image(), dark: image().optional() }).optional(),
      /** Share image under public/. */
      og: z.string(),
    }),
});

export const collections = { work };
