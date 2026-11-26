// Site-wide constants shared by the Astro config (CSP, sitemap) and the pages.
import resume from "./data/resume.json" with { type: "json" };

export const SITE_URL = "https://www.saharasoftware.co.nz";

// The contact relay (see ../contact-worker/). The CSP's connect-src is built
// from this value, so the form and the policy cannot drift apart.
export const CONTACT_ENDPOINT = "https://sahara-contact.saharasoftware.workers.dev/";

// Read from the resume data, so the site and the resume give the same details.
const profile = (network: string) => resume.basics.profiles.find((p) => p.network === network)!.url;
export const EMAIL = resume.basics.email;
export const LINKEDIN_URL = profile("LinkedIn");
export const GITHUB_URL = profile("GitHub");
export const PERSON = resume.basics.name;
export const BUSINESS = resume.basics.custom.business;

// The public resume, which scripts/print-resume.mjs writes into dist/ on every
// build. The link test fails if the file is missing.
export const RESUME_URL = "/leonard-phillips-resume.pdf";
