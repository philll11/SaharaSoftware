// Leonard's career, read once from src/data/resume.json and checked here, so the
// Experience page and both resume designs show the same facts. The file follows
// the JSON Resume format (https://jsonresume.org/schema); what the standard lacks
// lives in each object's `custom`, as the standard prescribes.
import { z } from "astro/zod";
import data from "./data/resume.json" with { type: "json" };

const yearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "a year and month, such as 2026-06");

const Work = z
  .object({
    type: z.literal("career-break").optional(),
    name: z.string().optional(),
    position: z.string().optional(),
    location: z.string(),
    startDate: yearMonth,
    endDate: yearMonth.optional(),
    summary: z.string().optional(),
    highlights: z.array(z.string()).default([]),
    custom: z
      .object({
        /** Shorter wording for the resume, where Selected work sits above. */
        resumeSummary: z.string().optional(),
        resumeHighlights: z.array(z.string()).optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((w) => w.type === "career-break" || (w.name && w.position), "a role needs a name and a position");

const Resume = z.object({
  meta: z.object({
    /** The "Updated" date on the resume; set it whenever the content changes. */
    lastModified: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/),
  }),
  basics: z.object({
    name: z.string(),
    label: z.string(),
    email: z.email(),
    url: z.url(),
    summary: z.string(),
    location: z.object({ region: z.string(), countryCode: z.string().length(2) }),
    profiles: z.array(z.object({ network: z.string(), username: z.string(), url: z.url() })),
    custom: z.object({ business: z.string(), headline: z.string(), availability: z.string() }).strict(),
  }),
  work: z.array(Work).min(1),
  education: z.array(
    z.object({
      institution: z.string(),
      studyType: z.string(),
      area: z.string(),
      location: z.string(),
      custom: z.object({ detail: z.string() }).strict(),
    }),
  ),
  certificates: z.array(z.object({ name: z.string(), issuer: z.string(), date: yearMonth.optional() })),
  skills: z.array(z.object({ name: z.string(), keywords: z.array(z.string()).min(1) })),
});

export const resume = Resume.parse(data);

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "June 2026", or "Jun 2026" when short. Spelled out here rather than by Intl, whose short months vary by ICU version. */
export function monthYear(yearMonthText: string, short = false): string {
  const [year, month] = yearMonthText.split("-").map(Number);
  const name = MONTHS[month! - 1]!;
  return `${short ? name.slice(0, 3) : name} ${year}`;
}

/** "June 2026 to present", as the website writes a span of time. */
export function dateRange(start: string, end?: string): string {
  return `${monthYear(start)} to ${end ? monthYear(end) : "present"}`;
}

/** The date an updated resume carries: "26 November 2026", or "26 Nov 2026" when short. */
export function updated(short = false): string {
  const [date] = resume.meta.lastModified.split("T");
  const [year, month, day] = date!.split("-").map(Number);
  const name = MONTHS[month! - 1]!;
  return `${day} ${short ? name.slice(0, 3) : name} ${year}`;
}

export interface Role {
  title: string;
  start: string;
  end?: string | undefined;
  summary?: string | undefined;
  highlights: string[];
  /** The resume's wording, which falls back to the website's. */
  resumeSummary?: string | undefined;
  resumeHighlights: string[];
}

export interface Employer {
  name: string;
  isBreak: boolean;
  location: string;
  start: string;
  end?: string | undefined;
  roles: Role[];
}

/** Work grouped by employer, newest first: consecutive roles at one employer form one entry, as Datacom's two do. */
export const employers: Employer[] = resume.work.reduce<Employer[]>((groups, w) => {
  const isBreak = w.type === "career-break";
  const role: Role = {
    title: isBreak ? "Career break" : w.position!,
    start: w.startDate,
    end: w.endDate,
    summary: w.summary,
    highlights: w.highlights,
    resumeSummary: w.custom?.resumeSummary ?? w.summary,
    resumeHighlights: w.custom?.resumeHighlights ?? w.highlights,
  };
  const last = groups.at(-1);
  if (last && !isBreak && !last.isBreak && last.name === w.name) {
    last.roles.push(role);
    last.start = w.startDate;
  } else {
    groups.push({
      name: isBreak ? "Career break" : w.name!,
      isBreak,
      location: w.location,
      start: w.startDate,
      end: w.endDate,
      roles: [role],
    });
  }
  return groups;
}, []);

/** Certifications by issuer, the issuer with the most first. */
export const certificateGroups = Object.values(
  resume.certificates.reduce<Record<string, { issuer: string; items: typeof resume.certificates }>>((acc, c) => {
    (acc[c.issuer] ??= { issuer: c.issuer, items: [] }).items.push(c);
    return acc;
  }, {}),
).sort((a, b) => b.items.length - a.items.length);

export const profileParagraphs = resume.basics.summary.split(/\n\n+/);
