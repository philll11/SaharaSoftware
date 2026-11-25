// Site-wide constants shared by the Astro config (CSP, sitemap) and the pages.

export const SITE_URL = "https://www.saharasoftware.co.nz";

// The contact relay (see ../contact-worker/). The CSP's connect-src is built
// from this value, so the form and the policy cannot drift apart.
export const CONTACT_ENDPOINT = "https://sahara-contact.saharasoftware.workers.dev/";

export const EMAIL = "leonard@saharasoftware.co.nz";
export const LINKEDIN_URL = "https://www.linkedin.com/in/leonard-phillips";
export const GITHUB_URL = "https://github.com/philll11";

// A public CV under public/, such as "/leonard-phillips-cv.pdf". The
// Experience page offers a download only when this is set.
export const CV_URL: string | null = null;

export const PERSON = "Leonard Phillips";
export const BUSINESS = "Sahara Software";
