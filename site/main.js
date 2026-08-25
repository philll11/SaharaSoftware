(function () {
  "use strict";

  // ------------------------------------------------------------- theme
  var toggles = document.querySelectorAll("[data-theme-choice]");

  function currentChoice() {
    try {
      var t = localStorage.getItem("theme");
      return t === "light" || t === "dark" ? t : "system";
    } catch (e) {
      return "system";
    }
  }

  function applyChoice(choice) {
    if (choice === "light" || choice === "dark") {
      document.documentElement.setAttribute("data-theme", choice);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    try {
      if (choice === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", choice);
    } catch (e) { /* per-visitor convenience only */ }
    toggles.forEach(function (btn) {
      var active = btn.getAttribute("data-theme-choice") === choice;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
  }

  toggles.forEach(function (btn) {
    btn.addEventListener("click", function () {
      applyChoice(btn.getAttribute("data-theme-choice"));
    });
  });
  applyChoice(currentChoice());

  // ------------------------------------------------------------ burger
  var header = document.querySelector(".site-header");
  var burger = document.querySelector(".nav-burger");
  if (header && burger) {
    burger.addEventListener("click", function () {
      var open = header.classList.toggle("nav-open");
      burger.setAttribute("aria-expanded", String(open));
    });
    document.querySelectorAll(".site-nav a").forEach(function (link) {
      link.addEventListener("click", function () {
        header.classList.remove("nav-open");
        burger.setAttribute("aria-expanded", "false");
      });
    });
  }

  // ------------------------------------------------------ contact form
  // The site is static, so there is no same-origin endpoint to post to. The
  // relay is a Cloudflare Worker (see ../contact-worker/), which holds the
  // Resend key, rate-limits and checks Origin. Changing this URL means changing
  // connect-src in index.html's CSP to match, or the request is blocked.
  var CONTACT_ENDPOINT = "https://sahara-contact.saharasoftware.workers.dev/";

  var form = document.getElementById("contact-form");
  if (!form) return;
  var status = form.querySelector(".form-status");
  var submit = form.querySelector("button[type=submit]");

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    status.textContent = "";
    status.classList.remove("error");

    var data = {
      name: form.elements.name.value.trim(),
      email: form.elements.email.value.trim(),
      message: form.elements.message.value.trim(),
      website: form.elements.website.value
    };
    if (!data.name || !data.email || !data.message || data.email.indexOf("@") < 1) {
      status.classList.add("error");
      status.textContent = "Please fill in your name, a valid email address and a message.";
      return;
    }

    submit.disabled = true;
    submit.textContent = "Sending…";

    fetch(CONTACT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    })
      .then(function (res) {
        if (!res.ok) throw new Error("send failed");
        form.querySelector(".form-grid").hidden = true;
        form.querySelectorAll(".field").forEach(function (f) { f.hidden = true; });
        submit.hidden = true;
        status.textContent = "Thanks — your message is on its way. I'll get back to you soon.";
      })
      .catch(function () {
        status.classList.add("error");
        status.textContent = "Sorry — the message could not be sent right now. Please email info@saharasoftware.co.nz instead.";
        submit.disabled = false;
        submit.textContent = "Send message";
      });
  });
})();
