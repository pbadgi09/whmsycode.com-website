// Small vanilla JS content loader. No build step, no framework, no 3rd-party runtime calls.
// Every page fetches /site.json for shared chrome (nav brand, footer, default support email),
// plus its own JSON where relevant (apps/manifest.json for the homepage, ./content.json for an
// app/legal page). Icons are hand-written inline SVGs (stroke/fill="currentColor") kept
// centrally here so every page (and any future app page) can reuse the same set.

const ICONS = {
  trim: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>',
  compress: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
  device: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5 3.4 8.7 8 11 4.6-2.3 8-6 8-11V5z"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/></svg>'
};

export function iconMarkup(name) {
  return ICONS[name] || ICONS.spark;
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

function applySupportEmail(email) {
  if (!email) return;
  document.querySelectorAll("[data-support-email]").forEach((el) => {
    el.setAttribute("href", `mailto:${email}`);
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
  grid.innerHTML = apps
    .map(
      (app) => `
      <a class="app-card" href="/${app.slug}">
        <div class="app-card-icon">${app.icon || app.title.slice(0, 2).toUpperCase()}</div>
        <h3 class="app-card-title">${app.title}</h3>
        <p class="app-card-desc">${app.tagline}</p>
      </a>`
    )
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
  setHref("nav-download", content.appStoreUrl);
  setSrc("hero-phone-img", content.heroImage, `${content.title} app mockup`);
  setSrc("hero-16x9-img", content.sixteenNineImage, `${content.title} screenshot`);

  // Only overrides the site-wide default (already applied by
  // renderSiteChrome above) when this app genuinely sets its own.
  applySupportEmail(content.supportEmail);

  const featureGrid = document.getElementById("features-grid");
  if (featureGrid != null && Array.isArray(content.features)) {
    featureGrid.innerHTML = content.features
      .map(
        (f) => `
        <div class="app-card feature-card">
          <div class="feature-icon">${iconMarkup(f.icon)}</div>
          <h3 class="app-card-title">${f.title}</h3>
          <p class="app-card-desc">${f.description}</p>
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
      .map((s) => `<h2>${s.heading}</h2><p>${s.body}</p>`)
      .join("");
  }

  applySupportEmail(content.supportEmail);
}
