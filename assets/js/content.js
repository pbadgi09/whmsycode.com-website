// Small vanilla JS content loader. No build step, no framework, no 3rd-party runtime calls.
// Every page fetches /site.json for shared chrome (nav brand, footer, default support email),
// plus its own JSON where relevant (apps/manifest.json for the homepage, ./content.json for an
// app/legal page). Feature/Why card icons are real uploaded images (see the WHMSYCODE Mac app),
// not a fixed keyword set — rendered as a plain <img> sized via object-fit:contain in CSS.

function iconMarkup(path) {
  if (!path) return "";
  // onerror removes a broken image (e.g. deleted from the repo but still
  // referenced) instead of leaving a broken-image glyph in the icon box —
  // same pattern badgip's own site uses for its social/logo icons.
  return `<img src="${escapeHTML(path)}" alt="" onerror="this.remove()">`;
}

// Content here comes from content.json/apps/manifest.json (edited by hand or
// via the WHMSYCODE Mac app), not visitor input — but it's still arbitrary
// text getting inserted via innerHTML below, so an app description or title
// containing "&", "<", or ">" needs escaping or it silently breaks the
// markup (or worse, injects unintended elements) instead of just displaying
// those characters. Also escapes quotes: iconMarkup() below embeds an
// escaped value inside a src="..." attribute, not just text-node content,
// and a bare textContent/innerHTML round-trip (the previous implementation)
// doesn't escape quote characters — only safe for text nodes, not
// attribute values.
function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function fetchJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el != null && value != null) el.textContent = value;
}

function setHref(id, value) {
  const el = document.getElementById(id);
  if (el != null && value != null) el.setAttribute("href", value);
}

function setSrc(id, value, alt) {
  const el = document.getElementById(id);
  if (el == null || value == null) return;
  el.setAttribute("src", value);
  if (alt != null) el.setAttribute("alt", alt);
}

// The nav's single "Download" CTA has to pick one store link — defaulting
// it to appStoreUrl unconditionally would silently send Android visitors to
// an iOS link. A simple UA check is enough here (this only decides which of
// two already-public store links a button points at, not anything
// security- or correctness-sensitive enough to need a real feature-detection
// library).
function preferredStoreUrl(content) {
  const isAndroid = /Android/i.test(navigator.userAgent || "");
  if (isAndroid && content.googlePlayUrl) return content.googlePlayUrl;
  return content.appStoreUrl;
}

