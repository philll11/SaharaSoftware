// Contact relay for saharasoftware.co.nz.
//
// The site is static (GitHub Pages), so the form has no same-origin endpoint.
// This Worker is the only piece with a Resend key; it validates, rate-limits
// and relays. It stores nothing.
//
// Field caps and the honeypot behaviour here are load-bearing and should be
// re-read together with the CSP in site/index.html whenever the form changes.

const ALLOWED_ORIGIN = "https://www.saharasoftware.co.nz";
const MAX_BODY_BYTES = 32 * 1024;

const CORS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin"
};

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" }
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");

    if (request.method === "OPTIONS") {
      return origin === ALLOWED_ORIGIN
        ? new Response(null, { status: 204, headers: CORS })
        : new Response(null, { status: 403 });
    }

    if (request.method !== "POST") {
      return json(405, { ok: false, error: "POST only." });
    }

    // The browser sets Origin on cross-origin POSTs and page script cannot
    // forge it. Same-origin protection used to come free from the server; this
    // header is what replaces it.
    if (origin !== ALLOWED_ORIGIN) {
      return json(403, { ok: false, error: "Forbidden." });
    }

    if (Number(request.headers.get("Content-Length") || 0) > MAX_BODY_BYTES) {
      return json(413, { ok: false, error: "Message too large." });
    }

    // CF-Connecting-IP is set by Cloudflare's edge and cannot be spoofed by the
    // caller, so one client cannot spread its requests across keys.
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const { success } = await env.CONTACT_LIMIT.limit({ key: ip });
    if (!success) {
      return json(429, { ok: false, error: "Too many messages — please try again later." });
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return json(400, { ok: false, error: "Invalid request." });
    }

    const name = String(data.name || "").trim().slice(0, 200);
    const email = String(data.email || "").trim().slice(0, 320);
    const message = String(data.message || "").trim().slice(0, 5000);
    const honeypot = String(data.website || "");

    if (honeypot) return json(200, { ok: true }); // bot: pretend success
    if (!name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json(400, { ok: false, error: "Name, a valid email and a message are required." });
    }

    const mail = {
      from: env.MAIL_FROM,
      to: [env.CONTACT_TO],
      reply_to: email,
      subject: `Website contact from ${name}`,
      text: `From: ${name} <${email}>\n\n${message}\n`
    };

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(mail)
      });
      if (!res.ok) {
        console.error(`[contact] relay refused: ${res.status} ${await res.text()}`);
        return json(502, { ok: false, error: "Could not send right now." });
      }
      console.log(`[contact] delivered message from ${email}`);
      return json(200, { ok: true });
    } catch (err) {
      console.error(`[contact] relay unreachable: ${err.message}`);
      return json(502, { ok: false, error: "Could not send right now." });
    }
  }
};