// Creates the <script type="application/ld+json"> tag on first use if the
// page didn't already declare one, rather than requiring every app-page
// template to pre-declare a placeholder — keeps this self-contained here.
function setJSONLD(id, data) {
  let el = document.getElementById(id);
  if (el == null) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

function applySupportEmail(email) {
  if (!email) return;
  document.querySelectorAll("[data-support-email]").forEach((el) => {
    el.setAttribute("href", `mailto:${email}`);
    // A couple of links (the legal pages' "Contact us at <email>" line) show
    // the address itself as the link text, not a generic label like
    // "Support" — those opt in via this second attribute so their visible
    // text stays in sync with the href instead of going stale.
    if (el.hasAttribute("data-support-email-text")) {
      el.textContent = email;
    }
  });
}

// Cached so multiple render* calls on the same page (e.g. renderApp also
// needing site chrome) only fetch site.json once.
let siteSettingsPromise = null;
function fetchSiteSettings() {
  if (siteSettingsPromise == null) {
    siteSettingsPromise = fetchJSON("/site.json").catch((err) => {
      console.error(err);
      return null;
    });
  }
  return siteSettingsPromise;
}

/**
 * Shared chrome every page has: nav brand text, footer copyright text, and
 * the site-wide default support email. Called internally by every page-level
 * render function below before their own page-specific logic runs, so a
 * page-specific override (an app's own supportEmail) always applies after
 * — and wins over — this default.
 */
export async function renderSiteChrome() {
  const site = await fetchSiteSettings();
  if (site == null) return null;
  document.querySelectorAll("[data-nav-brand]").forEach((el) => { el.textContent = site.navBrand; });
  document.querySelectorAll("[data-footer-copyright]").forEach((el) => { el.textContent = site.footerCopyright; });
  applySupportEmail(site.supportEmail);
  return site;
}

/** Homepage: site.json for the hero, /apps/manifest.json for the app-card grid. */
export async function renderHome() {
  const site = await renderSiteChrome();
  if (site != null) {
    setText("hero-eyebrow", site.hero?.eyebrow);
    setText("hero-title-line1", site.hero?.headlineLine1);
    setText("hero-title-line2", site.hero?.headlineLine2);
    setText("hero-subtitle", site.hero?.subtitle);
    setSrc("hero-image", site.heroImage, "WHMSYCODE");
    setText("why-us-title", site.whyUsTitle);

    const whyUsSection = document.getElementById("why-us-section");
    const whyUsGrid = document.getElementById("why-us-grid");
    if (whyUsGrid != null && Array.isArray(site.whyUs)) {
      // An admin deleting every Why-card is a real, supported state (not an
      // error) — hide the whole section rather than leaving a heading with
      // a blank, oddly-empty grid underneath it.
      if (whyUsSection != null) {
        whyUsSection.style.display = site.whyUs.length ? "" : "none";
      }
      whyUsGrid.innerHTML = site.whyUs
        .map(
          (item) => `
          <div class="app-card feature-card reveal">
            <div class="feature-icon" aria-hidden="true">${iconMarkup(item.icon)}</div>
            <h3 class="app-card-title">${escapeHTML(item.title)}</h3>
            <p class="app-card-desc">${escapeHTML(item.description)}</p>
          </div>`
        )
        .join("");
    }
  }

  const grid = document.getElementById("apps-grid");
  if (grid == null) return;
  let apps;
  try {
    apps = await fetchJSON("/apps/manifest.json");
  } catch (err) {
    grid.innerHTML = `<p class="app-grid-error">Couldn't load the apps list right now.</p>`;
    console.error(err);
    return;
  }
  if (apps.length === 0) {
    grid.innerHTML = `<p class="app-grid-error">No apps published yet — check back soon.</p>`;
    return;
  }
  grid.innerHTML = apps
    .map((app) => {
      const slug = encodeURIComponent(app.slug || "");
      const icon = escapeHTML(app.icon || (app.title || "").slice(0, 2).toUpperCase());
      return `
      <a class="app-card reveal" href="/${slug}">
        <div class="app-card-icon" aria-hidden="true">${icon}</div>
        <h3 class="app-card-title">${escapeHTML(app.title)}</h3>
        <p class="app-card-desc">${escapeHTML(app.tagline)}</p>
      </a>`;
    })
    .join("");
}

/** App page (hero + features): fetch ./content.json relative to the current page. */
export async function renderApp() {
  const root = document.body;
  if (root.dataset.page !== "app") return;
  await renderSiteChrome();

  let content;
  try {
    content = await fetchJSON("./content.json");
  } catch (err) {
    console.error(err);
    return;
  }

  setText("hero-eyebrow", content.eyebrow);
  setText("hero-title-line1", content.heroTitleLine1);
  setText("hero-title-line2", content.heroTitleLine2);
  setText("hero-subtitle", content.subtitle);
  setHref("store-apple", content.appStoreUrl);
  setHref("store-google", content.googlePlayUrl);
  setHref("nav-download", preferredStoreUrl(content));
  setSrc("hero-phone-img", content.heroImage, `${content.title} app mockup`);
  setSrc("hero-16x9-img", content.sixteenNineImage, `${content.title} screenshot`);

  // Only overrides the site-wide default (already applied by
  // renderSiteChrome above) when this app genuinely sets its own.
  applySupportEmail(content.supportEmail);

  setJSONLD("app-jsonld", {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: content.title,
    description: content.subtitle,
    applicationCategory: "MobileApplication",
    operatingSystem: "iOS, Android",
    url: window.location.href,
  });

  const featuresSection = document.getElementById("features-section");
  const featureGrid = document.getElementById("features-grid");
  if (featureGrid != null && Array.isArray(content.features)) {
    // Same reasoning as the homepage's Why-section: zero features is a
    // real, supported state, not an error — hide the section instead of
    // leaving "What it does" with a blank grid underneath it.
    if (featuresSection != null) {
      featuresSection.style.display = content.features.length ? "" : "none";
    }
    featureGrid.innerHTML = content.features
      .map(
        (f) => `
        <div class="app-card feature-card reveal">
          <div class="feature-icon" aria-hidden="true">${iconMarkup(f.icon)}</div>
          <h3 class="app-card-title">${escapeHTML(f.title)}</h3>
          <p class="app-card-desc">${escapeHTML(f.description)}</p>
        </div>`
      )
      .join("");
  }
}

/** Legal pages (terms/privacy): fetch ./content.json and render the matching section. */
export async function renderLegal(kind) {
  await renderSiteChrome();

  const container = document.getElementById("legal-sections");
  if (container == null) return;
  let content;
  try {
    content = await fetchJSON("./content.json");
  } catch (err) {
    container.innerHTML = `<p>Couldn't load this page's content right now.</p>`;
    console.error(err);
    return;
  }
  const data = content[kind];
  if (data != null) {
    setText("legal-updated", `Last updated: ${data.updated}`);
    container.innerHTML = (data.sections || [])
      .map((s) => `<h2>${escapeHTML(s.heading)}</h2><p>${escapeHTML(s.body)}</p>`)
      .join("");
  }

  applySupportEmail(content.supportEmail);
}
