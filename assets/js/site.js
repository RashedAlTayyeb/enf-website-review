(function () {
  if (window.__ENF_APP_BOOTED__) {
    return;
  }
  window.__ENF_APP_BOOTED__ = true;

  var content = window.ENF_CONTENT;
  if (!content) {
    console.error("ENF content bundle is missing.");
    return;
  }

  var page = document.body.dataset.page || "home";
  var rootPrefix = document.body.dataset.rootPrefix || "";
  var root = document.getElementById("page-root");
  var headerRoot = document.getElementById("site-header");
  var footerRoot = document.getElementById("site-footer");

  if (!root || !headerRoot || !footerRoot) {
    console.error("Page layout containers are missing.");
    return;
  }

  applyStoredContentOverrides();

  var currentYear = new Date().getFullYear();

  function ensureProtocol(url) {
    var value = url || "";
    if (!value) return "";
    if (/^(https?:|mailto:|tel:|#)/i.test(value)) return value;
    if (value.indexOf("www.") === 0) return "https://" + value;
    return value;
  }

  function withRoot(path) {
    var value = path || "";
    if (!value) return rootPrefix || "./";
    if (/^(https?:|mailto:|tel:|#)/i.test(value)) return value;
    return rootPrefix + String(value).replace(/^\/+/, "");
  }

  function sanitizeText(text) {
    return String(text || "")
      .replace(/&nbsp;/g, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function truncate(text, length) {
    var value = String(text || "");
    if (!value) return "";
    if (value.length <= length) return value;
    return value.slice(0, length).trim() + "...";
  }

  function escapeHtml(text) {
    return String(text || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatJod(amount) {
    var value = Number(amount || 0);
    return "JOD " + value.toFixed(2);
  }

  function parseAmount(value) {
    var parsed = Number(value || 0);
    if (Number.isNaN(parsed) || !Number.isFinite(parsed)) return 0;
    return parsed;
  }

  function decadeFromYear(yearValue) {
    var numeric = Number(String(yearValue || "").replace(/[^\d]/g, ""));
    if (!numeric) return "unknown";
    return String(Math.floor(numeric / 10) * 10);
  }

  function getApiBaseUrl() {
    var runtimeConfig = window.ENF_RUNTIME_CONFIG || {};
    var bodyBase = document.body.getAttribute("data-api-base") || "";
    var value = runtimeConfig.apiBaseUrl || bodyBase || "/api/v1";
    var normalized = String(value).replace(/\/+$/, "");
    if (/^https?:\/\//i.test(normalized)) return normalized;

    var host = window.location.hostname || "";
    var port = window.location.port || "";
    var isLocalHost = host === "127.0.0.1" || host === "localhost";
    var isLikelyStaticPreview = /^55\d\d$/.test(port);
    if (isLocalHost && isLikelyStaticPreview && normalized.indexOf("/") === 0) {
      return "http://127.0.0.1:8000" + normalized;
    }
    return normalized;
  }

  function getRuntimeConfig() {
    return window.ENF_RUNTIME_CONFIG || {};
  }

  function getQueryParams() {
    try {
      return new URLSearchParams(window.location.search || "");
    } catch (error) {
      return new URLSearchParams();
    }
  }

  function getDonorSession() {
    try {
      var raw = window.localStorage.getItem("enfDonorSession");
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.token) return null;
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function setDonorSession(session) {
    if (!session || !session.token) return;
    try {
      window.localStorage.setItem("enfDonorSession", JSON.stringify(session));
    } catch (error) {
      // no-op for privacy mode storage restrictions
    }
  }

  function clearDonorSession() {
    try {
      window.localStorage.removeItem("enfDonorSession");
    } catch (error) {
      // no-op
    }
  }

  function getAdminSession() {
    try {
      var raw = window.localStorage.getItem("enfAdminSession");
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.token) return null;
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function hasSiteEntered() {
    try {
      return window.localStorage.getItem("enfSiteEntered") === "1";
    } catch (error) {
      return false;
    }
  }

  function markSiteEntered() {
    try {
      window.localStorage.setItem("enfSiteEntered", "1");
    } catch (error) {
      // no-op
    }
  }

  function contentPathParts(path) {
    return String(path || "")
      .split(".")
      .map(function (part) {
        return part.trim();
      })
      .filter(Boolean);
  }

  function getContentAtPath(source, path) {
    var cursor = source;
    var parts = contentPathParts(path);
    for (var i = 0; i < parts.length; i += 1) {
      if (cursor == null || typeof cursor !== "object") return null;
      cursor = cursor[parts[i]];
    }
    return cursor == null ? null : cursor;
  }

  function setContentAtPath(source, path, value) {
    var parts = contentPathParts(path);
    if (!parts.length) return;
    var cursor = source;
    for (var i = 0; i < parts.length - 1; i += 1) {
      var key = parts[i];
      if (!cursor[key] || typeof cursor[key] !== "object") {
        cursor[key] = {};
      }
      cursor = cursor[key];
    }
    cursor[parts[parts.length - 1]] = value;
  }

  function getStoredContentOverrides() {
    try {
      var raw = window.localStorage.getItem("enfContentOverrides");
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function setStoredContentOverrides(overrides) {
    try {
      window.localStorage.setItem("enfContentOverrides", JSON.stringify(overrides || {}));
    } catch (error) {
      // no-op
    }
  }

  function applyStoredContentOverrides() {
    var overrides = getStoredContentOverrides();
    Object.keys(overrides).forEach(function (sectionKey) {
      setContentAtPath(content, sectionKey, overrides[sectionKey]);
    });
  }

  function updateContentOverride(sectionKey, payload) {
    if (!sectionKey) return;
    setContentAtPath(content, sectionKey, payload);
    var overrides = getStoredContentOverrides();
    overrides[sectionKey] = payload;
    setStoredContentOverrides(overrides);
  }

  function getPreviewDraftMap() {
    try {
      var raw = window.sessionStorage.getItem("enfAdminPreviewDraft");
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function setPreviewDraftMap(value) {
    try {
      window.sessionStorage.setItem("enfAdminPreviewDraft", JSON.stringify(value || {}));
    } catch (error) {
      // no-op
    }
  }

  function setAdminSession(session) {
    if (!session || !session.token) return;
    try {
      window.localStorage.setItem("enfAdminSession", JSON.stringify(session));
    } catch (error) {
      // no-op
    }
  }

  function clearAdminSession() {
    try {
      window.localStorage.removeItem("enfAdminSession");
    } catch (error) {
      // no-op
    }
  }

  function makeSessionToken(prefix) {
    return (
      prefix +
      "_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 10)
    );
  }

  function isConnectionFailure(message) {
    var text = String(message || "").toLowerCase();
    return (
      text.indexOf("failed to fetch") !== -1 ||
      text.indexOf("load failed") !== -1 ||
      text.indexOf("request failed") !== -1 ||
      text.indexOf("network") !== -1 ||
      text.indexOf("404") !== -1
    );
  }

  function isLocalPreviewRuntime() {
    var host = window.location.hostname || "";
    var port = window.location.port || "";
    return (host === "127.0.0.1" || host === "localhost") && /^55\d\d$/.test(port);
  }

  function getDemoDonorAccounts() {
    try {
      var raw = window.localStorage.getItem("enfDemoDonorAccounts");
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function setDemoDonorAccounts(accounts) {
    try {
      window.localStorage.setItem("enfDemoDonorAccounts", JSON.stringify(accounts || []));
    } catch (error) {
      // no-op
    }
  }

  function demoCreateDonor(payload) {
    var accounts = getDemoDonorAccounts();
    var email = String(payload.email || "").trim().toLowerCase();
    if (!email) {
      throw new Error("Email is required.");
    }
    var exists = accounts.some(function (item) {
      return String(item.email || "").toLowerCase() === email;
    });
    if (exists) {
      throw new Error("A donor account already exists for this email.");
    }
    var account = {
      email: email,
      first_name: payload.first_name || "",
      last_name: payload.last_name || null,
      phone: payload.phone || null,
      password: payload.password || "",
    };
    accounts.push(account);
    setDemoDonorAccounts(accounts);
    return {
      token: makeSessionToken("donor_demo"),
      profile: {
        email: account.email,
        first_name: account.first_name,
        last_name: account.last_name,
        phone: account.phone,
      },
    };
  }

  function demoSignInDonor(payload) {
    var accounts = getDemoDonorAccounts();
    var email = String(payload.email || "").trim().toLowerCase();
    var password = String(payload.password || "");
    var account = accounts.find(function (item) {
      return String(item.email || "").toLowerCase() === email;
    });
    if (!account || String(account.password || "") !== password) {
      throw new Error("Invalid email or password.");
    }
    return {
      token: makeSessionToken("donor_demo"),
      profile: {
        email: account.email,
        first_name: account.first_name,
        last_name: account.last_name,
        phone: account.phone,
      },
    };
  }

  function initGoogleAnalytics() {
    var runtimeConfig = getRuntimeConfig();
    var measurementId =
      (runtimeConfig.gaMeasurementId || document.body.getAttribute("data-ga-id") || "").trim();
    if (!measurementId) return;
    if (/^G-X+$/i.test(measurementId) || /X{4,}/i.test(measurementId)) {
      return;
    }
    if (!/^G-[A-Z0-9]+$/i.test(measurementId)) {
      console.warn("GA measurement ID format looks invalid:", measurementId);
    }
    if (window.__ENF_GA_BOOTED__) return;
    window.__ENF_GA_BOOTED__ = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", measurementId, {
      page_path: window.location.pathname,
      page_title: document.title,
    });

    var script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(measurementId);
    document.head.appendChild(script);
  }

  function extractYouTubeId(url) {
    var value = String(url || "");
    if (!value) return "";
    var match =
      value.match(/[?&]v=([^&#]+)/i) ||
      value.match(/youtu\.be\/([^?&#/]+)/i) ||
      value.match(/youtube\.com\/embed\/([^?&#/]+)/i);
    return match && match[1] ? match[1] : "";
  }

  function buildYouTubeEmbedUrl(url, options) {
    var id = extractYouTubeId(url);
    if (!id) return "";
    var opts = options || {};
    var autoplay = opts.autoplay ? 1 : 0;
    var mute = opts.mute ? 1 : 0;
    var loop = opts.loop ? 1 : 0;
    var controls = opts.controls === false ? 0 : 1;
    var quality = opts.hd ? "&vq=hd1080" : "";
    return (
      "https://www.youtube-nocookie.com/embed/" +
      id +
      "?autoplay=" +
      autoplay +
      "&mute=" +
      mute +
      "&loop=" +
      loop +
      "&playlist=" +
      id +
      "&controls=" +
      controls +
      "&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&disablekb=1&fs=0&cc_load_policy=0" +
      quality
    );
  }

  function toDrivePreviewUrl(url) {
    var value = ensureProtocol(url || "");
    if (!value) return "";
    var match = value.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
    if (match && match[1]) {
      return "https://drive.google.com/file/d/" + match[1] + "/preview";
    }
    return value;
  }

  function hero(config) {
    var title = config && config.title ? config.title : "";
    var subtitle = config && config.subtitle ? config.subtitle : "";
    var image = config && config.image ? config.image : "";
    var kicker = config && config.kicker ? config.kicker : "Elia Nuqul Foundation";
    var className = config && config.className ? String(config.className) : "";
    var imagePosition = config && config.imagePosition ? String(config.imagePosition) : "";
    var sectionClass = "page-hero" + (className ? " " + className : "");
    var heroBgStyle = "background-image:url('" + image + "')" + (imagePosition ? ";background-position:" + imagePosition : "");

    return (
      '<section class="' + sectionClass + '">' +
      '<div class="page-hero-bg" style="' + heroBgStyle + '"></div>' +
      '<div class="page-hero-content reveal">' +
      '<span class="section-kicker">' + kicker + "</span>" +
      "<h1>" + title + "</h1>" +
      (subtitle ? "<p>" + subtitle + "</p>" : "") +
      "</div>" +
      "</section>"
    );
  }

  function renderHeader() {
    var navLinks = (content.navigation || [])
      .map(function (item) {
        var active = item.id === page ? "is-active" : "";
        return '<a class="' + active + '" href="' + withRoot(item.href) + '">' + item.label + "</a>";
      })
      .join("");

    var isHomePage = page === "home";
    var contactStrip = "";
    if (isHomePage) {
      var emailIcon =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 6.8A2.8 2.8 0 0 1 5.8 4h12.4A2.8 2.8 0 0 1 21 6.8v10.4a2.8 2.8 0 0 1-2.8 2.8H5.8A2.8 2.8 0 0 1 3 17.2V6.8Zm2.2-.2 6.8 5.12 6.8-5.12H5.2Zm13.6 11.2V8.58l-6.14 4.62a1.1 1.1 0 0 1-1.32 0L5.2 8.58v9.22h13.6Z"/></svg>';
      var phoneIcon =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7.7 3.2a2.2 2.2 0 0 1 2.68-.93l2.08.83a2.2 2.2 0 0 1 1.3 2.57l-.45 2a1.7 1.7 0 0 1-1.7 1.33l-1.1-.03a13.14 13.14 0 0 0 4.52 4.52l-.03-1.1a1.7 1.7 0 0 1 1.33-1.7l2-.45a2.2 2.2 0 0 1 2.57 1.3l.83 2.08a2.2 2.2 0 0 1-.93 2.68l-1.18.7a4.3 4.3 0 0 1-4.3.1c-2.3-1.17-4.87-3.74-6.04-6.04a4.3 4.3 0 0 1 .1-4.3l.7-1.18Z"/></svg>';
      contactStrip =
        '<div class="header-top">' +
      '<div class="container header-top-wrap">' +
      '<div class="header-auth-switch" role="group" aria-label="Account actions">' +
      '<a href="' + withRoot("pages/donor-account.html?mode=signin") + '">Sign In</a>' +
      '<a href="' + withRoot("pages/donor-account.html?mode=signup") + '">Sign Up</a>' +
      "</div>" +
      '<a class="header-contact-pill" href="mailto:' +
      content.contact.email +
      '">' +
        '<span class="header-contact-icon" aria-hidden="true">' +
        emailIcon +
        "</span>" +
        '<span>' +
        content.contact.email +
        "</span>" +
        "</a>" +
        '<a class="header-contact-pill" href="tel:' +
        content.contact.phone1 +
        '">' +
        '<span class="header-contact-icon" aria-hidden="true">' +
        phoneIcon +
        "</span>" +
        '<span>' +
        content.contact.phone1 +
        "</span>" +
        "</a>" +
        "</div>" +
        "</div>";
    }

    headerRoot.innerHTML =
      '<header class="site-header">' +
      '<div class="scroll-progress" id="scroll-progress"></div>' +
      contactStrip +
      '<div class="container site-header-wrap">' +
      '<a class="site-brand" href="' + withRoot("index.html") + '" aria-label="' + escapeHtml(content.branding.siteName) + '">' +
      '<img src="' + content.branding.headerLogo + '" alt="' + escapeHtml(content.branding.siteName) + '">' +
      "</a>" +
      '<nav class="site-nav" aria-label="Main navigation">' + navLinks + "</nav>" +
      '<div class="header-actions">' +
      '<a class="btn btn-primary header-donate-btn" href="' + withRoot("pages/donate-now.html") + '">Donate Now</a>' +
      '<button class="menu-toggle" type="button" aria-label="Toggle menu" data-menu-toggle>☰</button>' +
      "</div>" +
      "</div>" +
      '<div class="mobile-panel" data-mobile-panel>' +
      '<div class="container">' +
      '<nav aria-label="Mobile navigation">' +
      navLinks +
      '<a class="btn btn-ghost" href="' + withRoot("pages/donor-account.html?mode=signin") + '">Sign In</a>' +
      '<a class="btn btn-ghost" href="' + withRoot("pages/donor-account.html?mode=signup") + '">Sign Up</a>' +
      '<a class="btn btn-primary" href="' + withRoot("pages/donate-now.html") + '">Donate Now</a>' +
      "</nav>" +
      "</div>" +
      "</div>" +
      "</header>";

    var toggle = headerRoot.querySelector("[data-menu-toggle]");
    var panel = headerRoot.querySelector("[data-mobile-panel]");
    if (toggle && panel) {
      toggle.addEventListener("click", function () {
        panel.classList.toggle("is-open");
      });
    }
  }

  function renderFooter() {
    function socialIconSvg(iconName) {
      var name = String(iconName || "").toLowerCase();
      if (name === "facebook") {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.2 21v-7.02h2.36l.35-2.74h-2.71V9.5c0-.8.23-1.34 1.37-1.34H16V5.71c-.24-.03-1.05-.1-2-.1-1.97 0-3.31 1.2-3.31 3.43v2.2H8.47v2.74h2.22V21h2.5Z"/></svg>';
      }
      if (name === "twitter" || name === "x") {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m4 4 6.56 8.76L4.4 20h2.06l5.02-5.9L15.9 20H20l-6.9-9.2L18.8 4h-2.06l-4.55 5.35L8.13 4H4Z"/></svg>';
      }
      if (name === "youtube") {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.6 8.2a2.97 2.97 0 0 0-2.1-2.1C17.7 5.6 12 5.6 12 5.6s-5.7 0-7.5.5a2.97 2.97 0 0 0-2.1 2.1A31.1 31.1 0 0 0 1.9 12c0 1.3.2 2.6.5 3.8a2.97 2.97 0 0 0 2.1 2.1c1.8.5 7.5.5 7.5.5s5.7 0 7.5-.5a2.97 2.97 0 0 0 2.1-2.1c.3-1.2.5-2.5.5-3.8s-.2-2.6-.5-3.8ZM10.2 15.1V8.9l5.4 3.1-5.4 3.1Z"/></svg>';
      }
      if (name === "instagram") {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Zm0 2.2A2.8 2.8 0 0 0 4.2 7v10A2.8 2.8 0 0 0 7 19.8h10a2.8 2.8 0 0 0 2.8-2.8V7A2.8 2.8 0 0 0 17 4.2H7Zm5 2.9a4.9 4.9 0 1 1 0 9.8 4.9 4.9 0 0 1 0-9.8Zm0 2.2a2.7 2.7 0 1 0 0 5.4 2.7 2.7 0 0 0 0-5.4Zm5.1-3.2a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z"/></svg>';
      }
      if (name === "linkedin") {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M5.1 8.5H2.3V21h2.8V8.5Zm.2-3.9a1.7 1.7 0 1 0-3.4 0 1.7 1.7 0 0 0 3.4 0ZM9.2 21h2.8v-6.2c0-1.6.3-3.1 2.2-3.1 1.9 0 1.9 1.8 1.9 3.2V21h2.8v-6.7c0-3.3-.7-5.8-4.5-5.8-1.8 0-3 .9-3.5 1.8h-.1V8.5H9.2V21Z"/></svg>';
      }
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
    }

    var links = (content.navigation || [])
      .map(function (item) {
        return '<a href="' + withRoot(item.href) + '">' + item.label + "</a>";
      })
      .join("");

    var social = (content.contact.social || [])
      .map(function (item) {
        var iconKey = String(item.icon || item.label || "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
        var platformClass = iconKey ? " social-icon--" + iconKey : "";
        return (
          '<a class="social-icon-btn' +
          platformClass +
          '" href="' +
          ensureProtocol(item.url) +
          '" target="_blank" rel="noopener noreferrer" aria-label="' +
          escapeHtml(item.label) +
          '" title="' +
          escapeHtml(item.label) +
          '">' +
          socialIconSvg(item.icon || item.label) +
          "</a>"
        );
      })
      .join("");

    footerRoot.innerHTML =
      '<footer class="site-footer">' +
      '<div class="container site-footer-wrap">' +
      '<div class="footer-top reveal">' +
      '<a class="footer-brand" href="' + withRoot("index.html") + '">' +
      '<img class="footer-logo" src="' + content.branding.footerLogo + '" alt="' + escapeHtml(content.branding.siteName) + '">' +
      "</a>" +
      '<div class="footer-social">' + social + "</div>" +
      "</div>" +
      '<div class="footer-grid reveal">' +
      "<div>" +
      '<h4 class="section-title" style="font-size:1.1rem">Explore</h4>' +
      '<div class="footer-links mt-sm">' + links + "</div>" +
      "</div>" +
      "<div>" +
      '<h4 class="section-title" style="font-size:1.1rem">Get Involved</h4>' +
      '<div class="footer-links mt-sm">' +
      '<a href="' + withRoot("pages/donate-now.html") + '">Donate Now</a>' +
      '<a href="' + withRoot("pages/donor-account.html") + '">Donor Account</a>' +
      '<a href="' + withRoot("pages/donation-education-program.html") + '">Donation for Education Program</a>' +
      '<a href="' + withRoot("pages/subscription-support.html") + '">Subscription Support</a>' +
      "</div>" +
      "</div>" +
      "<div>" +
      '<h4 class="section-title" style="font-size:1.1rem">Contact</h4>' +
      '<div class="contact-list mt-sm">' +
      '<p class="contact-row"><span class="contact-badge">📍</span><span>' + content.contact.address + "</span></p>" +
      '<p class="contact-row"><span class="contact-badge">☎</span><a href="tel:' + content.contact.phone1 + '">' + content.contact.phone1 + "</a></p>" +
      '<p class="contact-row"><span class="contact-badge">☎</span><a href="tel:' + content.contact.phone2 + '">' + content.contact.phone2 + "</a></p>" +
      '<p class="contact-row"><span class="contact-badge">✉</span><a href="mailto:' + content.contact.email + '">' + content.contact.email + "</a></p>" +
      "</div>" +
      "</div>" +
      "</div>" +
      '<div class="footer-copy reveal">© ' + currentYear + '. All rights reserved. Elia Nuqul Foundation. <a class="footer-admin-link" href="' +
      withRoot("pages/admin.html") +
      '">Admin</a></div>' +
      "</div>" +
      "</footer>";
  }

  function renderHome() {
    var slides = content.home.sliders || [];
    var programs = (content.whatWeDo.programs || []).slice(0, 4);
    var newsItems = (content.mediaCenter.news || []).slice(0, 3);
    var stories = (content.impact.stories || []).slice(0, 3);
    var logos = content.home.partners.logos || [];
    var doubledLogos = logos.concat(logos);
    var previewVideoUrl = buildYouTubeEmbedUrl(content.home.ourStory.videoUrl, {
      autoplay: true,
      mute: true,
      loop: true,
      controls: false,
    });

    var stats = [
      { value: (content.partners.institutional || []).length, label: "Institutional Donors" },
      { value: (content.whatWeDo.programs || []).length, label: "Core Programs" },
      { value: (content.impact.stories || []).length, label: "Impact Stories" },
      { value: (content.ourStory.timeline || []).length, label: "Historical Milestones" },
    ];

    root.innerHTML =
      '<section class="hero-slider">' +
      slides
        .map(function (slide, index) {
          return (
            '<article class="hero-slide ' + (index === 0 ? "is-active" : "") + '" data-hero-slide>' +
            '<div class="hero-slide-bg" style="background-image:url(\'' + slide.image + '\')"></div>' +
            '<div class="hero-slide-content reveal">' +
            '<span class="section-kicker">Community Impact</span>' +
            "<h1>" + (slide.heading || "") + "</h1>" +
            "</div>" +
            "</article>"
          );
        })
        .join("") +
      '<div class="hero-slider-controls">' +
      slides
        .map(function (_, index) {
          return '<button class="hero-dot ' + (index === 0 ? "is-active" : "") + '" data-hero-dot="' + index + '" aria-label="Go to slide ' + (index + 1) + '"></button>';
        })
        .join("") +
      "</div>" +
      "</section>" +

      '<section class="section-space" style="padding-bottom:0">' +
      '<div class="container stat-grid">' +
      stats
        .map(function (item) {
          return (
            '<article class="stat-card reveal">' +
            '<h3 class="stat-number" data-count="' + item.value + '">0</h3>' +
            '<p class="stat-label">' + item.label + "</p>" +
            "</article>"
          );
        })
        .join("") +
      "</div>" +
      "</section>" +

      '<section class="section-space">' +
      '<div class="container who-layout">' +
      '<div class="reveal">' +
      '<span class="section-kicker">ENF</span>' +
      '<h2 class="section-title">' + content.home.whoWeAre.heading + "</h2>" +
      '<p class="section-subtitle">' + content.home.whoWeAre.subText + "</p>" +
      '<a class="btn btn-primary mt-md" href="' + withRoot("pages/who-we-are.html") + '">' + (content.home.whoWeAre.buttonText || "Read More") + "</a>" +
      "</div>" +
      '<div class="who-photos reveal">' +
      (content.home.whoWeAre.images || [])
        .map(function (photo) {
          return '<div class="photo"><img src="' + photo + '" alt="Who we are"></div>';
        })
        .join("") +
      "</div>" +
      "</div>" +
      "</section>" +

      '<section class="section-space" style="padding-top:0">' +
      '<div class="container story-preview surface-card story-preview-home" style="padding:1rem">' +
      '<div class="video-thumb reveal story-video-wrap">' +
      (previewVideoUrl
        ? '<iframe class="story-video-preview" src="' +
          previewVideoUrl +
          '" title="ENF story preview" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>'
        : '<img src="' + content.home.ourStory.thumbnail + '" alt="Our story video thumbnail">') +
      '<button class="video-overlay-btn" type="button" data-open-story-video>Watch Story</button>' +
      "</div>" +
      '<div class="reveal">' +
      '<span class="section-kicker">Journey</span>' +
      '<h2 class="section-title">' + content.home.ourStory.heading + "</h2>" +
      '<div class="rich-copy mt-sm">' + (content.home.ourStory.descriptionHtml || "") + "</div>" +
      '<a class="btn btn-secondary mt-md" href="' + withRoot("pages/our-story.html") + '">Explore Timeline</a>' +
      "</div>" +
      "</div>" +
      '<div class="home-video-modal" id="home-video-modal" aria-hidden="true">' +
      '<div class="home-video-modal-card">' +
      '<button class="home-video-close" type="button" data-home-video-close aria-label="Close video">Close ×</button>' +
      '<iframe id="home-video-frame" title="ENF story video" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>' +
      "</div>" +
      "</div>" +
      "</section>" +

      '<section class="section-space home-programs-section">' +
      '<div class="container">' +
      '<span class="section-kicker">What We Do</span>' +
      '<h2 class="section-title">Empowering Scholars Through Holistic Programs</h2>' +
      '<div class="grid grid-2 mt-md home-program-grid">' +
      programs
        .map(function (program) {
          return (
            '<a class="card reveal card-interactive home-program-card" href="' +
            withRoot("pages/what-we-do.html") +
            '">' +
            '<div class="card-media home-program-media"><img src="' + program.image + '" alt="' + escapeHtml(program.title) + '"></div>' +
            '<h3>' + program.title + "</h3>" +
            '<p class="home-program-excerpt">' + truncate(program.excerpt, 108) + "</p>" +
            '<span class="card-link home-card-link">Read Program</span>' +
            "</a>"
          );
        })
        .join("") +
      "</div>" +
      "</div>" +
      "</section>" +

      '<section class="section-space home-news-section" style="padding-top:0">' +
      '<div class="container home-news-surface">' +
      '<div class="home-news-bg" style="background-image:url(\'' + content.banners.mediaCenter + '\')"></div>' +
      '<div class="home-news-inner">' +
      '<h2 class="section-title">News</h2>' +
      '<div class="grid grid-3 mt-md">' +
      newsItems
        .map(function (news) {
          return (
            '<a class="home-news-card reveal" href="' +
            withRoot("pages/media-center.html") +
            '">' +
            '<div class="home-news-thumb"><img src="' + news.image + '" alt="' + escapeHtml(news.title) + '"></div>' +
            "<h3>" + news.title + "</h3>" +
            '<p class="home-news-excerpt">' + truncate(news.excerpt, 85) + "</p>" +
            '<span class="card-link">Read More</span>' +
            "</a>"
          );
        })
        .join("") +
      "</div>" +
      "</div>" +
      "</div>" +
      "</section>" +

      '<section class="section-space" style="padding-top:0">' +
      '<div class="container">' +
      '<span class="section-kicker">Our Impact</span>' +
      '<h2 class="section-title">Stories of Real Transformation</h2>' +
      '<div class="grid grid-3 mt-md">' +
      stories
        .map(function (story) {
          return (
            '<article class="card reveal">' +
            '<div class="card-media"><img src="' + story.image + '" alt="' + escapeHtml(story.title) + '"></div>' +
            '<h3>' + story.title + "</h3>" +
            '<p>' + (story.designation || "ENF Fellow") + "</p>" +
            '<a class="card-link" href="' + withRoot("pages/our-impact.html") + '">Read Story</a>' +
            "</article>"
          );
        })
        .join("") +
      "</div>" +
      "</div>" +
      "</section>" +

      '<section class="section-space" style="padding-top:0">' +
      '<div class="container surface-card home-partners-surface" style="padding:1rem 1rem 1.25rem">' +
      '<div class="reveal">' +
      '<span class="section-kicker">' + content.home.partners.subTitle + "</span>" +
      '<h2 class="section-title">' +
      content.home.partners.heading +
      ' <span class="text-accent">' +
      content.home.partners.accent +
      "</span> " +
      content.home.partners.tail +
      "</h2>" +
      "</div>" +
      '<div class="logo-marquee mt-md reveal">' +
      '<div class="logo-track">' +
      doubledLogos
        .map(function (logo) {
          return '<div class="logo-pill"><img src="' + logo + '" alt="Partner logo"></div>';
        })
        .join("") +
      "</div>" +
      "</div>" +
      '<div class="mt-md reveal" style="display:flex;gap:0.65rem;flex-wrap:wrap">' +
      '<a class="btn btn-primary" href="' + withRoot("pages/donate-now.html") + '">Donate Now</a>' +
      '<a class="btn btn-ghost" href="' + withRoot("pages/partners.html") + '">View Partners</a>' +
      "</div>" +
      "</div>" +
      "</section>";

    initHeroSlider();
    initCounterAnimations();
    initHomeVideoModal(content.home.ourStory.videoUrl);
  }

  function renderWhoWeArePage() {
    var sections = content.whoWeAre.sections || [];
    var heroImage = content.banners.whoWeAre || (sections[0] && (sections[0].frontImage || sections[0].backImage)) || "";
    var whoIconMap = {
      Overview: {
        inactive: withRoot("assets/icons/who-tabs/overview-inactive.svg"),
        active: withRoot("assets/icons/who-tabs/overview-active.svg"),
      },
      "What Drives Us": {
        inactive: withRoot("assets/icons/who-tabs/what-drives-us-inactive.svg"),
        active: withRoot("assets/icons/who-tabs/what-drives-us-active.svg"),
      },
      "What Guides Us": {
        inactive: withRoot("assets/icons/who-tabs/what-guides-us-inactive.svg"),
        active: withRoot("assets/icons/who-tabs/what-guides-us-active.svg"),
      },
      "Our Approach": {
        inactive: withRoot("assets/icons/who-tabs/our-approach-inactive.svg"),
        active: withRoot("assets/icons/who-tabs/our-approach-active.svg"),
      },
      "Our Board Members": {
        inactive: withRoot("assets/icons/who-tabs/our-board-members-inactive.svg"),
        active: withRoot("assets/icons/who-tabs/our-board-members-active.svg"),
      },
      "Endowment Fund": {
        inactive: withRoot("assets/icons/who-tabs/endowment-fund-inactive.svg"),
        active: withRoot("assets/icons/who-tabs/endowment-fund-active.svg"),
      },
    };

    root.innerHTML =
      '<section class="who-classic-hero">' +
      '<div class="who-classic-hero-image" style="background-image:url(\'' + heroImage + '\')"></div>' +
      "</section>" +
      '<section class="who-classic-tab-shell">' +
      '<div class="container">' +
      '<div class="who-classic-tabbar" role="tablist">' +
      sections
        .map(function (section, index) {
          var label = section.title || "";
          var iconSet = whoIconMap[label] || whoIconMap.Overview;
          return (
            '<button class="who-classic-tab ' +
            (index === 0 ? "is-active" : "") +
            '" type="button" data-tab-btn="who-classic" data-tab-index="' +
            index +
            '" role="tab" aria-selected="' +
            (index === 0 ? "true" : "false") +
            '" aria-controls="who-panel-' +
            index +
            '" id="who-tab-' +
            index +
            '" data-tab-label="' +
            escapeHtml(label) +
            '">' +
            '<span class="who-classic-icon" aria-hidden="true">' +
            '<img class="who-icon who-icon-inactive" src="' +
            iconSet.inactive +
            '" alt="">' +
            '<img class="who-icon who-icon-active" src="' +
            iconSet.active +
            '" alt="">' +
            "</span>" +
            "<span>" +
            section.title +
            "</span>" +
            "</button>"
          );
        })
        .join("") +
      "</div>" +
      "</div>" +
      "</section>" +
      '<section class="who-classic-content">' +
      '<div class="container">' +
      '<div class="who-classic-panels">' +
      sections
        .map(function (section, index) {
          var imageMain = section.frontImage || section.backImage || heroImage;
          var imageSide = section.backImage || section.frontImage || heroImage;
          return (
            '<article class="who-classic-panel ' +
            (index === 0 ? "is-active" : "") +
            '" data-tab-panel="who-classic" data-tab-index="' +
            index +
            '" role="tabpanel" id="who-panel-' +
            index +
            '" aria-labelledby="who-tab-' +
            index +
            '">' +
            '<div class="who-classic-layout">' +
            '<div class="who-classic-copy rich-copy">' +
            (section.descriptionHtml || "") +
            "</div>" +
            '<aside class="who-classic-media">' +
            '<div class="who-classic-media-main"><img src="' + imageMain + '" alt="' + escapeHtml(section.title) + '"></div>' +
            '<div class="who-classic-media-side"><img src="' + imageSide + '" alt="' + escapeHtml(section.title) + '"></div>' +
            '<span class="who-classic-media-accent" aria-hidden="true"></span>' +
            "</aside>" +
            "</div>" +
            "</article>"
          );
        })
        .join("") +
      "</div>" +
      "</div>" +
      "</section>";

    initWhoClassicTabs();
  }

  function renderOurStoryPage() {
    var timelineImageByYear = {
      "2008": "https://enf-cms.finehhstaging.com/uploads/sub_Images_01_e75c96161d.png",
      "2010": "https://enf-cms.finehhstaging.com/uploads/sub_Images_02_08ac070f46.png",
      "2015": "https://enf-cms.finehhstaging.com/uploads/sub_Images_03_3089b0af13.png",
      "2018": "https://enf-cms.finehhstaging.com/uploads/sub_Images_04_6aa6bec7f4.png",
      "2023": "https://enf-cms.finehhstaging.com/uploads/sub_Images_06_87f2cbce1a.png",
    };
    var timelineSummaryByYear = {
      "2008": "2008 Establishment of ENF 50 scholars were selected under Elia Nuqul Scholarship Fund",
      "2010": "Launched ENF Capacity Building Programs",
      "2015": "Introduced ENF fundraising programs to individuals and corporates",
      "2018": "Celebrated ENF’s 10th anniversary",
      "2023":
        "Reached to 700 scholars and graduates (starting from late Mr. Elia Nuqul’s journey in supporting scholars) 10 diversified Capacity Building youth programs 40 strategic corporate partnerships More than 250 individual donors",
    };
    var timeline = (content.ourStory.timeline || [])
      .slice()
      .sort(function (a, b) {
        return Number(a.year || 0) - Number(b.year || 0);
      })
      .map(function (item) {
        var year = String(item.year || "");
        var descriptionHtml = item.descriptionHtml || "";
        var summary = timelineSummaryByYear[year] || sanitizeText(item.summary || descriptionHtml || "");
        return {
          year: year,
          descriptionHtml: descriptionHtml,
          summary: summary,
          image: item.image || timelineImageByYear[year] || "",
        };
      });
    var previewVideoUrl = buildYouTubeEmbedUrl(content.ourStory.videoUrl, {
      autoplay: true,
      mute: true,
      loop: true,
      controls: false,
    });

    root.innerHTML =
      hero({
        title: "Our Story",
        subtitle: "From a vision in 2008 to measurable social impact across Jordan.",
        image: content.banners.ourStory,
        className: "page-hero--our-story",
      }) +
      '<section class="section-space story-video-section">' +
      '<div class="container">' +
      '<div class="story-video-frame surface-card reveal">' +
      (previewVideoUrl
        ? '<iframe class="story-video-preview story-video-preview--story-page" src="' +
          previewVideoUrl +
          '" title="ENF story preview" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>'
        : '<img class="story-video-fallback" src="' + content.ourStory.thumbnail + '" alt="Our story video thumbnail">') +
      '<button class="video-overlay-btn" type="button" data-open-story-video>Watch Story</button>' +
      "</div>" +
      '<div class="home-video-modal" id="home-video-modal" aria-hidden="true">' +
      '<div class="home-video-modal-card">' +
      '<button class="home-video-close" type="button" data-home-video-close aria-label="Close video">Close ×</button>' +
      '<iframe id="home-video-frame" title="ENF story video" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>' +
      "</div>" +
      "</div>" +
      "</div>" +
      "</section>" +
      '<section class="section-space story-timeline-section" style="padding-top:0">' +
      '<div class="container">' +
      '<div class="story-timeline-head reveal">' +
      '<span class="section-kicker">Journey</span>' +
      '<h2 class="section-title">Milestones Through the Years</h2>' +
      '<p class="section-subtitle">' + (content.ourStory.introTitle || "ENF growth timeline") + "</p>" +
      '<div class="story-timeline-controls">' +
      '<button class="tiny-btn" type="button" data-timeline-prev>◀</button>' +
      '<button class="tiny-btn" type="button" data-timeline-next>▶</button>' +
      '<button class="tiny-btn is-active" type="button" data-timeline-autoplay>Auto: On</button>' +
      '<span class="tag" id="timeline-step">Milestone 1 / ' + Math.max(timeline.length, 1) + "</span>" +
      "</div>" +
      '<div class="story-timeline-progress"><span id="timeline-progress-fill"></span></div>' +
      "</div>" +
      '<div class="story-timeline-surface surface-card reveal" id="story-timeline-surface">' +
      '<div class="story-timeline-axis" aria-hidden="true"></div>' +
      '<div class="story-milestones">' +
      timeline
        .map(function (item, index) {
          var year = String(item.year || "");
          var summary = sanitizeText(item.summary || item.descriptionHtml || "");
          var cardSummary = summary || "ENF milestone update.";
          var cardDetails = item.descriptionHtml || "<p>" + escapeHtml(cardSummary) + "</p>";
          var media = item.image || content.ourStory.thumbnail || content.banners.ourStory || "";
          return (
            '<article class="story-milestone ' +
            (index === 0 ? "is-active " : "") +
            (index % 2 === 0 ? "is-left" : "is-right") +
            '" data-timeline-node="' +
            index +
            '" tabindex="' +
            (index === 0 ? "0" : "-1") +
            '">' +
            '<div class="story-milestone-pane story-milestone-copy">' +
            '<span class="story-milestone-order">' +
            String(index + 1).padStart(2, "0") +
            "</span>" +
            '<h3 class="story-milestone-year">' +
            escapeHtml(year) +
            "</h3>" +
            '<p class="story-milestone-summary">' +
            escapeHtml(cardSummary) +
            "</p>" +
            '<div class="story-milestone-details rich-copy">' +
            cardDetails +
            "</div>" +
            "</div>" +
            '<button class="story-milestone-dot ' +
            (index === 0 ? "is-active" : "") +
            '" type="button" data-timeline-dot="' +
            index +
            '" aria-label="View milestone ' +
            (index + 1) +
            " (" +
            escapeHtml(year) +
            ')"></button>' +
            '<div class="story-milestone-pane story-milestone-visual">' +
            '<div class="story-milestone-media" style="background-image:url(\'' +
            media +
            '\')">' +
            "<span>Milestone</span>" +
            "<strong>" +
            escapeHtml(year) +
            "</strong>" +
            "</div>" +
            "</div>" +
            "</article>"
          );
        })
        .join("") +
      "</div>" +
      "</div>" +
      "</section>";

    initHomeVideoModal(content.ourStory.videoUrl);
    initTimeline(timeline);
  }

  function renderWhatWeDoPage() {
    var programs = (content.whatWeDo.programs || []).slice(0, 4);
    if (!programs.length) {
      programs = [
        {
          title: "Program Highlight",
          excerpt: "",
          articleHtml: "<p>Program details will be available soon.</p>",
          image: content.banners.whatWeDo || content.banners.home || "",
        },
      ];
    }
    var firstProgram = programs[0];
    var firstProgramSummary =
      truncate(sanitizeText(firstProgram.excerpt || firstProgram.articleHtml || ""), 220) || "Program overview.";

    root.innerHTML =
      hero({
        title: "What We Do",
        subtitle: "Beyond tuition support, ENF equips scholars with practical leadership and employability skills.",
        image: content.banners.whatWeDo,
        className: "page-hero--what-we-do",
      }) +
      '<section class="what-hero-strip-wrap">' +
      '<div class="container">' +
      '<div class="what-hero-strip surface-card reveal">' +
      programs
        .map(function (program, index) {
          var thumb = program.image || content.banners.whatWeDo || "";
          return (
            '<button class="what-hero-thumb ' +
            (index === 0 ? "is-active" : "") +
            '" type="button" data-what-hero-thumb="' +
            index +
            '" aria-label="Preview ' +
            escapeHtml(program.title) +
            '">' +
            '<img src="' +
            thumb +
            '" alt="' +
            escapeHtml(program.title) +
            '">' +
            "<span>" +
            escapeHtml(program.title) +
            "</span>" +
            "</button>"
          );
        })
        .join("") +
      "</div>" +
      "</div>" +
      "</section>" +
      '<section class="section-space what-intro-section" style="padding-top:1rem">' +
      '<div class="container">' +
      '<div class="what-intro-head reveal">' +
      '<span class="section-kicker">Interventions</span>' +
      '<h2 class="section-title">Programs That Build Lasting Opportunity</h2>' +
      "</div>" +
      '<div class="what-intro-shell surface-card reveal">' +
      '<div class="what-intro-copy rich-copy">' +
      (content.whatWeDo.descriptionHtml || "") +
      "</div>" +
      '<aside class="what-intro-side">' +
      "<h3>How ENF Supports Scholars</h3>" +
      '<ul class="what-intro-points">' +
      programs
        .map(function (program, index) {
          return (
            "<li>" +
            '<span class="what-intro-point-num">' +
            String(index + 1).padStart(2, "0") +
            "</span>" +
            "<span>" +
            escapeHtml(program.title) +
            "</span>" +
            "</li>"
          );
        })
        .join("") +
      "</ul>" +
      '<div class="what-intro-meta">' +
      '<div class="what-intro-stat"><strong>' +
      programs.length +
      '</strong><span>Core Tracks</span></div>' +
      '<div class="what-intro-stat"><strong>Beyond Tuition</strong><span>Capacity and Employability</span></div>' +
      "</div>" +
      "</div>" +
      "</section>";

    root.innerHTML +=
      '<section class="section-space what-programs-section" style="padding-top:0">' +
      '<div class="container">' +
      '<div class="what-program-shell surface-card reveal" id="what-program-shell">' +
      '<div class="what-program-shell-head">' +
      '<span class="section-kicker">Program Portfolio</span>' +
      '<div class="what-program-shell-controls">' +
      '<button class="tiny-btn" type="button" data-what-prev>◀</button>' +
      '<button class="tiny-btn" type="button" data-what-next>▶</button>' +
      '<button class="tiny-btn is-active" type="button" data-what-auto>Auto: On</button>' +
      "</div>" +
      "</div>" +
      '<div class="what-program-progress"><span id="what-program-progress-fill"></span></div>' +
      '<div class="what-program-layout">' +
      '<div class="what-program-topic-grid" role="tablist" aria-label="What We Do Programs">' +
      programs
        .map(function (program, index) {
          var preview = truncate(sanitizeText(program.excerpt || program.articleHtml || ""), 135) || "Program overview.";
          return (
            '<button class="what-topic-card ' +
            (index === 0 ? "is-active" : "") +
            '" type="button" data-what-topic="' +
            index +
            '" aria-selected="' +
            (index === 0 ? "true" : "false") +
            '" tabindex="' +
            (index === 0 ? "0" : "-1") +
            '">' +
            '<span class="what-topic-index">' +
            String(index + 1).padStart(2, "0") +
            "</span>" +
            '<strong class="what-topic-title">' +
            escapeHtml(program.title) +
            "</strong>" +
            '<p class="what-topic-summary">' +
            escapeHtml(preview) +
            "</p>" +
            "</button>"
          );
        })
        .join("") +
      "</div>" +
      '<article class="what-program-stage" id="what-program-stage" aria-live="polite">' +
      '<div class="what-program-stage-media">' +
      '<img id="what-program-image" src="' +
      (firstProgram.image || content.banners.whatWeDo || "") +
      '" alt="' +
      escapeHtml(firstProgram.title) +
      '">' +
      "</div>" +
      '<div class="what-program-stage-copy">' +
      '<span class="tag" id="what-program-step">Program 1 / ' +
      programs.length +
      "</span>" +
      '<h3 id="what-program-title">' +
      escapeHtml(firstProgram.title) +
      "</h3>" +
      '<p class="what-stage-excerpt" id="what-program-excerpt">' +
      escapeHtml(firstProgramSummary) +
      "</p>" +
      '<div class="rich-copy" id="what-program-body">' +
      (firstProgram.articleHtml || "<p>" + escapeHtml(firstProgramSummary) + "</p>") +
      "</div>" +
      "</div>" +
      "</article>" +
      "</div>" +
      "</div>" +
      "</div>" +
      "</section>";

    initWhatWeDoExperience(programs);
  }

  function renderPartnersPage() {
    var sectionCards = content.partners.sectionCards || [];
    var institutional = content.partners.institutional || [];
    var individual = content.partners.individual || [];

    var coreAndStrategic = institutional.filter(function (item) {
      return item.core || item.strategic;
    });
    var corporate = institutional.filter(function (item) {
      return !item.core && !item.strategic;
    });

    var cardConfigs = [
      {
        key: "institutional",
        title: (sectionCards[0] && sectionCards[0].title) || "Institutional Donors",
        subtitle: (sectionCards[0] && sectionCards[0].subtitle) || "Our Core & Strategic Partners",
        image: (sectionCards[0] && (sectionCards[0].featureImage || sectionCards[0].bannerImage)) || "",
        items: coreAndStrategic,
      },
      {
        key: "individual",
        title: (sectionCards[1] && sectionCards[1].title) || "Individual Donors",
        subtitle: (sectionCards[1] && sectionCards[1].subtitle) || "Our Individual Donors",
        image: (sectionCards[1] && (sectionCards[1].featureImage || sectionCards[1].bannerImage)) || "",
        items: individual,
      },
      {
        key: "corporate",
        title: (sectionCards[2] && sectionCards[2].title) || "Corporate Partners",
        subtitle: (sectionCards[2] && sectionCards[2].subtitle) || "Our Corporate Partners",
        image: (sectionCards[2] && (sectionCards[2].featureImage || sectionCards[2].bannerImage)) || "",
        items: corporate,
      },
    ];

    root.innerHTML =
      hero({
        title: "Our Partners",
        subtitle: "A diverse alliance of institutions and individuals enabling ENF scholars to thrive.",
        image: content.banners.partners,
      }) +
      '<section class="section-space">' +
      '<div class="container">' +
      '<div class="grid grid-3">' +
      cardConfigs
        .map(function (card) {
          return (
            '<article class="card partners-category-card reveal" role="button" tabindex="0" data-partner-category="' +
            card.key +
            '" aria-label="View ' +
            escapeHtml(card.title) +
            ' details">' +
            '<div class="card-media"><img src="' + card.image + '" alt="' + escapeHtml(card.title) + '"></div>' +
            "<h3>" + card.title + "</h3>" +
            "<p>" + (card.subtitle || "") + "</p>" +
            '<span class="partners-card-hint">View Details</span>' +
            "</article>"
          );
        })
        .join("") +
      "</div>" +
      "</div>" +
      "</section>" +
      '<div class="modal" id="partners-modal" aria-hidden="true">' +
      '<div class="modal-card partner-modal-card">' +
      '<button class="modal-close" type="button" data-partners-modal-close>×</button>' +
      '<div class="partner-modal-head">' +
      '<span class="section-kicker" id="partners-modal-kicker">Partner Category</span>' +
      '<h2 class="section-title" id="partners-modal-title">Partners</h2>' +
      '<p class="section-subtitle" id="partners-modal-subtitle"></p>' +
      "</div>" +
      '<div class="partner-modal-grid" id="partners-modal-grid"></div>' +
      "</div>" +
      "</div>";

    initPartnersCategoryModal(cardConfigs);
  }

  function initPartnersCategoryModal(cardConfigs) {
    var modal = document.getElementById("partners-modal");
    var closeButton = modal ? modal.querySelector("[data-partners-modal-close]") : null;
    var titleEl = document.getElementById("partners-modal-title");
    var kickerEl = document.getElementById("partners-modal-kicker");
    var subtitleEl = document.getElementById("partners-modal-subtitle");
    var gridEl = document.getElementById("partners-modal-grid");
    var openCards = Array.prototype.slice.call(document.querySelectorAll("[data-partner-category]"));

    if (!modal || !titleEl || !subtitleEl || !gridEl || !openCards.length) return;

    function initials(name) {
      var words = String(name || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      if (!words.length) return "ENF";
      var first = words[0] ? words[0].charAt(0) : "";
      var second = words[1] ? words[1].charAt(0) : "";
      return (first + second).toUpperCase() || "ENF";
    }

    function renderItem(item, index) {
      var name = String((item && item.name) || "").trim() || "Partner " + (index + 1);
      var logo = (item && (item.icon || item.logo || item.image)) || "";
      var href = ensureProtocol((item && item.url) || "");
      var fallbackInitials = initials(name);
      var visual = logo
        ? '<img src="' +
          logo +
          '" alt="' +
          escapeHtml(name) +
          ' logo" loading="lazy" data-fallback-initials="' +
          fallbackInitials +
          '">'
        : '<span class="partner-modal-placeholder">' + escapeHtml(fallbackInitials) + "</span>";
      var nameMarkup = href
        ? '<a href="' + href + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(name) + "</a>"
        : escapeHtml(name);
      return (
        '<article class="partner-modal-item">' +
        '<div class="partner-modal-logo">' +
        visual +
        "</div>" +
        '<p class="partner-modal-name">' +
        nameMarkup +
        "</p>" +
        "</article>"
      );
    }

    function openModalFor(categoryKey) {
      var category = (cardConfigs || []).find(function (entry) {
        return entry.key === categoryKey;
      });
      if (!category) return;
      var items = Array.isArray(category.items) ? category.items : [];
      var countLabel = items.length === 1 ? "1 partner" : items.length + " partners";

      if (kickerEl) {
        kickerEl.textContent = "Partner Category";
      }
      titleEl.textContent = category.title || "Partners";
      subtitleEl.textContent = (category.subtitle || "") + (countLabel ? " • " + countLabel : "");
      gridEl.innerHTML = items.length
        ? items
            .map(function (item, index) {
              return renderItem(item, index);
            })
            .join("")
        : '<p class="section-subtitle">Partner details will be available soon.</p>';

      Array.prototype.slice
        .call(gridEl.querySelectorAll("img[data-fallback-initials]"))
        .forEach(function (img) {
          img.addEventListener(
            "error",
            function () {
              var holder = img.closest(".partner-modal-logo");
              var fallback = img.getAttribute("data-fallback-initials") || "ENF";
              if (holder) {
                holder.innerHTML = '<span class="partner-modal-placeholder">' + escapeHtml(fallback) + "</span>";
              }
            },
            { once: true }
          );
        });

      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }

    function closeModal() {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }

    openCards.forEach(function (card) {
      var key = card.getAttribute("data-partner-category");
      card.addEventListener("click", function () {
        openModalFor(key);
      });
      card.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openModalFor(key);
        }
      });
    });

    if (closeButton) {
      closeButton.addEventListener("click", closeModal);
    }

    modal.addEventListener("click", function (event) {
      if (event.target === modal) closeModal();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && modal.classList.contains("is-open")) {
        closeModal();
      }
    });
  }

  function initImpactLens(entries) {
    var stories = entries || [];
    var cards = Array.prototype.slice.call(document.querySelectorAll("[data-impact-story]"));
    var imageEl = document.getElementById("impact-lens-image");
    var titleEl = document.getElementById("impact-lens-title");
    var roleEl = document.getElementById("impact-lens-role");
    var quoteEl = document.getElementById("impact-lens-quote");
    var stepEl = document.getElementById("impact-lens-step");
    var progressEl = document.getElementById("impact-lens-progress-fill");
    var openBtn = document.getElementById("impact-lens-open");
    var prevBtn = document.querySelector("[data-impact-prev]");
    var nextBtn = document.querySelector("[data-impact-next]");
    var autoBtn = document.querySelector("[data-impact-auto]");
    var shell = document.getElementById("impact-lens-shell");

    if (!stories.length || !cards.length || !imageEl || !titleEl || !quoteEl || !openBtn) return;

    var current = 0;
    var timer = null;
    var resumeTimer = null;
    var autoplay = true;

    function stopAuto() {
      if (timer) clearTimeout(timer);
      timer = null;
    }

    function updateAutoUi(label) {
      if (!autoBtn) return;
      autoBtn.classList.toggle("is-active", autoplay);
      autoBtn.textContent = label;
    }

    function setActive(index, options) {
      var count = stories.length;
      var normalized = ((index % count) + count) % count;
      var entry = stories[normalized];
      var story = entry.story || {};
      var preview = truncate(sanitizeText(story.excerpt || story.articleHtml || ""), 250) || "Story preview.";

      current = normalized;

      cards.forEach(function (card, cardIndex) {
        var isActive = cardIndex === normalized;
        card.classList.toggle("is-active", isActive);
        card.setAttribute("aria-selected", isActive ? "true" : "false");
        card.setAttribute("tabindex", isActive ? "0" : "-1");
      });

      imageEl.classList.add("is-swapping");
      imageEl.src = story.bannerImage || story.image || "";
      imageEl.alt = (story.title || "Scholar story") + " image";
      setTimeout(function () {
        imageEl.classList.remove("is-swapping");
      }, 220);

      titleEl.textContent = story.title || "Scholar Story";
      if (roleEl) {
        roleEl.textContent = story.designation || "ENF Fellow";
      }
      quoteEl.textContent = '"' + preview + '"';
      openBtn.setAttribute("data-story-open", String(entry.sourceIndex));

      if (stepEl) {
        stepEl.textContent = "Story " + (normalized + 1) + " / " + count;
      }
      if (progressEl) {
        var pct = count > 1 ? ((normalized + 1) / count) * 100 : 100;
        progressEl.style.width = pct + "%";
      }

      cards[normalized].scrollIntoView({
        behavior: options && options.instant ? "auto" : "smooth",
        block: "nearest",
        inline: "center",
      });

      if (options && options.userTriggered) {
        pauseAutoTemporarily(9800);
      }
    }

    function startAuto() {
      if (!autoplay) return;
      stopAuto();
      timer = setTimeout(function runStep() {
        setActive(current + 1);
        if (autoplay) {
          timer = setTimeout(runStep, 6000);
        }
      }, 6000);
      updateAutoUi("Auto Spotlight");
    }

    function pauseAutoTemporarily(delay) {
      if (!autoplay) return;
      stopAuto();
      updateAutoUi("Auto Paused");
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(function () {
        if (autoplay) {
          startAuto();
        }
      }, delay || 9000);
    }

    function move(delta) {
      setActive(current + delta, { userTriggered: true });
    }

    cards.forEach(function (card) {
      var index = Number(card.getAttribute("data-impact-story"));
      card.addEventListener("click", function () {
        setActive(index, { userTriggered: true });
      });
      card.addEventListener("mouseenter", function () {
        setActive(index, { userTriggered: true });
      });
      card.addEventListener("focus", function () {
        pauseAutoTemporarily(10000);
      });
      card.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setActive(index, { userTriggered: true });
        }
      });
    });

    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        move(-1);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        move(1);
      });
    }

    if (autoBtn) {
      autoBtn.addEventListener("click", function () {
        autoplay = !autoplay;
        if (!autoplay) {
          stopAuto();
          if (resumeTimer) clearTimeout(resumeTimer);
          updateAutoUi("Auto Off");
        } else {
          startAuto();
        }
      });
    }

    if (shell) {
      shell.addEventListener("pointerdown", function () {
        pauseAutoTemporarily(11000);
      });
      shell.addEventListener(
        "wheel",
        function () {
          pauseAutoTemporarily(10000);
        },
        { passive: true }
      );
    }

    document.addEventListener("visibilitychange", function () {
      if (page !== "our-impact") return;
      if (document.hidden) {
        stopAuto();
      } else if (autoplay) {
        startAuto();
      }
    });

    window.addEventListener("beforeunload", function () {
      stopAuto();
      if (resumeTimer) {
        clearTimeout(resumeTimer);
        resumeTimer = null;
      }
    });

    setActive(0, { instant: true });
    startAuto();
  }

  function renderImpactPage() {
    var stories = content.impact.stories || [];
    var featured = stories.find(function (story) {
      return story.featured;
    });
    if (!featured && stories.length) featured = stories[0];

    var featuredIndex = featured ? stories.indexOf(featured) : -1;
    var secondaryStories = stories
      .map(function (story, index) {
        return {
          sourceIndex: index,
          story: story,
        };
      })
      .filter(function (entry) {
        return entry.sourceIndex !== featuredIndex;
      });

    if (featured && /muh?ammad|moh?ammad/i.test(featured.title || "")) {
      secondaryStories = secondaryStories.filter(function (entry) {
        return !/muh?ammad|moh?ammad/i.test((entry.story && entry.story.title) || "");
      });
    }

    var firstSecondary = secondaryStories.length ? secondaryStories[0].story : null;
    var firstSecondaryIndex = secondaryStories.length ? secondaryStories[0].sourceIndex : -1;
    var firstSecondaryPreview = truncate(sanitizeText((firstSecondary && (firstSecondary.excerpt || firstSecondary.articleHtml)) || ""), 250);
    var featuredPreview = featured ? truncate(sanitizeText(featured.excerpt || featured.articleHtml || ""), 300) : "";

    root.innerHTML =
      hero({
        title: "Our Impact",
        subtitle: "Scholar journeys that show what long-term investment in youth can achieve.",
        image: content.banners.impact,
      }) +
      '<section class="section-space impact-featured-section">' +
      '<div class="container">' +
      (featured
        ? '<article class="impact-featured-shell surface-card reveal">' +
          '<div class="impact-featured-media">' +
          '<img src="' +
          featured.image +
          '" alt="' +
          escapeHtml(featured.title) +
          '">' +
          "</div>" +
          '<div class="impact-featured-copy">' +
          '<span class="section-kicker">Featured Story</span>' +
          '<h2 class="section-title impact-featured-title">' +
          featured.title +
          "</h2>" +
          '<p class="impact-featured-role">' +
          (featured.designation || "ENF Fellow") +
          "</p>" +
          '<p class="impact-featured-excerpt">"' +
          escapeHtml(featuredPreview) +
          '"</p>' +
          '<div class="impact-featured-marks">' +
          '<span class="impact-featured-mark">Scholar Outcome</span>' +
          '<span class="impact-featured-mark">Career Progress</span>' +
          '<span class="impact-featured-mark">Community Contribution</span>' +
          "</div>" +
          '<button class="btn btn-primary mt-sm" data-story-open="' +
          featuredIndex +
          '">Read Full Story</button>' +
          "</div>" +
          "</article>"
        : "") +
      "</div>" +
      "</section>" +
      (secondaryStories.length
        ? '<section class="section-space impact-lens-section" style="padding-top:0">' +
          '<div class="container">' +
          '<div class="impact-lens-shell surface-card reveal" id="impact-lens-shell">' +
          '<div class="impact-lens-head">' +
          '<span class="section-kicker">Transformation Journeys</span>' +
          '<h2 class="section-title">More Scholar Voices</h2>' +
          '<p class="section-subtitle">Explore how ENF support translated into confidence, employability, and community impact across different paths.</p>' +
          "</div>" +
          '<div class="impact-lens-toolbar">' +
          '<div class="impact-lens-controls">' +
          '<button class="impact-nav-btn" type="button" data-impact-prev aria-label="Previous story">◀</button>' +
          '<button class="impact-nav-btn" type="button" data-impact-next aria-label="Next story">▶</button>' +
          '<button class="impact-auto-toggle is-active" type="button" data-impact-auto>Auto Spotlight</button>' +
          "</div>" +
          '<span class="impact-lens-step" id="impact-lens-step">Story 1 / ' +
          secondaryStories.length +
          "</span>" +
          "</div>" +
          '<div class="impact-lens-progress"><span id="impact-lens-progress-fill"></span></div>' +
          '<div class="impact-voice-rail" role="tablist" aria-label="Scholar stories">' +
          secondaryStories
            .map(function (entry, index) {
              var person = entry.story || {};
              var role = truncate(sanitizeText(person.designation || "ENF Fellow"), 78);
              return (
                '<button class="impact-voice-card ' +
                (index === 0 ? "is-active" : "") +
                '" type="button" data-impact-story="' +
                index +
                '" aria-selected="' +
                (index === 0 ? "true" : "false") +
                '" tabindex="' +
                (index === 0 ? "0" : "-1") +
                '">' +
                '<span class="impact-voice-avatar"><img src="' +
                person.image +
                '" alt="' +
                escapeHtml(person.title || "Scholar") +
                ' portrait"></span>' +
                '<span class="impact-voice-meta">' +
                "<strong>" +
                escapeHtml(person.title || "Scholar") +
                "</strong>" +
                "<small>" +
                escapeHtml(role) +
                "</small>" +
                "</span>" +
                '<span class="impact-voice-arrow">↗</span>' +
                "</button>"
              );
            })
            .join("") +
          "</div>" +
          '<article class="impact-lens-stage" id="impact-lens-stage">' +
          '<div class="impact-lens-media">' +
          '<img id="impact-lens-image" src="' +
          ((firstSecondary && firstSecondary.bannerImage) || (firstSecondary && firstSecondary.image) || "") +
          '" alt="' +
          escapeHtml((firstSecondary && firstSecondary.title) || "Scholar story") +
          '">' +
          "</div>" +
          '<div class="impact-lens-copy">' +
          '<span class="tag" id="impact-lens-tag">Scholar Story</span>' +
          '<h3 id="impact-lens-title">' +
          escapeHtml((firstSecondary && firstSecondary.title) || "Scholar Story") +
          "</h3>" +
          '<p class="impact-lens-role" id="impact-lens-role">' +
          escapeHtml((firstSecondary && firstSecondary.designation) || "ENF Fellow") +
          "</p>" +
          '<blockquote class="impact-lens-quote" id="impact-lens-quote">"' +
          escapeHtml(firstSecondaryPreview || "Story preview.") +
          '"</blockquote>' +
          '<div class="impact-lens-actions">' +
          '<button class="btn btn-primary" type="button" id="impact-lens-open" data-story-open="' +
          firstSecondaryIndex +
          '">Read Full Story</button>' +
          "</div>" +
          "</div>" +
          "</article>" +
          "</div>" +
          "</div>" +
          "</section>"
        : "") +
      '<div class="modal" id="story-modal">' +
      '<div class="modal-card">' +
      '<button class="modal-close" type="button" data-modal-close>×</button>' +
      '<div id="story-modal-content"></div>' +
      "</div>" +
      "</div>";

    initStoryModal(stories);
    initImpactLens(secondaryStories);
  }

  function renderMediaCenterPage() {
    var sections = content.mediaCenter.sections || [];
    var news = (content.mediaCenter.news || []).slice(0, 8);
    var videos = (content.mediaCenter.videos || []).filter(function (video) {
      return !!(video && video.url);
    });
    var publications = (content.mediaCenter.publications || []).filter(function (publication) {
      return !!publication;
    });
    var rawAlbums = (content.mediaCenter.photoAlbums || []).concat(content.mediaCenter.archivedAlbums || []);
    var seenAlbums = {};
    var albums = rawAlbums
      .map(function (album) {
        if (!album) return null;
        var images = (album.images || []).filter(Boolean);
        var cover = album.coverImage || images[0] || "";
        if (cover && images.indexOf(cover) === -1) {
          images.unshift(cover);
        }
        if (!images.length) return null;
        var key = String(album.slug || album.id || album.title || images[0] || "").toLowerCase();
        if (!key || seenAlbums[key]) return null;
        seenAlbums[key] = true;
        return {
          id: album.id || key,
          title: String(album.title || "ENF Album").trim(),
          coverImage: cover,
          images: images,
        };
      })
      .filter(Boolean);

    var mediaCounts = [
      {
        label: "News Updates",
        value: news.length,
      },
      {
        label: "Photo Albums",
        value: albums.length,
      },
      {
        label: "Video Stories",
        value: videos.length,
      },
      {
        label: "Publications",
        value: publications.length,
      },
    ];

    var featuredNews = news.find(function (item) {
      return !!item.featured;
    });
    if (!featuredNews && news.length) featuredNews = news[0];
    var featuredNewsIndex = featuredNews ? news.indexOf(featuredNews) : -1;

    function extractNewsDateline(item) {
      var raw = sanitizeText((item && (item.articleHtml || item.excerpt)) || "");
      var monthMatch = raw.match(
        /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/i
      );
      if (monthMatch && monthMatch[0]) return monthMatch[0];
      var yearMatch = raw.match(/\b(19|20)\d{2}\b/);
      if (yearMatch && yearMatch[0]) return "ENF Update · " + yearMatch[0];
      return "ENF Newsroom";
    }

    function publicationSnapshotText(item) {
      var text = sanitizeText((item && item.subText) || "");
      if (!text || /download/i.test(text)) {
        return "A concise on-page snapshot of ENF publication themes, highlights, and institutional progress.";
      }
      return text;
    }

    function publicationPoints(item) {
      var title = sanitizeText((item && item.title) || "this publication");
      return [
        "Highlights from " + title + " in an easy-to-scan format.",
        "Stories of scholar development, training, and career readiness.",
        "Partnership outcomes and indicators of long-term community impact.",
      ];
    }

    var firstVideo = videos[0] || null;
    var firstVideoEmbed = firstVideo
      ? buildYouTubeEmbedUrl(firstVideo.url, {
          autoplay: true,
          mute: true,
          loop: true,
          controls: false,
        })
      : "";
    var firstVideoId = firstVideo ? extractYouTubeId(firstVideo.url) : "";
    var firstVideoThumb =
      (firstVideo && firstVideo.thumbnail) ||
      (firstVideoId ? "https://img.youtube.com/vi/" + firstVideoId + "/hqdefault.jpg" : content.banners.mediaCenter || "");

    var firstAlbum = albums[0] || null;
    var firstAlbumImage = firstAlbum ? firstAlbum.images[0] || "" : "";

    var firstPublication = publications[0] || null;

    root.innerHTML =
      hero({
        title: "Media Center",
        subtitle: "A living ENF hub for stories, visuals, videos, and publication highlights.",
        image: content.banners.mediaCenter,
      }) +
      '<section class="section-space media-hub-masthead">' +
      '<div class="container">' +
      '<div class="media-signal-board reveal">' +
      '<div class="media-signal-copy">' +
      '<span class="section-kicker">Live Channels</span>' +
      '<h2 class="section-title">Explore ENF through moving media, visuals, and coverage</h2>' +
      "<p>Each channel below is tailored to its format so visitors can watch, browse, read, and discover impact naturally.</p>" +
      "</div>" +
      '<div class="media-signal-grid">' +
      mediaCounts
        .map(function (item) {
          return (
            '<article class="media-signal-item">' +
            "<strong>" +
            item.value +
            "</strong>" +
            "<span>" +
            escapeHtml(item.label) +
            "</span>" +
            "</article>"
          );
        })
        .join("") +
      "</div>" +
      "</div>" +
      "</div>" +
      "</section>" +
      '<section class="section-space media-videos-section" style="padding-top:0">' +
      '<div class="container">' +
      '<div class="media-video-shell surface-card reveal">' +
      '<div class="media-block-head">' +
      '<span class="section-kicker">Videos</span>' +
      '<h2 class="section-title">ENF Video Stream</h2>' +
      '<p class="section-subtitle">Looping previews keep the section alive while preserving a clean, focused viewing experience.</p>' +
      "</div>" +
      '<div class="media-video-layout">' +
      '<article class="media-video-stage">' +
      (firstVideoEmbed
        ? '<div class="media-video-frame">' +
          '<iframe id="media-video-loop-frame" src="' +
          firstVideoEmbed +
          '" title="ENF media highlight" loading="lazy" allow="autoplay; encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin"></iframe>' +
          "</div>"
        : '<div class="media-video-placeholder">No video links are currently available.</div>') +
      '<div class="media-video-stage-meta">' +
      '<span class="tag">Looping Preview</span>' +
      '<h3 id="media-video-title">' +
      escapeHtml((firstVideo && firstVideo.title) || "ENF Video Spotlight") +
      "</h3>" +
      '<p id="media-video-source">' +
      escapeHtml((firstVideo && firstVideo.source) || "Media Center") +
      "</p>" +
      '<div class="media-video-actions">' +
      '<button class="btn btn-primary" type="button" id="media-video-watch-btn">Watch with Audio</button>' +
      (firstVideo
        ? '<a class="btn btn-ghost" id="media-video-source-link" href="' +
          ensureProtocol(firstVideo.url) +
          '" target="_blank" rel="noopener noreferrer">Open Source</a>'
        : "") +
      "</div>" +
      "</div>" +
      "</article>" +
      '<div class="media-video-playlist" role="listbox" aria-label="ENF videos">' +
      videos
        .map(function (video, index) {
          var videoId = extractYouTubeId(video.url);
          var thumb = video.thumbnail || (videoId ? "https://img.youtube.com/vi/" + videoId + "/mqdefault.jpg" : firstVideoThumb);
          return (
            '<button class="media-video-item ' +
            (index === 0 ? "is-active" : "") +
            '" type="button" data-media-video-index="' +
            index +
            '" aria-selected="' +
            (index === 0 ? "true" : "false") +
            '">' +
            '<span class="media-video-item-thumb"><img src="' +
            thumb +
            '" alt="' +
            escapeHtml(video.title || "ENF video") +
            ' thumbnail"></span>' +
            '<span class="media-video-item-meta"><strong>' +
            escapeHtml(video.title || "ENF Video") +
            "</strong><small>" +
            escapeHtml(video.source || "ENF Media") +
            "</small></span>" +
            "</button>"
          );
        })
        .join("") +
      "</div>" +
      "</div>" +
      "</div>" +
      "</div>" +
      "</section>" +
      '<section class="section-space media-photos-section" style="padding-top:0">' +
      '<div class="container">' +
      '<div class="media-photo-shell surface-card reveal" id="media-photo-shell">' +
      '<div class="media-block-head">' +
      '<span class="section-kicker">Photo Albums</span>' +
      '<h2 class="section-title">Visual Stories</h2>' +
      '<p class="section-subtitle">Auto-slideshow for momentum, plus one-by-one image browsing when users want detail.</p>' +
      "</div>" +
      (albums.length
        ? '<div class="media-album-rail" role="tablist" aria-label="Photo albums">' +
          albums
            .map(function (album, index) {
              return (
                '<button class="media-album-chip ' +
                (index === 0 ? "is-active" : "") +
                '" type="button" data-media-album-index="' +
                index +
                '" aria-selected="' +
                (index === 0 ? "true" : "false") +
                '">' +
                "<strong>" +
                escapeHtml(album.title) +
                "</strong>" +
                "<span>" +
                album.images.length +
                " photos</span>" +
                "</button>"
              );
            })
            .join("") +
          "</div>" +
          '<div class="media-photo-stage">' +
          '<button class="media-photo-nav" type="button" data-media-photo-prev aria-label="Previous photo">◀</button>' +
          '<figure class="media-photo-view">' +
          '<img id="media-photo-image" src="' +
          firstAlbumImage +
          '" alt="' +
          escapeHtml((firstAlbum && firstAlbum.title) || "Photo album") +
          '">' +
          '<figcaption><strong id="media-photo-album-title">' +
          escapeHtml((firstAlbum && firstAlbum.title) || "ENF Album") +
          '</strong><span id="media-photo-counter">1 / ' +
          ((firstAlbum && firstAlbum.images.length) || 1) +
          "</span></figcaption>" +
          "</figure>" +
          '<button class="media-photo-nav" type="button" data-media-photo-next aria-label="Next photo">▶</button>' +
          "</div>" +
          '<div class="media-photo-toolbar">' +
          '<button class="btn btn-primary" type="button" id="media-photo-open">View Photo</button>' +
          '<button class="btn btn-ghost" type="button" id="media-photo-toggle-grid">Browse Album</button>' +
          '<div class="media-photo-progress"><span id="media-photo-progress-fill"></span></div>' +
          "</div>" +
          '<div class="media-photo-grid is-hidden" id="media-photo-grid"></div>'
        : '<div class="media-photo-empty">No photo albums are currently available.</div>') +
      "</div>" +
      "</div>" +
      "</section>" +
      '<section class="section-space media-news-section" style="padding-top:0">' +
      '<div class="container">' +
      '<div class="media-news-shell surface-card reveal">' +
      '<div class="media-block-head">' +
      '<span class="section-kicker">News</span>' +
      '<h2 class="section-title">ENF Newsroom</h2>' +
      '<p class="section-subtitle">Editorial-style coverage with a highlighted lead story and an interactive headline feed.</p>' +
      "</div>" +
      (featuredNews
        ? '<div class="media-news-layout">' +
          '<article class="media-news-feature" id="media-news-feature">' +
          '<div class="media-news-feature-media"><img id="media-news-image" src="' +
          featuredNews.image +
          '" alt="' +
          escapeHtml(featuredNews.title) +
          '"></div>' +
          '<div class="media-news-feature-copy">' +
          '<span class="media-news-meta" id="media-news-meta">' +
          escapeHtml(extractNewsDateline(featuredNews)) +
          "</span>" +
          '<h3 id="media-news-title">' +
          escapeHtml(featuredNews.title) +
          "</h3>" +
          '<p id="media-news-excerpt">' +
          escapeHtml(truncate(sanitizeText(featuredNews.excerpt || featuredNews.articleHtml || ""), 310)) +
          "</p>" +
          '<div class="media-news-actions">' +
          '<button class="btn btn-primary" type="button" id="media-news-open" data-media-news-open="' +
          featuredNewsIndex +
          '">Read Coverage</button>' +
          "</div>" +
          "</div>" +
          "</article>" +
          '<aside class="media-news-feed" id="media-news-feed">' +
          news
            .map(function (item, index) {
              return (
                '<button class="media-news-item ' +
                (index === featuredNewsIndex ? "is-active" : "") +
                '" type="button" data-media-news-index="' +
                index +
                '">' +
                "<small>" +
                escapeHtml(extractNewsDateline(item)) +
                "</small>" +
                "<strong>" +
                escapeHtml(item.title) +
                "</strong>" +
                "<p>" +
                escapeHtml(truncate(sanitizeText(item.excerpt || item.articleHtml || ""), 108)) +
                "</p>" +
                "</button>"
              );
            })
            .join("") +
          "</aside>" +
          "</div>"
        : '<div class="media-news-empty">No news posts are currently available.</div>') +
      "</div>" +
      "</div>" +
      "</section>" +
      '<section class="section-space media-pubs-section" style="padding-top:0">' +
      '<div class="container">' +
      '<div class="media-pub-shell surface-card reveal">' +
      '<div class="media-block-head">' +
      '<span class="section-kicker">Publications</span>' +
      '<h2 class="section-title">Publication Reader</h2>' +
      '<p class="section-subtitle">Publications are presented for inline reading, with no download-first dependency.</p>' +
      "</div>" +
      '<div class="media-pub-layout">' +
      '<div class="media-pub-shelf">' +
      publications
        .map(function (publication, index) {
          return (
            '<button class="media-pub-card ' +
            (index === 0 ? "is-active" : "") +
            '" type="button" data-media-pub-index="' +
            index +
            '">' +
            '<span class="media-pub-cover"><img src="' +
            publication.image +
            '" alt="' +
            escapeHtml(publication.title || "Publication") +
            '"></span>' +
            '<span class="media-pub-info"><strong>' +
            escapeHtml(publication.title || "Publication") +
            "</strong><small>" +
            escapeHtml(sanitizeText(publication.subText || "Publication highlights")) +
            "</small></span>" +
            "</button>"
          );
        })
        .join("") +
      "</div>" +
      '<article class="media-pub-reader" id="media-pub-reader">' +
      (firstPublication
        ? '<header class="media-pub-head">' +
          '<h3 id="media-pub-title">' +
          escapeHtml(firstPublication.title || "Publication Reader") +
          "</h3>" +
          '<p id="media-pub-sub">' +
          escapeHtml(publicationSnapshotText(firstPublication)) +
          "</p>" +
          '<div class="media-pub-actions">' +
          '<button class="btn btn-primary" type="button" id="media-pub-open-panel">Read Snapshot</button>' +
          '<a id="media-pub-open-source" class="btn btn-ghost" href="' +
          ensureProtocol(firstPublication.file) +
          '" target="_blank" rel="noopener noreferrer">Open Source</a>' +
          "</div>" +
          "</header>" +
          '<div class="media-pub-preview" id="media-pub-preview">' +
          '<div class="media-pub-preview-cover"><img id="media-pub-preview-image" src="' +
          firstPublication.image +
          '" alt="' +
          escapeHtml(firstPublication.title || "Publication cover") +
          '"></div>' +
          '<div class="media-pub-preview-copy">' +
          '<h4 id="media-pub-preview-heading">Publication Snapshot</h4>' +
          '<p id="media-pub-preview-text">' +
          escapeHtml(
            truncate(
              sanitizeText(firstPublication.subText || "Explore a concise publication summary."),
              260
            )
          ) +
          "</p>" +
          '<ul class="media-pub-points" id="media-pub-points">' +
          publicationPoints(firstPublication)
            .map(function (point) {
              return "<li>" + escapeHtml(point) + "</li>";
            })
            .join("") +
          "</ul>" +
          "</div>" +
          "</div>" +
          '<p class="media-pub-note">Tip: use card controls to switch publications while staying on this page.</p>'
        : '<div class="media-pub-empty">No publications are currently available.</div>') +
      "</article>" +
      "</div>" +
      "</div>" +
      "</div>" +
      "</section>" +
      '<div class="modal" id="media-video-modal" aria-hidden="true">' +
      '<div class="modal-card media-modal-card">' +
      '<button class="modal-close" type="button" data-media-video-close>×</button>' +
      '<div class="media-modal-frame-wrap"><iframe id="media-video-modal-frame" src="" title="Video player" allow="autoplay; encrypted-media; picture-in-picture" loading="lazy"></iframe></div>' +
      "</div>" +
      "</div>" +
      '<div class="modal" id="media-photo-modal" aria-hidden="true">' +
      '<div class="modal-card media-photo-modal-card">' +
      '<button class="modal-close" type="button" data-media-photo-close>×</button>' +
      '<div class="media-photo-modal-stage">' +
      '<button class="media-photo-nav" type="button" data-media-photo-modal-prev aria-label="Previous photo">◀</button>' +
      '<figure>' +
      '<img id="media-photo-modal-image" src="" alt="ENF photo">' +
      '<figcaption><strong id="media-photo-modal-title"></strong><span id="media-photo-modal-counter"></span></figcaption>' +
      "</figure>" +
      '<button class="media-photo-nav" type="button" data-media-photo-modal-next aria-label="Next photo">▶</button>' +
      "</div>" +
      "</div>" +
      "</div>" +
      '<div class="modal" id="media-news-modal" aria-hidden="true">' +
      '<div class="modal-card media-news-modal-card">' +
      '<button class="modal-close" type="button" data-media-news-close>×</button>' +
      '<article id="media-news-modal-content"></article>' +
      "</div>" +
      "</div>";

    initMediaCenterHub({
      videos: videos,
      albums: albums,
      news: news,
      publications: publications,
    });
  }

  function buildDonationPurposeOptions(programs) {
    var list = programs || [];
    var base = '<option value="">Select purpose</option><option value="general">General ENF Support</option><option value="education">Education</option>';
    if (!list.length) {
      return base + '<option value="other">Other supported cause</option>';
    }
    return (
      base +
      list
        .map(function (program) {
          return '<option value="' + escapeHtml(program.slug || program.title) + '">' + escapeHtml(program.title) + "</option>";
        })
        .join("") +
      '<option value="other">Other supported cause</option>'
    );
  }

  function buildDonationServiceOptions(services) {
    var list = services || [];
    if (!list.length) {
      return '<option value="">Select service</option><option value="general">General Donation</option>';
    }
    return (
      '<option value="">Select service</option>' +
      list
      .map(function (item, index) {
        return (
          '<option value="' +
          escapeHtml(item.code || item.service || "general") +
          '">' +
          escapeHtml(item.service || "Donation Service") +
          "</option>"
        );
      })
      .join("")
    );
  }

  function renderDonatePage() {
    var services = content.donate.donationServices || [];
    var programs = content.whatWeDo.programs || [];

    root.innerHTML =
      hero({
        title: "Donate Now",
        subtitle: sanitizeText(content.donate.subText || "Your support helps scholars continue their education and build a better future."),
        image: content.banners.donateNow,
        kicker: "One-Time or Monthly",
      }) +
      '<section class="section-space">' +
      '<div class="container donation-shell">' +
      '<article class="surface-card reveal donation-panel">' +
      '<span class="section-kicker">Secure Giving</span>' +
      '<h2 class="section-title" style="font-size:1.72rem">Clear donation journey, step by step</h2>' +
      '<p class="section-subtitle">Complete each step in order. Next steps unlock automatically after each confirmed choice.</p>' +

      '<div class="donation-steps mt-md">' +
      '<button type="button" class="step-chip is-active" data-donation-step-nav="1"><span>1</span> Type</button>' +
      '<button type="button" class="step-chip" data-donation-step-nav="2"><span>2</span> Purpose</button>' +
      '<button type="button" class="step-chip" data-donation-step-nav="3"><span>3</span> Amount</button>' +
      '<button type="button" class="step-chip" data-donation-step-nav="4"><span>4</span> Identity</button>' +
      '<button type="button" class="step-chip" data-donation-step-nav="5"><span>5</span> Payment</button>' +
      '<button type="button" class="step-chip" data-donation-step-nav="6"><span>6</span> Confirm</button>' +
      "</div>" +

      '<form id="donation-form" class="donation-flow mt-md">' +
      '<section class="donation-step is-active" data-donation-step="1">' +
      '<h3 class="donation-step-title">Step 1: Donation Type</h3>' +
      '<div class="mode-toggle mt-sm" role="tablist">' +
      '<button class="mode-pill" type="button" data-donate-mode="one_time">One-Time Donation</button>' +
      '<button class="mode-pill" type="button" data-donate-mode="monthly">Monthly Subscription</button>' +
      "</div>" +
      '<p class="small-note mt-sm" data-mode-note>Select one option to continue.</p>' +
      '<div class="plan-grid mt-md" data-plan-grid>' +
      '<button type="button" class="plan-card" data-plan="starter" data-plan-amount="10"><h4>Starter</h4><p>JOD 10 / month</p><span>Support monthly essentials</span></button>' +
      '<button type="button" class="plan-card" data-plan="sustainer" data-plan-amount="25"><h4>Sustainer</h4><p>JOD 25 / month</p><span>Strengthen scholar continuity</span></button>' +
      '<button type="button" class="plan-card" data-plan="champion" data-plan-amount="50"><h4>Champion</h4><p>JOD 50 / month</p><span>Scale long-term impact</span></button>' +
      "</div>" +
      '<div class="step-actions mt-md">' +
      '<button class="btn btn-primary" type="button" data-donation-next>Continue</button>' +
      "</div>" +
      "</section>" +

      '<section class="donation-step" data-donation-step="2">' +
      '<h3 class="donation-step-title">Step 2: Choose Purpose</h3>' +
      '<input type="hidden" name="service_code" value="' + escapeHtml(services[0] && (services[0].code || services[0].service) || "general") + '">' +
      '<div class="field mt-sm"><label>Purpose / Program</label><select name="purpose">' + buildDonationPurposeOptions(programs) + "</select></div>" +
      '<input type="hidden" name="category_code" value="">' +
      '<div class="step-actions mt-md">' +
      '<button class="btn btn-ghost" type="button" data-donation-back>Back</button>' +
      '<button class="btn btn-primary" type="button" data-donation-next>Continue</button>' +
      "</div>" +
      "</section>" +

      '<section class="donation-step" data-donation-step="3">' +
      '<h3 class="donation-step-title">Step 3: Select Amount</h3>' +
      '<div class="amount-presets mt-sm">' +
      [10, 25, 50, 100, 250]
        .map(function (amount) {
          return '<button type="button" class="amount-chip" data-amount="' + amount + '">' + formatJod(amount) + "</button>";
        })
        .join("") +
      "</div>" +
      '<div class="field mt-sm"><label>Custom Amount (JOD)</label><input type="number" name="amount" min="1" step="0.01" placeholder="Enter amount"></div>' +
      '<div class="step-actions mt-md">' +
      '<button class="btn btn-ghost" type="button" data-donation-back>Back</button>' +
      '<button class="btn btn-primary" type="button" data-donation-next>Continue</button>' +
      "</div>" +
      "</section>" +

      '<section class="donation-step" data-donation-step="4">' +
      '<h3 class="donation-step-title">Step 4: Sign In, Sign Up, or Continue as Guest</h3>' +
      '<div class="auth-choice-grid mt-sm">' +
      '<button type="button" class="auth-choice-card" data-auth-choice="signin"><strong>Sign In</strong><p>For returning monthly donors.</p></button>' +
      '<button type="button" class="auth-choice-card" data-auth-choice="signup"><strong>Sign Up</strong><p>Create account for recurring donations.</p></button>' +
      '<button type="button" class="auth-choice-card" data-auth-choice="guest"><strong>Continue as Guest</strong><p>One-time donation without account.</p></button>' +
      "</div>" +
      '<div class="auth-panel-shell mt-sm">' +
      '<section class="auth-panel is-active" data-auth-panel="signin">' +
      '<div class="field"><label>Account Email</label><input type="email" name="signin_email" placeholder="you@example.com"></div>' +
      '<div class="field mt-sm"><label>Password</label><input type="password" name="signin_password" placeholder="Enter password"></div>' +
      '<div class="auth-panel-actions mt-sm"><button type="button" class="btn btn-secondary" data-auth-signin>Sign In</button></div>' +
      "</section>" +
      '<section class="auth-panel" data-auth-panel="signup">' +
      '<div class="form-grid">' +
      '<div class="field"><label>First Name</label><input type="text" name="signup_first_name" placeholder="First name"></div>' +
      '<div class="field"><label>Last Name</label><input type="text" name="signup_last_name" placeholder="Last name"></div>' +
      '<div class="field"><label>Email</label><input type="email" name="signup_email" placeholder="you@example.com"></div>' +
      '<div class="field"><label>Phone</label><input type="tel" name="signup_phone" placeholder="Optional"></div>' +
      '<div class="field"><label>Password</label><input type="password" name="signup_password" placeholder="Create password"></div>' +
      '<div class="field"><label>Confirm Password</label><input type="password" name="signup_password_confirm" placeholder="Confirm password"></div>' +
      "</div>" +
      '<div class="auth-panel-actions mt-sm"><button type="button" class="btn btn-secondary" data-auth-signup>Create Account</button></div>' +
      "</section>" +
      '<section class="auth-panel" data-auth-panel="guest"><div class="guest-note"><strong>Guest flow enabled.</strong><p>Monthly subscription requires sign in or sign up.</p></div></section>' +
      '<div class="status-banner hidden mt-sm" id="donor-auth-status"></div>' +
      "</div>" +
      '<div class="step-actions mt-md">' +
      '<button class="btn btn-ghost" type="button" data-donation-back>Back</button>' +
      '<button class="btn btn-primary" type="button" data-donation-next>Continue</button>' +
      "</div>" +
      "</section>" +

      '<section class="donation-step" data-donation-step="5">' +
      '<h3 class="donation-step-title">Step 5: Payment Method</h3>' +
      '<input type="hidden" name="provider" value="">' +
      '<input type="hidden" name="payment_channel" value="">' +
      '<div class="gateway-channel-grid" data-gateway-channel-grid>' +
      '<button type="button" class="gateway-channel" data-pay-channel="card">Credit / Debit Card</button>' +
      '<button type="button" class="gateway-channel" data-pay-channel="apple_pay">Apple Pay</button>' +
      '<button type="button" class="gateway-channel" data-pay-channel="google_pay">Google Pay</button>' +
      '<button type="button" class="gateway-channel" data-pay-channel="zain_cash">Zain Cash</button>' +
      '<button type="button" class="gateway-channel" data-pay-channel="orange_money">Orange Money</button>' +
      '<button type="button" class="gateway-channel" data-pay-channel="u_wallet">UWallet</button>' +
      '<button type="button" class="gateway-channel" data-pay-channel="cliq">CliQ</button>' +
      '<button type="button" class="gateway-channel" data-pay-channel="efawateercom">eFawateercom</button>' +
      "</div>" +
      '<div class="gateway-instructions mt-md" id="gateway-instructions"></div>' +
      '<div class="gateway-card-fields mt-sm hidden" id="gateway-card-fields">' +
      '<div class="form-grid">' +
      '<div class="field"><label>Cardholder Name</label><input type="text" name="card_name" placeholder="Name on card"></div>' +
      '<div class="field"><label>Card Number</label><input type="text" name="card_number" placeholder="**** **** **** ****" autocomplete="cc-number"></div>' +
      '<div class="field"><label>Expiry</label><input type="text" name="card_expiry" placeholder="MM/YY" autocomplete="cc-exp"></div>' +
      '<div class="field"><label>CVV</label><input type="password" name="card_cvv" placeholder="***" autocomplete="cc-csc"></div>' +
      "</div>" +
      '<p class="small-note mt-sm">Production-ready card collection must use provider hosted fields/tokenization.</p>' +
      "</div>" +
      '<div class="consent-box hidden mt-md" data-recurring-consent>' +
      '<label class="consent-row"><input type="checkbox" name="recurring_consent"> I authorize recurring monthly billing until cancellation.</label>' +
      "</div>" +
      '<label class="consent-row mt-sm"><input type="checkbox" name="legal_ack" required> I agree to ENF terms and donation processing policy.</label>' +
      '<div class="step-actions mt-md">' +
      '<button class="btn btn-ghost" type="button" data-donation-back>Back</button>' +
      '<button class="btn btn-primary" type="button" data-donation-next>Continue</button>' +
      "</div>" +
      "</section>" +

      '<section class="donation-step" data-donation-step="6">' +
      '<h3 class="donation-step-title">Step 6: Confirm and Complete</h3>' +
      '<div class="integration-note">Review your selected options in the summary, then complete payment.</div>' +
      '<div class="form-grid mt-sm">' +
      '<div class="field"><label>First Name</label><input type="text" name="first_name" required placeholder="Enter your first name"></div>' +
      '<div class="field"><label>Last Name</label><input type="text" name="last_name" placeholder="Enter your last name"></div>' +
      '<div class="field"><label>Email Address</label><input type="email" name="email" required placeholder="Enter your email"></div>' +
      '<div class="field"><label>Phone Number</label><input type="tel" name="phone" placeholder="Optional"></div>' +
      '<div class="field"><label>Reference Note (Optional)</label><input type="text" name="reference_note" placeholder="Campaign or internal reference"></div>' +
      '<div class="field" style="grid-column:1/-1"><label>Message (Optional)</label><textarea name="message" placeholder="Optional dedication or note"></textarea></div>' +
      "</div>" +
      '<div class="step-actions mt-md">' +
      '<button class="btn btn-ghost" type="button" data-donation-back>Back</button>' +
      '<button class="btn btn-primary" type="submit" id="donation-submit">Complete Donation</button>' +
      '<a class="btn btn-ghost" href="' + withRoot("pages/subscription-support.html") + '">Subscription Support</a>' +
      "</div>" +
      '<div class="status-banner mt-md hidden" id="donation-status"></div>' +
      '<div class="donation-outcome-panel hidden mt-md" id="donation-outcome-panel"></div>' +
      "</section>" +
      "</form>" +
      "</article>" +

      '<aside class="surface-card reveal donation-summary">' +
      '<span class="section-kicker">Donation Summary</span>' +
      '<h3 class="section-title" style="font-size:1.35rem">Your Selection</h3>' +
      '<ul class="summary-list mt-md">' +
      '<li><span>Type</span><strong id="summary-type">Not selected yet</strong></li>' +
      '<li><span>Purpose</span><strong id="summary-purpose">Not selected yet</strong></li>' +
      '<li><span>Amount</span><strong id="summary-amount">Not selected yet</strong></li>' +
      '<li><span>Identity</span><strong id="summary-account">Not selected yet</strong></li>' +
      '<li><span>Gateway</span><strong id="summary-provider">Not selected yet</strong></li>' +
      '<li><span>Method</span><strong id="summary-channel">Not selected yet</strong></li>' +
      '<li><span>Billing</span><strong id="summary-billing">Not selected yet</strong></li>' +
      '<li><span>Status</span><strong id="summary-status">Pending</strong></li>' +
      "</ul>" +
      '<div class="integration-note mt-md"><strong>Recurring billing:</strong> monthly mode requires consent and creates subscription tracking in backend.</div>' +
      "</aside>" +
      "</div>" +
      "</section>" +
      '<div class="modal" id="efawateercom-modal" aria-hidden="true">' +
      '<div class="modal-card">' +
      '<button class="modal-close" type="button" data-efawateercom-close>×</button>' +
      '<h3 class="section-title" style="font-size:1.15rem">eFawateercom Handoff</h3>' +
      '<p class="section-subtitle">Continue payment using ENF biller details in eFawateercom flow.</p>' +
      '<div class="step-actions mt-md">' +
      '<button type="button" class="btn btn-primary" data-efawateercom-continue>Continue</button>' +
      '<button type="button" class="btn btn-ghost" data-efawateercom-close>Cancel</button>' +
      "</div>" +
      "</div>" +
      "</div>";

    initDonationFlow();
  }

  function renderDonationEducationPage() {
    root.innerHTML =
      hero({
        title: "Donation for Education Program",
        subtitle: "Support scholars directly through education-focused giving.",
        image: content.banners.donateNow,
        kicker: "Program Giving",
      }) +
      '<section class="section-space">' +
      '<div class="container surface-card reveal" style="padding:1rem">' +
      '<span class="section-kicker">Education Program</span>' +
      '<h2 class="section-title">' + (content.donationEducationProgram.heading || "Donation for Education Program") + "</h2>" +
      '<div class="rich-copy mt-md">' + (content.donationEducationProgram.descriptionHtml || "") + "</div>" +
      '<div style="display:flex;gap:.65rem;flex-wrap:wrap" class="mt-lg">' +
      '<a class="btn btn-primary" href="' + withRoot("pages/donate-now.html") + '">Donate Now</a>' +
      '<a class="btn btn-ghost" href="' + withRoot("pages/what-we-do.html") + '">See Program Scope</a>' +
      "</div>" +
      "</div>" +
      "</section>";
  }

  function renderDonationResult(type) {
    var success = type === "success";
    var title = success ? "Thank You for Your Donation" : "Donation Could Not Be Completed";
    var subtitle = success
      ? "Your contribution request was received. A confirmation has been sent to your email once payment is verified."
      : "The transaction was not completed. You can retry now or contact ENF for support.";

    root.innerHTML =
      hero({
        title: title,
        subtitle: subtitle,
        image: content.banners.donateNow,
        kicker: success ? "Donation Success" : "Donation Failed",
      }) +
      '<section class="section-space">' +
      '<div class="container surface-card reveal" style="padding:1rem">' +
      '<h2 class="section-title" style="font-size:1.45rem">' + title + "</h2>" +
      '<p class="section-subtitle">' + subtitle + "</p>" +
      '<div class="integration-note mt-md">Reference tracking should be confirmed through backend webhook events before marking donations as paid.</div>' +
      '<div style="display:flex;gap:.65rem;flex-wrap:wrap" class="mt-lg">' +
      '<a class="btn btn-primary" href="' + withRoot("pages/donate-now.html") + '">Back to Donation</a>' +
      '<a class="btn btn-ghost" href="' + withRoot("pages/subscription-support.html") + '">Subscription Support</a>' +
      "</div>" +
      "</div>" +
      "</section>";
  }

  function renderSubscriptionSupportPage() {
    root.innerHTML =
      hero({
        title: "Subscription Support",
        subtitle: "Need to update payment details, cancel recurring donations, or get help with billing?",
        image: content.banners.donateNow,
        kicker: "Recurring Billing Support",
      }) +
      '<section class="section-space">' +
      '<div class="container surface-card reveal" style="padding:1rem">' +
      '<h2 class="section-title" style="font-size:1.45rem">Manage or Cancel Subscription</h2>' +
      '<p class="section-subtitle">Use your donation reference and contact details so support can locate your subscription profile.</p>' +
      '<form class="form-grid mt-md" onsubmit="return false">' +
      '<div class="field"><label>Donation Reference</label><input type="text" placeholder="e.g. ENF-2026-000123"></div>' +
      '<div class="field"><label>Email Address</label><input type="email" placeholder="Donor email"></div>' +
      '<div class="field" style="grid-column:1/-1"><label>Request</label><textarea placeholder="Cancellation, card update, invoice copy, or payment issue"></textarea></div>' +
      '<div style="grid-column:1/-1;display:flex;gap:.65rem;flex-wrap:wrap"><button class="btn btn-primary">Submit Support Request</button><a class="btn btn-ghost" href="mailto:' + content.contact.email + '">Email Support</a></div>' +
      "</form>" +
      '<div class="integration-note mt-md"><strong>Production note:</strong> this form should post to backend ticketing/CRM endpoint for admin tracking.</div>' +
      "</div>" +
      "</section>";
  }

  function renderDonorAccountPage() {
    root.innerHTML =
      hero({
        title: "Donor Account",
        subtitle: "Sign in or create an account to manage monthly donations and recurring preferences.",
        image: content.banners.donateNow,
        kicker: "Recurring Donor Access",
      }) +
      '<section class="section-space">' +
      '<div class="container donor-account-shell">' +
      '<article class="surface-card reveal donor-auth-panel">' +
      '<span class="section-kicker">Account Access</span>' +
      '<h2 class="section-title" style="font-size:1.6rem">Sign In or Create Account</h2>' +
      '<div class="account-entry-choices mt-md">' +
      '<a class="account-entry-choice" href="' + withRoot("pages/donor-account.html?mode=signin") + '">' +
      "<strong>Sign In</strong><span>Manage recurring donations and billing preferences.</span></a>" +
      '<a class="account-entry-choice" href="' + withRoot("pages/donor-account.html?mode=signup") + '">' +
      "<strong>Sign Up</strong><span>Create your donor account for monthly giving.</span></a>" +
      '<a class="account-entry-choice" href="' + withRoot("index.html") + '">' +
      "<strong>Continue as Guest</strong><span>Enter the website and browse normally as a public visitor.</span></a>" +
      "</div>" +
      '<div class="donor-auth-tabs mt-md">' +
      '<button type="button" class="mode-pill is-active" data-donor-tab-btn="signin">Sign In</button>' +
      '<button type="button" class="mode-pill" data-donor-tab-btn="signup">Sign Up</button>' +
      "</div>" +
      '<section class="donor-auth-tab is-active mt-md" data-donor-tab="signin">' +
      '<div class="field"><label>Email</label><input type="email" data-donor-signin-email placeholder="you@example.com"></div>' +
      '<div class="field mt-sm"><label>Password</label><input type="password" data-donor-signin-password placeholder="Enter password"></div>' +
      '<button type="button" class="btn btn-primary mt-md" data-donor-signin-btn>Sign In</button>' +
      "</section>" +
      '<section class="donor-auth-tab mt-md" data-donor-tab="signup">' +
      '<div class="form-grid">' +
      '<div class="field"><label>First Name</label><input type="text" data-donor-signup-first-name></div>' +
      '<div class="field"><label>Last Name</label><input type="text" data-donor-signup-last-name></div>' +
      '<div class="field"><label>Email</label><input type="email" data-donor-signup-email></div>' +
      '<div class="field"><label>Phone</label><input type="tel" data-donor-signup-phone></div>' +
      '<div class="field"><label>Password</label><input type="password" data-donor-signup-password></div>' +
      '<div class="field"><label>Confirm Password</label><input type="password" data-donor-signup-password-confirm></div>' +
      "</div>" +
      '<button type="button" class="btn btn-primary mt-md" data-donor-signup-btn>Create Account</button>' +
      "</section>" +
      '<div class="status-banner hidden mt-md" id="donor-account-status"></div>' +
      "</article>" +
      '<aside class="surface-card reveal donor-account-info">' +
      '<span class="section-kicker">Quick Actions</span>' +
      '<h3 class="section-title" style="font-size:1.3rem">Monthly Donor Tools</h3>' +
      '<ul class="summary-list mt-md">' +
      "<li><span>Recurring profile</span><strong>Enabled after sign-in</strong></li>" +
      "<li><span>Billing support</span><strong>Subscription Support page</strong></li>" +
      "<li><span>Quick donation</span><strong>Continue to Donate Now</strong></li>" +
      "</ul>" +
      '<div class="mt-md">' +
      '<a class="btn btn-primary" href="' + withRoot("pages/donate-now.html") + '">Go to Donate Now</a>' +
      '<a class="btn btn-ghost mt-sm" href="' + withRoot("pages/subscription-support.html") + '">Subscription Support</a>' +
      "</div>" +
      "</aside>" +
      "</div>" +
      "</section>";

    initDonorAccountPage();
  }

  function renderAdminPage() {
    root.innerHTML =
      '<section class="admin-portal-shell">' +
      '<div class="admin-portal-bg"></div>' +
      '<div class="container admin-shell">' +
      '<header class="admin-portal-head reveal">' +
      '<div>' +
      '<span class="section-kicker">Internal Control Unit</span>' +
      '<h1 class="section-title" style="font-size:2rem">ENF Admin Portal</h1>' +
      "</div>" +
      '<a class="btn btn-ghost admin-return-site" href="' + withRoot("index.html") + '">Return to Public Site</a>' +
      "</header>" +
      '<article class="surface-card reveal admin-login-panel" id="admin-login-panel">' +
      '<span class="section-kicker">Secure Sign In</span>' +
      '<h2 class="section-title" style="font-size:1.5rem">Authorized Access Only</h2>' +
      '<div class="field mt-md"><label>Username</label><input type="text" id="admin-username" autocomplete="username" placeholder="username"></div>' +
      '<div class="field mt-sm"><label>Password</label><input type="password" id="admin-password" autocomplete="current-password" placeholder="Enter password"></div>' +
      '<button type="button" class="btn btn-primary mt-md" id="admin-login-btn">Enter</button>' +
      '<div class="status-banner hidden mt-md" id="admin-status"></div>' +
      "</article>" +

      '<article class="surface-card reveal admin-dashboard hidden" id="admin-dashboard">' +
      '<div class="admin-head">' +
      '<div><span class="section-kicker">Control Unit</span><h2 class="section-title" style="font-size:1.35rem">Website Content Operations</h2></div>' +
      '<button class="btn btn-ghost" type="button" id="admin-logout-btn">Logout</button>' +
      "</div>" +
      '<div class="admin-grid mt-md">' +
      '<aside class="admin-sections" id="admin-sections"></aside>' +
      '<section class="admin-editor">' +
      '<div class="field"><label>Active Section</label><input type="text" id="admin-section-key" readonly></div>' +
      '<div class="admin-editor-toolbar mt-sm">' +
      '<button type="button" class="btn btn-secondary is-mini" id="admin-load-content-btn">Reload</button>' +
      '<button type="button" class="btn btn-primary is-mini" id="admin-save-content-btn">Save</button>' +
      "</div>" +
      '<div class="admin-form-editor mt-sm" id="admin-form-editor"></div>' +
      '<div class="integration-note mt-md">Layout edits are intentionally disabled. This panel is content-only to keep public UX stable.</div>' +
      "</section>" +
      "</div>" +
      '<div class="admin-secondary-grid mt-md">' +
      '<section class="admin-analytics-panel">' +
      '<span class="section-kicker">Analytics</span>' +
      '<h3 class="section-title" style="font-size:1.05rem">Google Analytics Configuration</h3>' +
      '<p class="small-note">Script bootstrap lives in <code>assets/js/site.js</code> through <code>initGoogleAnalytics()</code>.</p>' +
      '<div class="field mt-sm"><label>GA Measurement ID</label><input type="text" id="admin-ga-id" placeholder="G-XXXXXXXXXX"></div>' +
      '<div class="small-note mt-sm" id="admin-ga-status">Status: Placeholder mode (tracking not active).</div>' +
      '<div class="admin-editor-toolbar mt-sm"><button type="button" class="btn btn-secondary is-mini" id="admin-save-ga-btn">Save Analytics Draft</button></div>' +
      '<div class="integration-note mt-sm">Reporting dashboard API is not connected yet. This card stores configuration and readiness notes.</div>' +
      "</section>" +
      '<section class="admin-media-panel">' +
      '<span class="section-kicker">Media Assets</span>' +
      '<h3 class="section-title" style="font-size:1.05rem">Photo Management Placeholder</h3>' +
      '<p class="small-note">Use image URLs for now. Drag and drop upload will connect once media backend endpoints are available.</p>' +
      '<div class="field mt-sm"><label>Temporary Upload Queue</label><input type="file" multiple disabled></div>' +
      "</section>" +
      "</div>" +
      "</article>" +
      "</div>" +
      "</section>";

    initAdminPanel();
  }

  function renderPolicyPage(type) {
    var isPrivacy = type === "privacy";
    var title = isPrivacy ? "Privacy Policy" : "Terms & Conditions";
    var bodyHtml = isPrivacy ? content.policies.privacyHtml : content.policies.termsHtml;

    root.innerHTML =
      hero({
        title: title,
        subtitle: "Legal and privacy information for ENF website users.",
        image: content.banners.mediaCenter,
      }) +
      '<section class="section-space">' +
      '<div class="container surface-card reveal" style="padding:1rem">' +
      '<h2 class="section-title">' + title + "</h2>" +
      '<div class="rich-copy mt-md">' + (bodyHtml || "") + "</div>" +
      "</div>" +
      "</section>";
  }

  function initHeroSlider() {
    var slides = Array.prototype.slice.call(document.querySelectorAll("[data-hero-slide]"));
    var dots = Array.prototype.slice.call(document.querySelectorAll("[data-hero-dot]"));
    if (!slides.length || !dots.length) return;

    var current = 0;
    var timer = null;

    function activate(index) {
      slides.forEach(function (slide, i) {
        slide.classList.toggle("is-active", i === index);
      });
      dots.forEach(function (dot, i) {
        dot.classList.toggle("is-active", i === index);
      });
      current = index;
    }

    function stop() {
      if (timer) clearInterval(timer);
    }

    function start() {
      stop();
      timer = setInterval(function () {
        activate((current + 1) % slides.length);
      }, 5200);
    }

    dots.forEach(function (dot, index) {
      dot.addEventListener("click", function () {
        activate(index);
        start();
      });
    });

    activate(0);
    start();
  }

  function initCounterAnimations() {
    var numbers = Array.prototype.slice.call(document.querySelectorAll("[data-count]"));
    if (!numbers.length) return;

    function animate(el) {
      var target = Number(el.getAttribute("data-count") || 0);
      var duration = 1200;
      var startTime = null;
      function frame(ts) {
        if (!startTime) startTime = ts;
        var progress = Math.min((ts - startTime) / duration, 1);
        el.textContent = String(Math.round(target * progress));
        if (progress < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }

    if (!("IntersectionObserver" in window)) {
      numbers.forEach(animate);
      return;
    }

    var observer = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animate(entry.target);
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 }
    );

    numbers.forEach(function (el) {
      observer.observe(el);
    });
  }

  function initWhatWeDoExperience(programs) {
    var items = Array.prototype.slice.call(document.querySelectorAll("[data-what-topic]"));
    var heroThumbs = Array.prototype.slice.call(document.querySelectorAll("[data-what-hero-thumb]"));
    var titleEl = document.getElementById("what-program-title");
    var bodyEl = document.getElementById("what-program-body");
    var imageEl = document.getElementById("what-program-image");
    var excerptEl = document.getElementById("what-program-excerpt");
    var stepEl = document.getElementById("what-program-step");
    var progressFill = document.getElementById("what-program-progress-fill");
    var prevBtn = document.querySelector("[data-what-prev]");
    var nextBtn = document.querySelector("[data-what-next]");
    var autoBtn = document.querySelector("[data-what-auto]");
    var shell = document.getElementById("what-program-shell");

    if (!items.length || !programs.length || !titleEl || !bodyEl || !imageEl) return;

    var current = 0;
    var timer = null;
    var resumeTimer = null;
    var autoplay = true;

    function stopAuto() {
      if (timer) {
        clearTimeout(timer);
      }
      timer = null;
    }

    function updateAutoUi(label) {
      if (!autoBtn) return;
      autoBtn.classList.toggle("is-active", autoplay);
      autoBtn.textContent = label;
    }

    function setActive(index, options) {
      var count = programs.length;
      var normalized = ((index % count) + count) % count;
      var program = programs[normalized];
      var preview = truncate(sanitizeText(program.excerpt || program.articleHtml || ""), 220) || "Program overview.";

      current = normalized;

      items.forEach(function (item, itemIndex) {
        var isActive = itemIndex === normalized;
        item.classList.toggle("is-active", isActive);
        item.setAttribute("aria-selected", isActive ? "true" : "false");
        item.setAttribute("tabindex", isActive ? "0" : "-1");
      });

      heroThumbs.forEach(function (thumb, thumbIndex) {
        thumb.classList.toggle("is-active", thumbIndex === normalized);
      });

      titleEl.textContent = program.title || "Program";
      bodyEl.innerHTML = program.articleHtml || "<p>" + escapeHtml(preview) + "</p>";
      if (excerptEl) {
        excerptEl.textContent = preview;
      }
      imageEl.classList.add("is-swapping");
      imageEl.src = program.image || content.banners.whatWeDo || "";
      imageEl.alt = program.title || "Program image";
      setTimeout(function () {
        imageEl.classList.remove("is-swapping");
      }, 220);

      if (stepEl) {
        stepEl.textContent = "Program " + (normalized + 1) + " / " + count;
      }
      if (progressFill) {
        var pct = count > 1 ? ((normalized + 1) / count) * 100 : 100;
        progressFill.style.width = pct + "%";
      }

      if (options && options.userTriggered) {
        pauseAutoTemporarily(9500);
      }
    }

    function startAuto() {
      if (!autoplay) return;
      stopAuto();
      timer = setTimeout(function runStep() {
        setActive(current + 1);
        if (autoplay) {
          timer = setTimeout(runStep, 5800);
        }
      }, 5800);
      updateAutoUi("Auto: On");
    }

    function pauseAutoTemporarily(delay) {
      if (!autoplay) return;
      stopAuto();
      updateAutoUi("Auto: Paused");
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(function () {
        if (autoplay) {
          startAuto();
        }
      }, delay || 9000);
    }

    function move(delta) {
      setActive(current + delta, { userTriggered: true });
    }

    items.forEach(function (item) {
      var index = Number(item.getAttribute("data-what-topic"));
      item.addEventListener("click", function () {
        setActive(index, { userTriggered: true });
      });
      item.addEventListener("mouseenter", function () {
        setActive(index, { userTriggered: true });
      });
      item.addEventListener("focus", function () {
        pauseAutoTemporarily(10000);
      });
      item.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setActive(index, { userTriggered: true });
        }
      });
    });

    heroThumbs.forEach(function (thumb) {
      var index = Number(thumb.getAttribute("data-what-hero-thumb"));
      thumb.addEventListener("click", function () {
        setActive(index, { userTriggered: true });
      });
    });

    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        move(-1);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        move(1);
      });
    }

    if (autoBtn) {
      autoBtn.addEventListener("click", function () {
        autoplay = !autoplay;
        if (!autoplay) {
          stopAuto();
          if (resumeTimer) clearTimeout(resumeTimer);
          updateAutoUi("Auto: Off");
        } else {
          startAuto();
        }
      });
    }

    if (shell) {
      shell.addEventListener("pointerdown", function () {
        pauseAutoTemporarily(11000);
      });
      shell.addEventListener(
        "wheel",
        function () {
          pauseAutoTemporarily(10000);
        },
        { passive: true }
      );
    }

    document.addEventListener("visibilitychange", function () {
      if (page !== "what-we-do") return;
      if (document.hidden) {
        stopAuto();
      } else if (autoplay) {
        startAuto();
      }
    });

    window.addEventListener("beforeunload", function () {
      stopAuto();
      if (resumeTimer) {
        clearTimeout(resumeTimer);
        resumeTimer = null;
      }
    });

    setActive(0);
    startAuto();
  }

  function initTabs(key) {
    var buttons = Array.prototype.slice.call(document.querySelectorAll('[data-tab-btn="' + key + '"]'));
    var panels = Array.prototype.slice.call(document.querySelectorAll('[data-tab-panel="' + key + '"]'));
    if (!buttons.length || !panels.length) return;

    function activate(index) {
      buttons.forEach(function (button) {
        button.classList.toggle("is-active", Number(button.getAttribute("data-tab-index")) === index);
      });
      panels.forEach(function (panel) {
        panel.classList.toggle("is-active", Number(panel.getAttribute("data-tab-index")) === index);
      });
    }

    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        activate(Number(button.getAttribute("data-tab-index")));
      });
    });
  }

  function initMediaCenterHub(payload) {
    var videos = (payload && payload.videos) || [];
    var albums = (payload && payload.albums) || [];
    var news = (payload && payload.news) || [];
    var publications = (payload && payload.publications) || [];

    function getNewsDateline(item) {
      var raw = sanitizeText((item && (item.articleHtml || item.excerpt)) || "");
      var monthMatch = raw.match(
        /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/i
      );
      if (monthMatch && monthMatch[0]) return monthMatch[0];
      var yearMatch = raw.match(/\b(19|20)\d{2}\b/);
      if (yearMatch && yearMatch[0]) return "ENF Update · " + yearMatch[0];
      return "ENF Newsroom";
    }

    var reduceMotion =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Video hub
    var videoButtons = Array.prototype.slice.call(
      document.querySelectorAll("[data-media-video-index]")
    );
    var videoLoopFrame = document.getElementById("media-video-loop-frame");
    var videoTitle = document.getElementById("media-video-title");
    var videoSource = document.getElementById("media-video-source");
    var videoWatchBtn = document.getElementById("media-video-watch-btn");
    var videoSourceLink = document.getElementById("media-video-source-link");
    var videoModal = document.getElementById("media-video-modal");
    var videoModalFrame = document.getElementById("media-video-modal-frame");
    var videoModalClose = document.querySelector("[data-media-video-close]");
    var activeVideoIndex = 0;

    function setActiveVideo(index) {
      if (!videos.length) return;
      var normalized = ((index % videos.length) + videos.length) % videos.length;
      var video = videos[normalized];
      if (!video) return;
      activeVideoIndex = normalized;
      videoButtons.forEach(function (button) {
        var isActive =
          Number(button.getAttribute("data-media-video-index")) === normalized;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-selected", isActive ? "true" : "false");
      });
      if (videoTitle) {
        videoTitle.textContent = video.title || "ENF Video";
      }
      if (videoSource) {
        videoSource.textContent = video.source || "ENF Media";
      }
      if (videoSourceLink) {
        videoSourceLink.href = ensureProtocol(video.url || "");
      }
      if (videoWatchBtn) {
        videoWatchBtn.setAttribute(
          "data-media-video-audio-url",
          buildYouTubeEmbedUrl(video.url, {
            autoplay: true,
            mute: false,
            loop: false,
            controls: true,
            hd: true,
          })
        );
      }
      if (videoLoopFrame) {
        videoLoopFrame.src = buildYouTubeEmbedUrl(video.url, {
          autoplay: true,
          mute: true,
          loop: true,
          controls: false,
        });
      }
    }

    function openVideoModal() {
      if (!videoModal || !videoModalFrame || !videoWatchBtn) return;
      var audioUrl =
        videoWatchBtn.getAttribute("data-media-video-audio-url") ||
        buildYouTubeEmbedUrl(
          videos[activeVideoIndex] ? videos[activeVideoIndex].url : "",
          {
            autoplay: true,
            mute: false,
            loop: false,
            controls: true,
            hd: true,
          }
        );
      if (!audioUrl) return;
      videoModalFrame.src = audioUrl;
      videoModal.classList.add("is-open");
      videoModal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }

    function closeVideoModal() {
      if (!videoModal || !videoModalFrame) return;
      videoModal.classList.remove("is-open");
      videoModal.setAttribute("aria-hidden", "true");
      videoModalFrame.src = "";
      document.body.style.overflow = "";
    }

    videoButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        setActiveVideo(Number(button.getAttribute("data-media-video-index")));
      });
    });
    if (videoWatchBtn) {
      videoWatchBtn.addEventListener("click", openVideoModal);
    }
    if (videoModalClose) {
      videoModalClose.addEventListener("click", closeVideoModal);
    }
    if (videoModal) {
      videoModal.addEventListener("click", function (event) {
        if (event.target === videoModal) closeVideoModal();
      });
    }
    if (videos.length) {
      setActiveVideo(0);
    }

    // Photo hub
    var albumButtons = Array.prototype.slice.call(
      document.querySelectorAll("[data-media-album-index]")
    );
    var photoImage = document.getElementById("media-photo-image");
    var photoAlbumTitle = document.getElementById("media-photo-album-title");
    var photoCounter = document.getElementById("media-photo-counter");
    var photoGrid = document.getElementById("media-photo-grid");
    var photoProgress = document.getElementById("media-photo-progress-fill");
    var photoPrev = document.querySelector("[data-media-photo-prev]");
    var photoNext = document.querySelector("[data-media-photo-next]");
    var photoOpenBtn = document.getElementById("media-photo-open");
    var photoToggleGridBtn = document.getElementById("media-photo-toggle-grid");
    var photoShell = document.getElementById("media-photo-shell");
    var photoModal = document.getElementById("media-photo-modal");
    var photoModalImage = document.getElementById("media-photo-modal-image");
    var photoModalTitle = document.getElementById("media-photo-modal-title");
    var photoModalCounter = document.getElementById("media-photo-modal-counter");
    var photoModalPrev = document.querySelector("[data-media-photo-modal-prev]");
    var photoModalNext = document.querySelector("[data-media-photo-modal-next]");
    var photoModalClose = document.querySelector("[data-media-photo-close]");
    var activeAlbumIndex = 0;
    var activePhotoIndex = 0;
    var photoTimer = null;
    var photoResumeTimer = null;

    function getCurrentAlbum() {
      return albums[activeAlbumIndex] || null;
    }

    function stopPhotoAuto() {
      if (photoTimer) clearTimeout(photoTimer);
      photoTimer = null;
    }

    function startPhotoAuto() {
      if (!albums.length || reduceMotion) return;
      stopPhotoAuto();
      photoTimer = setTimeout(function runAutoPhoto() {
        setActivePhoto(activePhotoIndex + 1);
        photoTimer = setTimeout(runAutoPhoto, 5200);
      }, 5200);
    }

    function pausePhotoAuto(delay) {
      if (!albums.length || reduceMotion) return;
      stopPhotoAuto();
      if (photoResumeTimer) clearTimeout(photoResumeTimer);
      photoResumeTimer = setTimeout(function () {
        startPhotoAuto();
      }, delay || 9000);
    }

    function updatePhotoModal() {
      if (!photoModal || !photoModalImage || !photoModalTitle || !photoModalCounter) return;
      var album = getCurrentAlbum();
      if (!album || !album.images.length) return;
      photoModalImage.src = album.images[activePhotoIndex];
      photoModalImage.alt = album.title + " photo " + (activePhotoIndex + 1);
      photoModalTitle.textContent = album.title;
      photoModalCounter.textContent = activePhotoIndex + 1 + " / " + album.images.length;
    }

    function openPhotoModal(index) {
      if (!photoModal) return;
      if (typeof index === "number") {
        setActivePhoto(index, { userTriggered: false, instant: true });
      }
      updatePhotoModal();
      photoModal.classList.add("is-open");
      photoModal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }

    function closePhotoModal() {
      if (!photoModal) return;
      photoModal.classList.remove("is-open");
      photoModal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }

    function setActivePhoto(index, options) {
      var album = getCurrentAlbum();
      if (!album || !album.images.length) return;
      var normalized = ((index % album.images.length) + album.images.length) % album.images.length;
      activePhotoIndex = normalized;
      if (photoImage) {
        photoImage.classList.add("is-swapping");
        photoImage.src = album.images[normalized];
        photoImage.alt = album.title + " photo " + (normalized + 1);
        setTimeout(function () {
          photoImage.classList.remove("is-swapping");
        }, 220);
      }
      if (photoAlbumTitle) {
        photoAlbumTitle.textContent = album.title;
      }
      if (photoCounter) {
        photoCounter.textContent = normalized + 1 + " / " + album.images.length;
      }
      if (photoProgress) {
        var pct = album.images.length > 1 ? ((normalized + 1) / album.images.length) * 100 : 100;
        photoProgress.style.width = pct + "%";
      }
      if (photoGrid) {
        var thumbs = Array.prototype.slice.call(
          photoGrid.querySelectorAll("[data-media-photo-index]")
        );
        thumbs.forEach(function (thumb) {
          var isActive =
            Number(thumb.getAttribute("data-media-photo-index")) === normalized;
          thumb.classList.toggle("is-active", isActive);
          thumb.setAttribute("aria-selected", isActive ? "true" : "false");
        });
      }
      if (options && options.userTriggered) {
        pausePhotoAuto(9500);
      }
      updatePhotoModal();
    }

    function renderPhotoGrid() {
      if (!photoGrid) return;
      var album = getCurrentAlbum();
      if (!album) {
        photoGrid.innerHTML = "";
        return;
      }
      photoGrid.innerHTML = album.images
        .map(function (image, index) {
          return (
            '<button class="media-photo-thumb ' +
            (index === activePhotoIndex ? "is-active" : "") +
            '" type="button" data-media-photo-index="' +
            index +
            '" aria-selected="' +
            (index === activePhotoIndex ? "true" : "false") +
            '">' +
            '<img src="' +
            image +
            '" alt="' +
            escapeHtml(album.title) +
            " thumbnail " +
            (index + 1) +
            '" loading="lazy">' +
            "</button>"
          );
        })
        .join("");

      Array.prototype.slice
        .call(photoGrid.querySelectorAll("[data-media-photo-index]"))
        .forEach(function (thumb) {
          thumb.addEventListener("click", function () {
            var index = Number(thumb.getAttribute("data-media-photo-index"));
            setActivePhoto(index, { userTriggered: true });
            openPhotoModal(index);
          });
        });
    }

    function setActiveAlbum(index, options) {
      if (!albums.length) return;
      var normalized = ((index % albums.length) + albums.length) % albums.length;
      activeAlbumIndex = normalized;
      activePhotoIndex = 0;
      albumButtons.forEach(function (button) {
        var isActive =
          Number(button.getAttribute("data-media-album-index")) === normalized;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-selected", isActive ? "true" : "false");
      });
      renderPhotoGrid();
      setActivePhoto(0, {
        userTriggered: options && options.userTriggered,
        instant: true,
      });
    }

    if (photoImage) {
      photoImage.addEventListener("click", function () {
        openPhotoModal(activePhotoIndex);
      });
    }
    if (photoPrev) {
      photoPrev.addEventListener("click", function () {
        setActivePhoto(activePhotoIndex - 1, { userTriggered: true });
      });
    }
    if (photoNext) {
      photoNext.addEventListener("click", function () {
        setActivePhoto(activePhotoIndex + 1, { userTriggered: true });
      });
    }
    if (photoOpenBtn) {
      photoOpenBtn.addEventListener("click", function () {
        openPhotoModal(activePhotoIndex);
      });
    }
    if (photoToggleGridBtn && photoGrid) {
      photoToggleGridBtn.addEventListener("click", function () {
        var isHidden = photoGrid.classList.toggle("is-hidden");
        photoToggleGridBtn.textContent = isHidden ? "Browse Album" : "Hide Thumbnails";
        pausePhotoAuto(10000);
      });
    }
    albumButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        setActiveAlbum(Number(button.getAttribute("data-media-album-index")), {
          userTriggered: true,
        });
        pausePhotoAuto(10000);
      });
    });
    if (photoShell) {
      photoShell.addEventListener("pointerdown", function () {
        pausePhotoAuto(10000);
      });
      photoShell.addEventListener(
        "wheel",
        function () {
          pausePhotoAuto(10000);
        },
        { passive: true }
      );
    }

    if (photoModalClose) {
      photoModalClose.addEventListener("click", closePhotoModal);
    }
    if (photoModalPrev) {
      photoModalPrev.addEventListener("click", function () {
        setActivePhoto(activePhotoIndex - 1, { userTriggered: true });
      });
    }
    if (photoModalNext) {
      photoModalNext.addEventListener("click", function () {
        setActivePhoto(activePhotoIndex + 1, { userTriggered: true });
      });
    }
    if (photoModal) {
      photoModal.addEventListener("click", function (event) {
        if (event.target === photoModal) closePhotoModal();
      });
    }

    if (albums.length) {
      setActiveAlbum(0);
      startPhotoAuto();
    }

    // News hub
    var newsButtons = Array.prototype.slice.call(
      document.querySelectorAll("[data-media-news-index]")
    );
    var newsImage = document.getElementById("media-news-image");
    var newsTitle = document.getElementById("media-news-title");
    var newsMeta = document.getElementById("media-news-meta");
    var newsExcerpt = document.getElementById("media-news-excerpt");
    var newsOpenBtn = document.getElementById("media-news-open");
    var newsFeed = document.getElementById("media-news-feed");
    var newsModal = document.getElementById("media-news-modal");
    var newsModalClose = document.querySelector("[data-media-news-close]");
    var newsModalContent = document.getElementById("media-news-modal-content");
    var activeNewsIndex = news.length ? Math.max(0, news.findIndex(function (item) {
      return !!item.featured;
    })) : 0;
    var newsTimer = null;
    var newsResumeTimer = null;

    function stopNewsAuto() {
      if (newsTimer) clearTimeout(newsTimer);
      newsTimer = null;
    }

    function startNewsAuto() {
      if (news.length < 2 || reduceMotion) return;
      stopNewsAuto();
      newsTimer = setTimeout(function runAutoNews() {
        setActiveNews(activeNewsIndex + 1);
        newsTimer = setTimeout(runAutoNews, 7200);
      }, 7200);
    }

    function pauseNewsAuto(delay) {
      if (news.length < 2 || reduceMotion) return;
      stopNewsAuto();
      if (newsResumeTimer) clearTimeout(newsResumeTimer);
      newsResumeTimer = setTimeout(function () {
        startNewsAuto();
      }, delay || 11000);
    }

    function setActiveNews(index, options) {
      if (!news.length) return;
      var normalized = ((index % news.length) + news.length) % news.length;
      var item = news[normalized];
      if (!item) return;
      activeNewsIndex = normalized;
      newsButtons.forEach(function (button) {
        var isActive =
          Number(button.getAttribute("data-media-news-index")) === normalized;
        button.classList.toggle("is-active", isActive);
      });
      if (newsImage) {
        newsImage.classList.add("is-swapping");
        newsImage.src = item.image || "";
        newsImage.alt = item.title || "ENF news";
        setTimeout(function () {
          newsImage.classList.remove("is-swapping");
        }, 220);
      }
      if (newsTitle) {
        newsTitle.textContent = item.title || "ENF News";
      }
      if (newsMeta) {
        newsMeta.textContent = getNewsDateline(item);
      }
      if (newsExcerpt) {
        newsExcerpt.textContent = truncate(
          sanitizeText(item.excerpt || item.articleHtml || ""),
          310
        );
      }
      if (newsOpenBtn) {
        newsOpenBtn.setAttribute("data-media-news-open", String(normalized));
      }
      if (options && options.userTriggered) {
        pauseNewsAuto(11000);
      }
    }

    function openNewsModal(index) {
      if (!newsModal || !newsModalContent) return;
      var item = news[index];
      if (!item) return;
      newsModalContent.innerHTML =
        '<div class="card-media" style="max-height:300px"><img src="' +
        item.image +
        '" alt="' +
        escapeHtml(item.title || "ENF news") +
        '"></div>' +
        '<span class="section-kicker mt-md">' +
        escapeHtml(getNewsDateline(item)) +
        "</span>" +
        '<h2 class="section-title mt-sm" style="font-size:1.45rem">' +
        escapeHtml(item.title || "ENF News") +
        "</h2>" +
        '<div class="rich-copy mt-md">' +
        (item.articleHtml || "<p>" + escapeHtml(item.excerpt || "") + "</p>") +
        "</div>";
      newsModal.classList.add("is-open");
      newsModal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }

    function closeNewsModal() {
      if (!newsModal) return;
      newsModal.classList.remove("is-open");
      newsModal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }

    newsButtons.forEach(function (button) {
      var index = Number(button.getAttribute("data-media-news-index"));
      button.addEventListener("click", function () {
        setActiveNews(index, { userTriggered: true });
      });
      button.addEventListener("mouseenter", function () {
        setActiveNews(index, { userTriggered: true });
      });
    });
    if (newsOpenBtn) {
      newsOpenBtn.addEventListener("click", function () {
        openNewsModal(Number(newsOpenBtn.getAttribute("data-media-news-open")));
      });
    }
    if (newsFeed) {
      newsFeed.addEventListener("pointerdown", function () {
        pauseNewsAuto(11000);
      });
      newsFeed.addEventListener(
        "wheel",
        function () {
          pauseNewsAuto(11000);
        },
        { passive: true }
      );
    }
    if (newsModalClose) {
      newsModalClose.addEventListener("click", closeNewsModal);
    }
    if (newsModal) {
      newsModal.addEventListener("click", function (event) {
        if (event.target === newsModal) closeNewsModal();
      });
    }
    if (news.length) {
      setActiveNews(activeNewsIndex || 0);
      startNewsAuto();
    }

    // Publication reader
    var pubButtons = Array.prototype.slice.call(
      document.querySelectorAll("[data-media-pub-index]")
    );
    var pubTitle = document.getElementById("media-pub-title");
    var pubSub = document.getElementById("media-pub-sub");
    var pubOpenPanel = document.getElementById("media-pub-open-panel");
    var pubPreview = document.getElementById("media-pub-preview");
    var pubPreviewImage = document.getElementById("media-pub-preview-image");
    var pubPreviewText = document.getElementById("media-pub-preview-text");
    var pubPoints = document.getElementById("media-pub-points");
    var pubSourceLink = document.getElementById("media-pub-open-source");
    var activePubIndex = 0;

    function publicationText(item) {
      var text = sanitizeText((item && item.subText) || "");
      if (!text || /download/i.test(text)) {
        return "A concise on-page snapshot of ENF publication themes, highlights, and institutional progress.";
      }
      return text;
    }

    function publicationBullets(item) {
      var title = sanitizeText((item && item.title) || "this publication");
      return [
        "Highlights from " + title + " in an easy-to-scan format.",
        "Stories of scholar development, training, and career readiness.",
        "Partnership outcomes and indicators of long-term community impact.",
      ];
    }

    function setActivePublication(index) {
      if (!publications.length) return;
      var normalized =
        ((index % publications.length) + publications.length) % publications.length;
      var publication = publications[normalized];
      if (!publication) return;
      activePubIndex = normalized;
      pubButtons.forEach(function (button) {
        var isActive =
          Number(button.getAttribute("data-media-pub-index")) === normalized;
        button.classList.toggle("is-active", isActive);
      });
      if (pubTitle) {
        pubTitle.textContent = publication.title || "Publication Reader";
      }
      if (pubSub) {
        pubSub.textContent = publicationText(publication);
      }
      if (pubSourceLink) {
        if (publication.file) {
          pubSourceLink.href = ensureProtocol(publication.file || "#");
          pubSourceLink.classList.remove("hidden");
        } else {
          pubSourceLink.classList.add("hidden");
        }
      }
      if (pubPreviewImage) {
        pubPreviewImage.src = publication.image || "";
        pubPreviewImage.alt = (publication.title || "Publication") + " cover";
      }
      if (pubPreviewText) {
        pubPreviewText.textContent = truncate(
          publicationText(publication),
          260
        );
      }
      if (pubPoints) {
        pubPoints.innerHTML = publicationBullets(publication)
          .map(function (point) {
            return "<li>" + escapeHtml(point) + "</li>";
          })
          .join("");
      }
      if (pubPreview) {
        pubPreview.classList.add("is-spotlit");
        setTimeout(function () {
          pubPreview.classList.remove("is-spotlit");
        }, 520);
      }
    }

    pubButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        setActivePublication(Number(button.getAttribute("data-media-pub-index")));
      });
    });
    if (pubOpenPanel && pubPreview) {
      pubOpenPanel.addEventListener("click", function () {
        pubPreview.classList.add("is-spotlit");
        pubPreview.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
        setTimeout(function () {
          pubPreview.classList.remove("is-spotlit");
        }, 650);
      });
    }
    if (publications.length) {
      setActivePublication(activePubIndex);
    }

    document.addEventListener("visibilitychange", function () {
      if (page !== "media-center") return;
      if (document.hidden) {
        stopPhotoAuto();
        stopNewsAuto();
      } else {
        startPhotoAuto();
        startNewsAuto();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      if (videoModal && videoModal.classList.contains("is-open")) {
        closeVideoModal();
      }
      if (photoModal && photoModal.classList.contains("is-open")) {
        closePhotoModal();
      }
      if (newsModal && newsModal.classList.contains("is-open")) {
        closeNewsModal();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (!photoModal || !photoModal.classList.contains("is-open")) return;
      if (event.key === "ArrowRight") {
        setActivePhoto(activePhotoIndex + 1, { userTriggered: true });
      }
      if (event.key === "ArrowLeft") {
        setActivePhoto(activePhotoIndex - 1, { userTriggered: true });
      }
    });

    window.addEventListener("beforeunload", function () {
      stopPhotoAuto();
      stopNewsAuto();
      if (photoResumeTimer) clearTimeout(photoResumeTimer);
      if (newsResumeTimer) clearTimeout(newsResumeTimer);
    });
  }

  function initWhoClassicTabs() {
    var shell = document.querySelector(".who-classic-tabbar");
    var buttons = Array.prototype.slice.call(document.querySelectorAll('[data-tab-btn="who-classic"]'));
    var panels = Array.prototype.slice.call(document.querySelectorAll('[data-tab-panel="who-classic"]'));
    if (!shell || !buttons.length || !panels.length) return;

    function setBarFocus(target) {
      if (!target) return;
      var shellRect = shell.getBoundingClientRect();
      var rect = target.getBoundingClientRect();
      shell.style.setProperty("--ai-x", String(rect.left - shellRect.left + rect.width / 2) + "px");
      shell.style.setProperty("--ai-w", String(rect.width) + "px");
    }

    function activate(index) {
      buttons.forEach(function (button) {
        var isActive = Number(button.getAttribute("data-tab-index")) === index;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-selected", isActive ? "true" : "false");
        button.setAttribute("tabindex", isActive ? "0" : "-1");
      });
      panels.forEach(function (panel) {
        var isActive = Number(panel.getAttribute("data-tab-index")) === index;
        panel.classList.toggle("is-active", isActive);
        panel.setAttribute("aria-hidden", isActive ? "false" : "true");
      });
      var activeButton = buttons.find(function (button) {
        return Number(button.getAttribute("data-tab-index")) === index;
      });
      if (activeButton) {
        setBarFocus(activeButton);
      }
    }

    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        activate(Number(button.getAttribute("data-tab-index")));
      });
      button.addEventListener("keydown", function (event) {
        var currentIndex = Number(button.getAttribute("data-tab-index"));
        var nextIndex = currentIndex;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          nextIndex = (currentIndex + 1) % buttons.length;
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
        } else if (event.key === "Home") {
          nextIndex = 0;
        } else if (event.key === "End") {
          nextIndex = buttons.length - 1;
        } else {
          return;
        }
        event.preventDefault();
        activate(nextIndex);
        buttons[nextIndex].focus();
      });
      button.addEventListener("mouseenter", function () {
        shell.classList.add("is-hovering");
        setBarFocus(button);
      });
      button.addEventListener("focus", function () {
        shell.classList.add("is-hovering");
        setBarFocus(button);
      });
    });

    shell.addEventListener("mousemove", function (event) {
      var rect = shell.getBoundingClientRect();
      shell.style.setProperty("--mx", String(event.clientX - rect.left) + "px");
      shell.style.setProperty("--my", String(event.clientY - rect.top) + "px");
    });

    shell.addEventListener("mouseleave", function () {
      shell.classList.remove("is-hovering");
      var active = buttons.find(function (button) {
        return button.classList.contains("is-active");
      });
      if (active) {
        setBarFocus(active);
      }
    });

    var requestedIndex = Number(getQueryParams().get("who_tab"));
    if (!Number.isFinite(requestedIndex) || requestedIndex < 0 || requestedIndex >= buttons.length) {
      requestedIndex = 0;
    }
    activate(requestedIndex);
  }

  function initTimeline(timeline) {
    var nodes = Array.prototype.slice.call(document.querySelectorAll("[data-timeline-node]"));
    var dots = Array.prototype.slice.call(document.querySelectorAll("[data-timeline-dot]"));
    var stepEl = document.getElementById("timeline-step");
    var progressFill = document.getElementById("timeline-progress-fill");
    var surface = document.getElementById("story-timeline-surface");
    var nextBtn = document.querySelector("[data-timeline-next]");
    var prevBtn = document.querySelector("[data-timeline-prev]");
    var autoBtn = document.querySelector("[data-timeline-autoplay]");

    if (!nodes.length || !timeline.length) return;

    var current = 0;
    var timer = null;
    var resumeTimer = null;
    var autoplay = true;

    function stopAuto() {
      if (timer) {
        clearTimeout(timer);
      }
      timer = null;
    }

    function updateAutoUi(stateText) {
      if (!autoBtn) return;
      autoBtn.classList.toggle("is-active", autoplay);
      autoBtn.textContent = stateText;
    }

    function setActive(index, options) {
      var count = nodes.length;
      if (!count) return;
      var normalized = ((index % count) + count) % count;
      current = normalized;

      nodes.forEach(function (node, i) {
        var isActive = i === normalized;
        node.classList.toggle("is-active", isActive);
        node.setAttribute("aria-current", isActive ? "true" : "false");
        node.setAttribute("tabindex", isActive ? "0" : "-1");
      });

      dots.forEach(function (dot, i) {
        var isActive = i === normalized;
        dot.classList.toggle("is-active", isActive);
        dot.setAttribute("aria-pressed", isActive ? "true" : "false");
      });

      if (stepEl) {
        stepEl.textContent = "Milestone " + (normalized + 1) + " / " + count;
      }

      if (progressFill) {
        var pct = count > 1 ? (normalized / (count - 1)) * 100 : 100;
        progressFill.style.width = pct + "%";
      }

      if (!options || options.scroll !== false) {
        nodes[normalized].scrollIntoView({
          behavior: options && options.instant ? "auto" : "smooth",
          block: "center",
        });
      }
    }

    function startAuto() {
      if (!autoplay) return;
      stopAuto();
      timer = setTimeout(function runAutoStep() {
        setActive(current + 1);
        if (autoplay) {
          timer = setTimeout(runAutoStep, 4600);
        }
      }, 4600);
      updateAutoUi("Auto: On");
    }

    function pauseAutoTemporarily(delay) {
      if (!autoplay) return;
      stopAuto();
      updateAutoUi("Auto: Paused");
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = setTimeout(function () {
        if (autoplay) {
          startAuto();
        }
      }, delay || 9000);
    }

    function move(delta) {
      setActive(current + delta);
      pauseAutoTemporarily(10000);
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        move(1);
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        move(-1);
      });
    }

    if (autoBtn) {
      autoBtn.addEventListener("click", function () {
        autoplay = !autoplay;
        if (!autoplay) {
          stopAuto();
          if (resumeTimer) clearTimeout(resumeTimer);
          updateAutoUi("Auto: Off");
        } else {
          startAuto();
        }
      });
    }

    nodes.forEach(function (node) {
      var idx = Number(node.getAttribute("data-timeline-node"));
      node.addEventListener("click", function () {
        setActive(idx);
        pauseAutoTemporarily(11000);
      });
      node.addEventListener("focus", function () {
        pauseAutoTemporarily(12000);
      });
      node.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setActive(idx);
          pauseAutoTemporarily(12000);
        }
      });
    });

    dots.forEach(function (dot) {
      var idx = Number(dot.getAttribute("data-timeline-dot"));
      dot.addEventListener("click", function () {
        setActive(idx);
        pauseAutoTemporarily(11000);
      });
    });

    if (surface) {
      surface.addEventListener("pointerdown", function () {
        pauseAutoTemporarily(12000);
      });
      surface.addEventListener("focusin", function () {
        pauseAutoTemporarily(12000);
      });
      surface.addEventListener(
        "wheel",
        function () {
          pauseAutoTemporarily(12000);
        },
        { passive: true }
      );
    }

    document.addEventListener("visibilitychange", function () {
      if (page !== "our-story") return;
      if (document.hidden) {
        stopAuto();
      } else if (autoplay) {
        startAuto();
      }
    });

    window.addEventListener("blur", function () {
      if (page !== "our-story") return;
      stopAuto();
    });

    window.addEventListener("focus", function () {
      if (page !== "our-story") return;
      if (autoplay) {
        startAuto();
      }
    });

    window.addEventListener("beforeunload", function () {
      stopAuto();
      if (resumeTimer) {
        clearTimeout(resumeTimer);
        resumeTimer = null;
      }
    });

    document.addEventListener("keydown", function (event) {
      if (page !== "our-story") return;
      if (event.key === "ArrowRight") {
        move(1);
      }
      if (event.key === "ArrowLeft") {
        move(-1);
      }
    });

    setActive(0, { scroll: false, instant: true });
    startAuto();
  }

  function initStoryModal(stories) {
    var modal = document.getElementById("story-modal");
    var contentArea = document.getElementById("story-modal-content");
    var closeButton = modal ? modal.querySelector("[data-modal-close]") : null;
    var openButtons = Array.prototype.slice.call(document.querySelectorAll("[data-story-open]"));

    if (!modal || !contentArea || !openButtons.length) return;

    function openStory(index) {
      var story = stories[index];
      if (!story) return;
      contentArea.innerHTML =
        '<div class="card-media" style="max-height:300px"><img src="' + story.image + '" alt="' + escapeHtml(story.title) + '"></div>' +
        '<h2 class="section-title mt-md" style="font-size:1.5rem">' + story.title + "</h2>" +
        '<p class="section-subtitle">' + (story.designation || "ENF Fellow") + "</p>" +
        '<div class="rich-copy mt-md">' + (story.articleHtml || "<p>" + story.excerpt + "</p>") + "</div>";
      modal.classList.add("is-open");
      document.body.style.overflow = "hidden";
    }

    function closeModal() {
      modal.classList.remove("is-open");
      document.body.style.overflow = "";
    }

    openButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        openStory(Number(button.getAttribute("data-story-open")));
      });
    });

    if (closeButton) {
      closeButton.addEventListener("click", closeModal);
    }

    modal.addEventListener("click", function (event) {
      if (event.target === modal) closeModal();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeModal();
    });
  }

  function initHomeVideoModal(videoUrl) {
    var openButton = document.querySelector("[data-open-story-video]");
    var modal = document.getElementById("home-video-modal");
    var closeButton = document.querySelector("[data-home-video-close]");
    var frame = document.getElementById("home-video-frame");
    if (!openButton || !modal || !closeButton || !frame) return;

    var expandedUrl = buildYouTubeEmbedUrl(videoUrl, {
      autoplay: true,
      mute: false,
      loop: false,
      controls: true,
      hd: true,
    });

    if (!expandedUrl) {
      openButton.classList.add("hidden");
      return;
    }

    function openModal() {
      frame.src = expandedUrl;
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }

    function closeModal() {
      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");
      frame.src = "";
      document.body.style.overflow = "";
    }

    openButton.addEventListener("click", openModal);
    closeButton.addEventListener("click", closeModal);
    modal.addEventListener("click", function (event) {
      if (event.target === modal) closeModal();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && modal.classList.contains("is-open")) {
        closeModal();
      }
    });
  }

  function initHomeIntroOverlay() {
    if (page !== "home") return;
    if (getQueryParams().has("admin_preview")) return;

    var params = getQueryParams();
    var introParam = (params.get("intro") || "").toLowerCase();
    var forceIntro = introParam === "1" || introParam === "on" || introParam === "force";
    if (introParam === "0" || introParam === "off") return;
    if (!forceIntro && hasSiteEntered()) return;

    var shell = document.createElement("section");
    shell.className = "home-intro-overlay is-visible is-off";
    shell.setAttribute("aria-label", "ENF auth opening");
    shell.innerHTML =
      '<div class="home-intro-backdrop"></div>' +
      '<img class="home-intro-watermark" src="' + content.branding.headerLogo + '" alt="" aria-hidden="true">' +
      '<div class="home-intro-center">' +
      '<div class="home-intro-scene">' +
      '<div class="home-intro-wire" aria-hidden="true"></div>' +
      '<button class="home-intro-bulb" type="button" data-intro-bulb aria-label="Toggle light bulb">' +
      '<span class="home-intro-bulb-glow" aria-hidden="true"></span>' +
      '<span class="home-intro-bulb-core" aria-hidden="true"></span>' +
      "</button>" +
      '<div class="home-intro-logo-wrap">' +
      '<img class="home-intro-logo" src="' + content.branding.headerLogo + '" alt="' + escapeHtml(content.branding.siteName) + '">' +
      "</div>" +
      '<div class="home-intro-auth-stage" data-intro-auth>' +
      '<div class="home-intro-auth-grid">' +
      '<button type="button" class="home-intro-auth-card" data-entry-action="signin"><strong>Sign In</strong><span>Access your donor account.</span></button>' +
      '<button type="button" class="home-intro-auth-card" data-entry-action="signup"><strong>Sign Up</strong><span>Create your donor profile.</span></button>' +
      '<button type="button" class="home-intro-auth-card" data-entry-action="guest"><strong>Continue as Guest</strong><span>Enter website and browse normally.</span></button>' +
      "</div>" +
      '<div class="home-intro-inline-auth hidden" id="home-intro-inline-auth"></div>' +
      '<div class="status-banner hidden mt-sm" id="home-intro-auth-status"></div>' +
      "</div>" +
      "</div>" +
      '<div class="home-intro-controls">' +
      '<button type="button" class="home-intro-toggle is-active" data-intro-on>Turn On</button>' +
      '<button type="button" class="home-intro-toggle" data-intro-off>Turn Off</button>' +
      "</div>" +
      '<p class="home-intro-caption">Toggle the ENF light and choose how to continue.</p>' +
      "</div>";

    document.body.classList.add("intro-gated");
    document.body.appendChild(shell);

    var bulbButton = shell.querySelector("[data-intro-bulb]");
    var turnOnButton = shell.querySelector("[data-intro-on]");
    var turnOffButton = shell.querySelector("[data-intro-off]");
    var authButtons = Array.prototype.slice.call(shell.querySelectorAll("[data-entry-action]"));
    var authInlinePanel = shell.querySelector("#home-intro-inline-auth");
    var authStatusBox = shell.querySelector("#home-intro-auth-status");
    var apiBase = getApiBaseUrl();

    function showAuthStatus(message, kind) {
      if (!authStatusBox) return;
      authStatusBox.textContent = message;
      authStatusBox.classList.remove("hidden", "is-error", "is-success");
      authStatusBox.classList.add(kind === "error" ? "is-error" : "is-success");
    }

    function clearAuthStatus() {
      if (!authStatusBox) return;
      authStatusBox.textContent = "";
      authStatusBox.classList.add("hidden");
      authStatusBox.classList.remove("is-error", "is-success");
    }

    function setLight(isOn) {
      shell.classList.toggle("is-off", !isOn);
      shell.classList.toggle("is-lit", isOn);
      if (turnOnButton) turnOnButton.classList.toggle("is-active", isOn);
      if (turnOffButton) turnOffButton.classList.toggle("is-active", !isOn);
    }

    function releaseIntro() {
      shell.classList.add("is-exit");
      setTimeout(function () {
        if (shell.parentNode) shell.parentNode.removeChild(shell);
        document.body.classList.remove("intro-gated");
      }, 420);
    }

    if (bulbButton) {
      bulbButton.addEventListener("click", function () {
        var shouldLight = shell.classList.contains("is-off");
        setLight(shouldLight);
      });
    }

    if (turnOnButton) {
      turnOnButton.addEventListener("click", function () {
        setLight(true);
      });
    }

    if (turnOffButton) {
      turnOffButton.addEventListener("click", function () {
        setLight(false);
      });
    }

    function createAuthPanel(mode) {
      if (!authInlinePanel) return;
      clearAuthStatus();
      authInlinePanel.classList.remove("hidden");
      if (mode === "signin") {
        authInlinePanel.innerHTML =
          '<div class="form-grid">' +
          '<div class="field"><label>Email</label><input type="email" data-intro-signin-email placeholder="you@example.com"></div>' +
          '<div class="field"><label>Password</label><input type="password" data-intro-signin-password placeholder="Password"></div>' +
          "</div>" +
          '<div class="step-actions mt-sm">' +
          '<button type="button" class="btn btn-secondary" data-intro-signin-submit>Sign In</button>' +
          '<button type="button" class="btn btn-ghost" data-intro-cancel-auth>Cancel</button>' +
          "</div>";
      } else {
        authInlinePanel.innerHTML =
          '<div class="form-grid">' +
          '<div class="field"><label>First Name</label><input type="text" data-intro-signup-first></div>' +
          '<div class="field"><label>Last Name</label><input type="text" data-intro-signup-last></div>' +
          '<div class="field"><label>Email</label><input type="email" data-intro-signup-email></div>' +
          '<div class="field"><label>Phone</label><input type="tel" data-intro-signup-phone></div>' +
          '<div class="field"><label>Password</label><input type="password" data-intro-signup-password></div>' +
          '<div class="field"><label>Confirm Password</label><input type="password" data-intro-signup-confirm></div>' +
          "</div>" +
          '<div class="step-actions mt-sm">' +
          '<button type="button" class="btn btn-secondary" data-intro-signup-submit>Sign Up</button>' +
          '<button type="button" class="btn btn-ghost" data-intro-cancel-auth>Cancel</button>' +
          "</div>";
      }

      var cancelBtn = authInlinePanel.querySelector("[data-intro-cancel-auth]");
      if (cancelBtn) {
        cancelBtn.addEventListener("click", function () {
          authInlinePanel.classList.add("hidden");
          authInlinePanel.innerHTML = "";
        });
      }

      var parseResponse = function (response) {
        return response
          .json()
          .catch(function () {
            return {};
          })
          .then(function (data) {
            if (!response.ok) {
              throw new Error((data && data.detail) || "Request failed.");
            }
            return data;
          });
      };

      var signInSubmit = authInlinePanel.querySelector("[data-intro-signin-submit]");
      if (signInSubmit) {
        signInSubmit.addEventListener("click", function () {
          var email = (authInlinePanel.querySelector("[data-intro-signin-email]") || {}).value || "";
          var password = (authInlinePanel.querySelector("[data-intro-signin-password]") || {}).value || "";
          if (!email.trim() || !password.trim()) {
            showAuthStatus("Please enter email and password.", "error");
            return;
          }
          signInSubmit.disabled = true;
          signInSubmit.textContent = "Signing In...";
          fetch(apiBase + "/auth/sign-in", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: email.trim(), password: password.trim() }),
          })
            .then(parseResponse)
            .then(function (result) {
              setDonorSession({ token: result.token, profile: result.profile });
              showAuthStatus("Sign in successful. Entering website...", "success");
              markSiteEntered();
              setTimeout(releaseIntro, 650);
            })
            .catch(function (error) {
              if (isConnectionFailure(error && error.message) || isLocalPreviewRuntime()) {
                try {
                  var demoResult = demoSignInDonor({ email: email.trim(), password: password.trim() });
                  setDonorSession({ token: demoResult.token, profile: demoResult.profile });
                  showAuthStatus("Sign in successful (local demo). Entering website...", "success");
                  markSiteEntered();
                  setTimeout(releaseIntro, 650);
                  return;
                } catch (demoError) {
                  showAuthStatus("Sign in failed. " + demoError.message, "error");
                  return;
                }
              }
              showAuthStatus("Sign in failed. " + error.message, "error");
            })
            .finally(function () {
              signInSubmit.disabled = false;
              signInSubmit.textContent = "Sign In";
            });
        });
      }

      var signUpSubmit = authInlinePanel.querySelector("[data-intro-signup-submit]");
      if (signUpSubmit) {
        signUpSubmit.addEventListener("click", function () {
          var firstName = (authInlinePanel.querySelector("[data-intro-signup-first]") || {}).value || "";
          var lastName = (authInlinePanel.querySelector("[data-intro-signup-last]") || {}).value || "";
          var email = (authInlinePanel.querySelector("[data-intro-signup-email]") || {}).value || "";
          var phone = (authInlinePanel.querySelector("[data-intro-signup-phone]") || {}).value || "";
          var password = (authInlinePanel.querySelector("[data-intro-signup-password]") || {}).value || "";
          var confirm = (authInlinePanel.querySelector("[data-intro-signup-confirm]") || {}).value || "";
          if (!firstName.trim() || !email.trim() || !password.trim()) {
            showAuthStatus("First name, email, and password are required.", "error");
            return;
          }
          if (password.trim().length < 8) {
            showAuthStatus("Password must be at least 8 characters.", "error");
            return;
          }
          if (password.trim() !== confirm.trim()) {
            showAuthStatus("Password confirmation does not match.", "error");
            return;
          }
          signUpSubmit.disabled = true;
          signUpSubmit.textContent = "Creating...";
          fetch(apiBase + "/auth/sign-up", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              first_name: firstName.trim(),
              last_name: lastName.trim() || null,
              email: email.trim(),
              phone: phone.trim() || null,
              password: password.trim(),
            }),
          })
            .then(parseResponse)
            .then(function (result) {
              setDonorSession({ token: result.token, profile: result.profile });
              showAuthStatus("Sign up successful. Entering website...", "success");
              markSiteEntered();
              setTimeout(releaseIntro, 650);
            })
            .catch(function (error) {
              if (isConnectionFailure(error && error.message) || isLocalPreviewRuntime()) {
                try {
                  var demoResult = demoCreateDonor({
                    first_name: firstName.trim(),
                    last_name: lastName.trim() || null,
                    email: email.trim(),
                    phone: phone.trim() || null,
                    password: password.trim(),
                  });
                  setDonorSession({ token: demoResult.token, profile: demoResult.profile });
                  showAuthStatus("Sign up successful (local demo). Entering website...", "success");
                  markSiteEntered();
                  setTimeout(releaseIntro, 650);
                  return;
                } catch (demoError) {
                  showAuthStatus("Sign up failed. " + demoError.message, "error");
                  return;
                }
              }
              showAuthStatus("Sign up failed. " + error.message, "error");
            })
            .finally(function () {
              signUpSubmit.disabled = false;
              signUpSubmit.textContent = "Sign Up";
            });
        });
      }
    }

    authButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        var action = button.getAttribute("data-entry-action");
        if (action === "guest") {
          showAuthStatus("Entering website as guest...", "success");
          markSiteEntered();
          setTimeout(releaseIntro, 420);
          return;
        }
        createAuthPanel(action);
      });
    });

    setLight(false);
  }

  function initScrollProgress() {
    var bar = document.getElementById("scroll-progress");
    if (!bar) return;

    function update() {
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var pct = max > 0 ? (window.scrollY / max) * 100 : 0;
      bar.style.width = pct + "%";
    }

    window.addEventListener("scroll", update, { passive: true });
    update();
  }

  function initReveal() {
    var targets = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
    if (!targets.length) return;

    if (!("IntersectionObserver" in window)) {
      targets.forEach(function (target) {
        target.classList.add("in-view");
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );

    targets.forEach(function (target) {
      observer.observe(target);
    });
  }

  function initInteractiveCards() {
    return;
  }

  function initHeroParallax() {
    var heroBackgrounds = Array.prototype.slice.call(document.querySelectorAll(".page-hero-bg"));
    if (!heroBackgrounds.length) return;

    function update() {
      var offset = Math.min(window.scrollY, 280);
      heroBackgrounds.forEach(function (item) {
        item.style.transform = "translate3d(0," + String(offset * -0.12) + "px,0) scale(1.08)";
      });
    }

    window.addEventListener("scroll", update, { passive: true });
    update();
  }

  function initDonationFlow() {
    var form = document.getElementById("donation-form");
    if (!form) return;

    var apiBase = getApiBaseUrl();
    var categoryLookup = {};
    (content.donate.serviceCategories || []).forEach(function (item) {
      var amount = parseAmount(item.amount);
      if (!amount) return;
      categoryLookup[String(amount)] = item.code;
    });

    var stepNavButtons = Array.prototype.slice.call(document.querySelectorAll("[data-donation-step-nav]"));
    var stepPanels = Array.prototype.slice.call(document.querySelectorAll("[data-donation-step]"));
    var nextButtons = Array.prototype.slice.call(document.querySelectorAll("[data-donation-next]"));
    var backButtons = Array.prototype.slice.call(document.querySelectorAll("[data-donation-back]"));
    var modeButtons = Array.prototype.slice.call(document.querySelectorAll("[data-donate-mode]"));
    var authChoiceButtons = Array.prototype.slice.call(document.querySelectorAll("[data-auth-choice]"));
    var authPanels = Array.prototype.slice.call(document.querySelectorAll("[data-auth-panel]"));
    var planCards = Array.prototype.slice.call(document.querySelectorAll("[data-plan]"));
    var channelButtons = Array.prototype.slice.call(document.querySelectorAll("[data-pay-channel]"));
    var amountButtons = Array.prototype.slice.call(document.querySelectorAll("[data-amount]"));

    var amountInput = form.querySelector('[name="amount"]');
    var purposeSelect = form.querySelector('[name="purpose"]');
    var serviceInput = form.querySelector('[name="service_code"]');
    var categoryInput = form.querySelector('[name="category_code"]');
    var providerInput = form.querySelector('[name="provider"]');
    var paymentChannelInput = form.querySelector('[name="payment_channel"]');
    var legalAck = form.querySelector('[name="legal_ack"]');
    var consentWrap = document.querySelector("[data-recurring-consent]");
    var consentInput = form.querySelector('[name="recurring_consent"]');
    var modeNote = document.querySelector("[data-mode-note]");
    var statusBox = document.getElementById("donation-status");
    var authStatusBox = document.getElementById("donor-auth-status");
    var submitBtn = document.getElementById("donation-submit");
    var signInButton = document.querySelector("[data-auth-signin]");
    var signUpButton = document.querySelector("[data-auth-signup]");
    var outcomePanel = document.getElementById("donation-outcome-panel");
    var gatewayInstructions = document.getElementById("gateway-instructions");
    var cardFields = document.getElementById("gateway-card-fields");

    var summaryType = document.getElementById("summary-type");
    var summaryAmount = document.getElementById("summary-amount");
    var summaryAccount = document.getElementById("summary-account");
    var summaryPurpose = document.getElementById("summary-purpose");
    var summaryProvider = document.getElementById("summary-provider");
    var summaryChannel = document.getElementById("summary-channel");
    var summaryBilling = document.getElementById("summary-billing");
    var summaryStatus = document.getElementById("summary-status");

    var signInEmailInput = form.querySelector('[name="signin_email"]');
    var signInPasswordInput = form.querySelector('[name="signin_password"]');
    var signUpFirstNameInput = form.querySelector('[name="signup_first_name"]');
    var signUpLastNameInput = form.querySelector('[name="signup_last_name"]');
    var signUpEmailInput = form.querySelector('[name="signup_email"]');
    var signUpPhoneInput = form.querySelector('[name="signup_phone"]');
    var signUpPasswordInput = form.querySelector('[name="signup_password"]');
    var signUpPasswordConfirmInput = form.querySelector('[name="signup_password_confirm"]');

    var efModal = document.getElementById("efawateercom-modal");
    var efCloseButtons = Array.prototype.slice.call(document.querySelectorAll("[data-efawateercom-close]"));
    var efContinueButton = document.querySelector("[data-efawateercom-continue]");

    var state = {
      mode: "",
      step: 1,
      maxUnlockedStep: 1,
      completed: { 1: false, 2: false, 3: false, 4: false, 5: false },
      amount: 0,
      planId: "",
      authFlow: "",
      paymentChannel: "",
      donorSession: getDonorSession(),
      donorProfile: null,
      walletSupported: !!window.PaymentRequest,
      applePaySupported: !!window.ApplePaySession,
      purposeLabel: "",
      paymentStatus: "Pending",
    };

    var channelLabelMap = {
      card: "Credit / Debit Card",
      apple_pay: "Apple Pay",
      google_pay: "Google Pay",
      zain_cash: "Zain Cash",
      orange_money: "Orange Money",
      u_wallet: "UWallet",
      cliq: "CliQ",
      efawateercom: "eFawateercom",
    };

    var channelInstructions = {
      card: "Pay securely using tokenized card fields (provider hosted fields in production).",
      apple_pay: state.applePaySupported
        ? "Apple Pay is supported on this device. Continue through wallet authorization."
        : "Apple Pay is unavailable on this device/browser.",
      google_pay: state.walletSupported
        ? "Google Pay is supported on this browser. Continue through wallet authorization."
        : "Google Pay is unavailable on this device/browser.",
      zain_cash: "You will be handed to Zain Cash payment continuation flow after checkout initialization.",
      orange_money: "You will be handed to Orange Money payment continuation flow after checkout initialization.",
      u_wallet: "You will be handed to UWallet continuation flow after checkout initialization.",
      cliq: "Use ENF CliQ alias/request-to-pay flow and confirm settlement before success.",
      efawateercom: "Open eFAWATEERcom bill-payment handoff and complete payment there.",
    };

    var channelProviders = {
      card: "paytabs",
      apple_pay: "paytabs",
      google_pay: "paytabs",
      zain_cash: "aps",
      orange_money: "aps",
      u_wallet: "aps",
      cliq: "aps",
      efawateercom: "aps",
    };

    var channelKinds = {
      card: "direct",
      apple_pay: "wallet",
      google_pay: "wallet",
      zain_cash: "handoff",
      orange_money: "handoff",
      u_wallet: "handoff",
      cliq: "qr",
      efawateercom: "bill",
    };

    function setStatus(message, kind) {
      if (!statusBox) return;
      statusBox.textContent = message;
      statusBox.classList.remove("hidden", "is-error", "is-success");
      statusBox.classList.add(kind === "error" ? "is-error" : "is-success");
    }

    function clearStatus() {
      if (!statusBox) return;
      statusBox.classList.add("hidden");
      statusBox.classList.remove("is-error", "is-success");
      statusBox.textContent = "";
    }

    function setAuthStatus(message, kind) {
      if (!authStatusBox) return;
      authStatusBox.textContent = message;
      authStatusBox.classList.remove("hidden", "is-error", "is-success");
      authStatusBox.classList.add(kind === "error" ? "is-error" : "is-success");
    }

    function clearAuthStatus() {
      if (!authStatusBox) return;
      authStatusBox.classList.add("hidden");
      authStatusBox.classList.remove("is-error", "is-success");
      authStatusBox.textContent = "";
    }

    function ensureStepUnlock(step) {
      state.maxUnlockedStep = Math.max(state.maxUnlockedStep, Math.min(6, step));
    }

    function showStep(step) {
      state.step = Math.max(1, Math.min(6, step));
      stepPanels.forEach(function (panel) {
        panel.classList.toggle("is-active", Number(panel.getAttribute("data-donation-step")) === state.step);
      });
      stepNavButtons.forEach(function (button) {
        var buttonStep = Number(button.getAttribute("data-donation-step-nav"));
        button.classList.toggle("is-active", buttonStep === state.step);
        button.classList.toggle("is-locked", buttonStep > state.maxUnlockedStep);
        button.classList.toggle("is-complete", buttonStep < state.step && !!state.completed[buttonStep]);
      });
    }

    function autoSelectCategory() {
      if (!categoryInput) return;
      var key = String(Math.round(state.amount));
      categoryInput.value = categoryLookup[key] ? String(categoryLookup[key]) : "";
    }

    function receiptText(reference) {
      var text = "ENF Donation Receipt\n";
      text += "Reference: " + reference + "\n";
      text += "Type: " + (state.mode === "monthly" ? "Monthly Subscription" : "One-Time Donation") + "\n";
      text += "Amount: " + formatJod(state.amount) + "\n";
      text += "Method: " + (channelLabelMap[state.paymentChannel] || state.paymentChannel) + "\n";
      text += "Generated: " + new Date().toISOString() + "\n";
      return text;
    }

    function downloadReceipt(reference) {
      var blob = new Blob([receiptText(reference)], { type: "text/plain;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url;
      a.download = "enf-receipt-" + reference + ".txt";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    function updateSummary() {
      if (summaryType) {
        summaryType.textContent = state.completed[1]
          ? (state.mode === "monthly" ? "Monthly Subscription" : "One-Time Donation")
          : "Not selected yet";
      }
      if (summaryPurpose) {
        summaryPurpose.textContent = state.completed[2] && state.purposeLabel ? state.purposeLabel : "Not selected yet";
      }
      if (summaryAmount) {
        summaryAmount.textContent = state.completed[3] && state.amount > 0 ? formatJod(state.amount) : "Not selected yet";
      }
      if (summaryAccount) {
        if (!state.completed[4]) {
          summaryAccount.textContent = "Not selected yet";
        } else if (state.authFlow === "guest") {
          summaryAccount.textContent = "Continue as Guest";
        } else if (state.authFlow === "signup") {
          summaryAccount.textContent = "New Donor Account";
        } else {
          summaryAccount.textContent = "Signed In Account";
        }
      }
      if (summaryProvider) {
        summaryProvider.textContent = state.completed[5]
          ? ((providerInput && providerInput.value === "aps") ? "Amazon Payment Services" : "PayTabs")
          : "Not selected yet";
      }
      if (summaryChannel) {
        summaryChannel.textContent = state.completed[5] ? (channelLabelMap[state.paymentChannel] || "Not selected yet") : "Not selected yet";
      }
      if (summaryBilling) {
        summaryBilling.textContent = state.completed[1]
          ? (state.mode === "monthly" ? "Charged monthly until cancelled" : "Single charge")
          : "Not selected yet";
      }
      if (summaryStatus) {
        summaryStatus.textContent = state.paymentStatus || "Pending";
      }
    }

    function updateGatewayInstructions() {
      if (!state.paymentChannel) {
        if (gatewayInstructions) {
          gatewayInstructions.innerHTML = '<div class="integration-note">Select a payment method to continue.</div>';
        }
        if (cardFields) cardFields.classList.add("hidden");
        if (providerInput) providerInput.value = "";
        return;
      }
      if (gatewayInstructions) {
        gatewayInstructions.innerHTML =
          '<div class="integration-note"><strong>' +
          escapeHtml(channelLabelMap[state.paymentChannel] || "Payment") +
          ":</strong> " +
          escapeHtml(channelInstructions[state.paymentChannel] || "Follow secure payment continuation steps.") +
          "</div>";
      }
      if (cardFields) {
        cardFields.classList.toggle("hidden", state.paymentChannel !== "card");
      }
      if (providerInput) {
        providerInput.value = channelProviders[state.paymentChannel] || "paytabs";
      }
    }

    function setAuthFlow(flow) {
      state.authFlow = flow;
      authChoiceButtons.forEach(function (button) {
        button.classList.toggle("is-active", button.getAttribute("data-auth-choice") === flow);
      });
      authPanels.forEach(function (panel) {
        panel.classList.toggle("is-active", panel.getAttribute("data-auth-panel") === flow);
      });
      if (flow === "guest" && state.mode === "monthly") {
        setMode("one_time");
        setStatus("Guest checkout supports one-time donations only.", "error");
      }
      state.completed[4] = flow === "guest";
      updateSummary();
    }

    function setMode(mode) {
      state.mode = mode;
      modeButtons.forEach(function (button) {
        button.classList.toggle("is-active", button.getAttribute("data-donate-mode") === mode);
      });
      if (consentWrap) {
        consentWrap.classList.toggle("hidden", mode !== "monthly");
      }
      if (modeNote) {
        modeNote.textContent =
          mode === "monthly"
            ? "Monthly subscriptions renew automatically until cancellation is requested."
            : "One-time donations are charged once through secure checkout.";
      }
      if (mode === "monthly" && state.authFlow === "guest") {
        setAuthFlow("signin");
      }
      if (mode !== "monthly") {
        state.planId = "";
        if (consentInput) consentInput.checked = false;
        planCards.forEach(function (card) {
          card.classList.remove("is-active");
        });
      }
      state.completed[1] = !!mode;
      ensureStepUnlock(state.completed[1] ? 2 : 1);
      updateSummary();
    }

    function applyDonorProfile(profile) {
      if (!profile) return;
      state.donorProfile = profile;
      var firstNameInput = form.querySelector('[name="first_name"]');
      var lastNameInput = form.querySelector('[name="last_name"]');
      var emailInput = form.querySelector('[name="email"]');
      var phoneInput = form.querySelector('[name="phone"]');
      if (firstNameInput && !firstNameInput.value) firstNameInput.value = profile.first_name || "";
      if (lastNameInput && !lastNameInput.value) lastNameInput.value = profile.last_name || "";
      if (emailInput && !emailInput.value) emailInput.value = profile.email || "";
      if (phoneInput && !phoneInput.value) phoneInput.value = profile.phone || "";
    }

    function validateStep(step) {
      if (step === 1) {
        if (!state.mode) {
          setStatus("Please choose donation type.", "error");
          return false;
        }
        state.completed[1] = true;
        ensureStepUnlock(2);
        return true;
      }
      if (step === 2) {
        if (!purposeSelect || !purposeSelect.value) {
          setStatus("Please choose donation purpose.", "error");
          return false;
        }
        state.completed[2] = true;
        ensureStepUnlock(3);
        return true;
      }
      if (step === 3) {
        if (!(state.amount > 0)) {
          setStatus("Please select or enter a valid donation amount.", "error");
          return false;
        }
        state.completed[3] = true;
        ensureStepUnlock(4);
        return true;
      }
      if (step === 4) {
        if (!state.authFlow) {
          setStatus("Please choose Sign In, Sign Up, or Continue as Guest.", "error");
          return false;
        }
        if (state.mode === "monthly" && state.authFlow === "guest") {
          setStatus("Monthly subscriptions require sign in or sign up.", "error");
          return false;
        }
        if (state.mode === "monthly" && !state.donorSession && state.authFlow !== "guest") {
          setStatus("Please complete sign in or sign up for monthly subscriptions.", "error");
          return false;
        }
        state.completed[4] = true;
        ensureStepUnlock(5);
        return true;
      }
      if (step === 5) {
        if (!state.paymentChannel) {
          setStatus("Please choose payment method.", "error");
          return false;
        }
        if (state.paymentChannel === "apple_pay" && !state.applePaySupported) {
          setStatus("Apple Pay is not supported on this device/browser.", "error");
          return false;
        }
        if (state.paymentChannel === "google_pay" && !state.walletSupported) {
          setStatus("Google Pay is not supported on this device/browser.", "error");
          return false;
        }
        if (state.mode === "monthly" && consentInput && !consentInput.checked) {
          setStatus("Please confirm recurring billing consent for monthly donations.", "error");
          return false;
        }
        if (legalAck && !legalAck.checked) {
          setStatus("Please accept terms before continuing.", "error");
          return false;
        }
        state.completed[5] = true;
        ensureStepUnlock(6);
        return true;
      }
      return true;
    }

    function createDonorAccount(payload) {
      return fetch(apiBase + "/auth/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (data) {
          if (!response.ok) {
            throw new Error((data && data.detail) || "Sign up failed.");
          }
          return data;
        });
      });
    }

    function signInDonor(payload) {
      return fetch(apiBase + "/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(function (response) {
        return response.json().catch(function () { return {}; }).then(function (data) {
          if (!response.ok) {
            throw new Error((data && data.detail) || "Sign in failed.");
          }
          return data;
        });
      });
    }

    function setOutcome(success, message, reference) {
      if (!outcomePanel) return;
      state.paymentStatus = success ? "Success" : "Failed";
      updateSummary();
      outcomePanel.classList.remove("hidden");
      outcomePanel.innerHTML =
        '<div class="' + (success ? "status-banner is-success" : "status-banner is-error") + '">' +
        escapeHtml(message) +
        "</div>" +
        '<div class="step-actions mt-md">' +
        (success
          ? '<button type="button" class="btn btn-secondary" id="download-receipt-btn">Download Receipt</button>' +
            '<a class="btn btn-primary" href="' + withRoot("pages/donation-success.html") + '">Open Success Page</a>'
          : '<a class="btn btn-primary" href="' + withRoot("pages/donate-now.html") + '">Try Again</a>' +
            '<a class="btn btn-ghost" href="' + withRoot("pages/donation-failed.html") + '">Open Failure Page</a>') +
        "</div>";
      var downloadBtn = document.getElementById("download-receipt-btn");
      if (downloadBtn && reference) {
        downloadBtn.addEventListener("click", function () {
          downloadReceipt(reference);
        });
      }
    }

    function closeEfModal() {
      if (!efModal) return;
      efModal.classList.remove("is-open");
      efModal.setAttribute("aria-hidden", "true");
      document.body.style.overflow = "";
    }

    function openEfModal() {
      if (!efModal) return;
      efModal.classList.add("is-open");
      efModal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }

    modeButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        setMode(button.getAttribute("data-donate-mode") || "");
      });
    });

    authChoiceButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        clearAuthStatus();
        setAuthFlow(button.getAttribute("data-auth-choice") || "");
      });
    });

    planCards.forEach(function (card) {
      card.addEventListener("click", function () {
        state.planId = card.getAttribute("data-plan") || "";
        var amount = Number(card.getAttribute("data-plan-amount") || 0);
        state.amount = amount;
        if (amountInput) amountInput.value = String(amount);
        setMode("monthly");
        planCards.forEach(function (item) {
          item.classList.toggle("is-active", item === card);
        });
        autoSelectCategory();
        updateSummary();
      });
    });

    amountButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        var amount = Number(button.getAttribute("data-amount") || 0);
        state.amount = amount;
        if (amountInput) amountInput.value = String(amount);
        amountButtons.forEach(function (item) {
          item.classList.toggle("is-active", item === button);
        });
        autoSelectCategory();
        updateSummary();
      });
    });

    channelButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        var channel = button.getAttribute("data-pay-channel") || "";
        state.paymentChannel = channel;
        if (paymentChannelInput) paymentChannelInput.value = channel;
        channelButtons.forEach(function (item) {
          item.classList.toggle("is-active", item === button);
        });
        updateGatewayInstructions();
        updateSummary();
      });
    });

    if (amountInput) {
      amountInput.addEventListener("input", function () {
        state.amount = parseAmount(amountInput.value || 0);
        amountButtons.forEach(function (item) {
          item.classList.remove("is-active");
        });
        autoSelectCategory();
        updateSummary();
      });
    }

    if (purposeSelect) {
      purposeSelect.addEventListener("change", function () {
        state.purposeLabel = purposeSelect.value
          ? (purposeSelect.options[purposeSelect.selectedIndex] ? purposeSelect.options[purposeSelect.selectedIndex].text : "")
          : "";
        updateSummary();
      });
    }

    if (signInButton) {
      signInButton.addEventListener("click", function () {
        clearAuthStatus();
        var email = (signInEmailInput && signInEmailInput.value || "").trim();
        var password = (signInPasswordInput && signInPasswordInput.value || "").trim();
        if (!email || !password) {
          setAuthStatus("Please enter your email and password.", "error");
          return;
        }
        signInButton.disabled = true;
        signInButton.textContent = "Signing In...";
        signInDonor({ email: email, password: password })
          .then(function (result) {
            state.donorSession = { token: result.token, profile: result.profile };
            setDonorSession(state.donorSession);
            applyDonorProfile(result.profile);
            state.completed[4] = true;
            setAuthStatus("Signed in successfully.", "success");
            updateSummary();
          })
          .catch(function (error) {
            if (isConnectionFailure(error && error.message) || isLocalPreviewRuntime()) {
              try {
                var demoResult = demoSignInDonor({ email: email, password: password });
                state.donorSession = { token: demoResult.token, profile: demoResult.profile };
                setDonorSession(state.donorSession);
                applyDonorProfile(demoResult.profile);
                state.completed[4] = true;
                setAuthStatus("Signed in successfully (local demo mode).", "success");
                updateSummary();
                return;
              } catch (demoError) {
                setAuthStatus("Sign in failed. " + demoError.message + " (local demo mode)", "error");
                return;
              }
            }
            setAuthStatus("Sign in failed. " + error.message, "error");
          })
          .finally(function () {
            signInButton.disabled = false;
            signInButton.textContent = "Sign In";
          });
      });
    }

    if (signUpButton) {
      signUpButton.addEventListener("click", function () {
        clearAuthStatus();
        var firstName = (signUpFirstNameInput && signUpFirstNameInput.value || "").trim();
        var lastName = (signUpLastNameInput && signUpLastNameInput.value || "").trim();
        var email = (signUpEmailInput && signUpEmailInput.value || "").trim();
        var phone = (signUpPhoneInput && signUpPhoneInput.value || "").trim();
        var password = (signUpPasswordInput && signUpPasswordInput.value || "").trim();
        var passwordConfirm = (signUpPasswordConfirmInput && signUpPasswordConfirmInput.value || "").trim();

        if (!firstName || !email || !password) {
          setAuthStatus("First name, email, and password are required.", "error");
          return;
        }
        if (password.length < 8) {
          setAuthStatus("Password must be at least 8 characters.", "error");
          return;
        }
        if (password !== passwordConfirm) {
          setAuthStatus("Password confirmation does not match.", "error");
          return;
        }

        signUpButton.disabled = true;
        signUpButton.textContent = "Creating Account...";
        createDonorAccount({
          first_name: firstName,
          last_name: lastName || null,
          email: email,
          phone: phone || null,
          password: password,
        })
          .then(function (result) {
            state.donorSession = { token: result.token, profile: result.profile };
            setDonorSession(state.donorSession);
            applyDonorProfile(result.profile);
            state.completed[4] = true;
            setAuthStatus("Account created and signed in successfully.", "success");
            setAuthFlow("signin");
            updateSummary();
          })
          .catch(function (error) {
            if (isConnectionFailure(error && error.message) || isLocalPreviewRuntime()) {
              try {
                var demoResult = demoCreateDonor({
                  first_name: firstName,
                  last_name: lastName || null,
                  email: email,
                  phone: phone || null,
                  password: password,
                });
                state.donorSession = { token: demoResult.token, profile: demoResult.profile };
                setDonorSession(state.donorSession);
                applyDonorProfile(demoResult.profile);
                state.completed[4] = true;
                setAuthStatus("Account created and signed in successfully (local demo mode).", "success");
                setAuthFlow("signin");
                updateSummary();
                return;
              } catch (demoError) {
                setAuthStatus("Account creation failed. " + demoError.message + " (local demo mode)", "error");
                return;
              }
            }
            setAuthStatus("Account creation failed. " + error.message, "error");
          })
          .finally(function () {
            signUpButton.disabled = false;
            signUpButton.textContent = "Create Account";
          });
      });
    }

    nextButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        clearStatus();
        if (!validateStep(state.step)) return;
        showStep(Math.min(state.step + 1, 6));
      });
    });

    backButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        clearStatus();
        showStep(Math.max(state.step - 1, 1));
      });
    });

    stepNavButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        var requested = Number(button.getAttribute("data-donation-step-nav") || 1);
        if (requested > state.maxUnlockedStep) return;
        if (requested > state.step) {
          for (var i = state.step; i < requested; i += 1) {
            if (!validateStep(i)) return;
          }
        }
        showStep(requested);
      });
    });

    efCloseButtons.forEach(function (button) {
      button.addEventListener("click", closeEfModal);
    });

    if (efModal) {
      efModal.addEventListener("click", function (event) {
        if (event.target === efModal) closeEfModal();
      });
    }

    if (efContinueButton) {
      efContinueButton.addEventListener("click", function () {
        closeEfModal();
        setStatus("eFAWATEERcom continuation is open. Complete bill payment and return to confirmation.", "success");
      });
    }

    channelButtons.forEach(function (button) {
      var channel = button.getAttribute("data-pay-channel");
      if (channel === "apple_pay" && !state.applePaySupported) {
        button.classList.add("hidden");
      }
      if (channel === "google_pay" && !state.walletSupported) {
        button.classList.add("hidden");
      }
    });

    if (state.donorSession && state.donorSession.profile) {
      applyDonorProfile(state.donorSession.profile);
      setAuthStatus("Signed in as " + (state.donorSession.profile.email || "donor") + ".", "success");
    }

    if (serviceInput && !serviceInput.value) {
      serviceInput.value = "general";
    }
    if (categoryInput) {
      categoryInput.value = "";
    }
    if (paymentChannelInput) {
      paymentChannelInput.value = "";
    }
    if (providerInput) {
      providerInput.value = "";
    }
    if (amountInput) {
      amountInput.value = "";
    }

    showStep(1);
    updateGatewayInstructions();
    updateSummary();
    clearStatus();

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      clearStatus();

      if (!validateStep(5)) return;

      var firstName = (form.querySelector('[name="first_name"]').value || "").trim();
      var lastName = (form.querySelector('[name="last_name"]').value || "").trim();
      var email = (form.querySelector('[name="email"]').value || "").trim();
      var phone = (form.querySelector('[name="phone"]').value || "").trim();
      var amount = parseAmount((form.querySelector('[name="amount"]').value || "0").trim());
      var serviceCode = form.querySelector('[name="service_code"]').value || "general";
      var purpose = form.querySelector('[name="purpose"]').value || "general";
      var provider = form.querySelector('[name="provider"]').value || "paytabs";
      var paymentChannel = form.querySelector('[name="payment_channel"]').value || "";
      var categoryCode = form.querySelector('[name="category_code"]').value || "";
      var referenceNote = (form.querySelector('[name="reference_note"]').value || "").trim();
      var message = (form.querySelector('[name="message"]').value || "").trim();

      if (!firstName || !email || !(amount > 0)) {
        setStatus("Please complete donor name, email, and valid amount.", "error");
        return;
      }
      if (!paymentChannel) {
        setStatus("Please select a payment method.", "error");
        return;
      }

      if (paymentChannel === "efawateercom") {
        openEfModal();
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Initializing Payment...";
      }

      var payload = {
        mode: state.mode === "monthly" ? "monthly" : "one_time",
        amount_jod: amount,
        currency: "JOD",
        provider: provider,
        payment_channel: paymentChannel,
        service_code: serviceCode,
        plan_id: state.mode === "monthly" ? state.planId || "custom" : null,
        purpose: purpose,
        category_code: categoryCode || null,
        reference_note: referenceNote || null,
        recurring_consent: state.mode === "monthly" ? !!(consentInput && consentInput.checked) : false,
        recurring_consent_timestamp: state.mode === "monthly" && consentInput && consentInput.checked ? new Date().toISOString() : null,
        donor: {
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone: phone || null,
          message: message || null,
        },
        success_url: window.location.origin + withRoot("pages/donation-success.html"),
        failure_url: window.location.origin + withRoot("pages/donation-failed.html"),
        manage_url: window.location.origin + withRoot("pages/subscription-support.html"),
        source_page: window.location.href,
      };

      fetch(apiBase + "/donations/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then(function (response) {
          return response
            .json()
            .catch(function () {
              return {};
            })
            .then(function (data) {
              return { ok: response.ok, data: data };
            });
        })
        .then(function (result) {
          if (!result.ok) {
            throw new Error(result.data && result.data.detail ? result.data.detail : "Failed to initialize checkout session.");
          }

          var data = result.data || {};
          var reference = data.donation_reference || ("ENF-" + Date.now());
          var redirect = data.redirect_url || data.checkout_url || data.payment_url;
          var kind = channelKinds[paymentChannel] || "direct";

          if (redirect) {
            setStatus("Redirecting to secure payment page...", "success");
            window.location.href = redirect;
            return;
          }

          if (kind === "qr") {
            setStatus("CliQ request initialized. Complete request-to-pay/QR approval and then verify payment.", "success");
          } else if (kind === "bill") {
            setStatus("eFAWATEERcom handoff initialized. Complete bill payment and return.", "success");
          } else if (kind === "handoff") {
            setStatus("Wallet handoff initialized. Complete payment in selected wallet and return.", "success");
          } else {
            setStatus("Checkout initialized. Completing in local/demo mode.", "success");
          }
          setOutcome(true, "Donation setup completed successfully.", reference);
          showStep(6);
        })
        .catch(function (error) {
          var networkHint =
            error && String(error.message || "").toLowerCase().indexOf("failed to fetch") !== -1
              ? " Backend endpoint is unreachable from this preview."
              : "";
          var detail = String((error && error.message) || "Payment initialization failed.");
          setStatus("Unable to initialize payment. " + detail + networkHint, "error");
          setOutcome(false, "Payment could not be completed. " + detail, null);
        })
        .finally(function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Complete Donation";
          }
        });
    });
  }

  function initDonorAccountPage() {
    var apiBase = getApiBaseUrl();
    var params = getQueryParams();
    var preferredMode = (params.get("mode") || "").toLowerCase();
    var statusBox = document.getElementById("donor-account-status");
    var signInTabButton = document.querySelector('[data-donor-tab-btn="signin"]');
    var signUpTabButton = document.querySelector('[data-donor-tab-btn="signup"]');
    var signInTab = document.querySelector('[data-donor-tab="signin"]');
    var signUpTab = document.querySelector('[data-donor-tab="signup"]');
    var signInButton = document.querySelector("[data-donor-signin-btn]");
    var signUpButton = document.querySelector("[data-donor-signup-btn]");

    function setStatus(message, kind) {
      if (!statusBox) return;
      statusBox.textContent = message;
      statusBox.classList.remove("hidden", "is-error", "is-success");
      statusBox.classList.add(kind === "error" ? "is-error" : "is-success");
    }

    function clearStatus() {
      if (!statusBox) return;
      statusBox.classList.add("hidden");
      statusBox.classList.remove("is-error", "is-success");
      statusBox.textContent = "";
    }

    function setTab(name) {
      if (signInTabButton) signInTabButton.classList.toggle("is-active", name === "signin");
      if (signUpTabButton) signUpTabButton.classList.toggle("is-active", name === "signup");
      if (signInTab) signInTab.classList.toggle("is-active", name === "signin");
      if (signUpTab) signUpTab.classList.toggle("is-active", name === "signup");
      clearStatus();
    }

    function parseResponse(response) {
      return response
        .json()
        .catch(function () {
          return {};
        })
        .then(function (data) {
          if (!response.ok) {
            throw new Error((data && data.detail) || "Request failed.");
          }
          return data;
        });
    }

    if (signInTabButton) signInTabButton.addEventListener("click", function () { setTab("signin"); });
    if (signUpTabButton) signUpTabButton.addEventListener("click", function () { setTab("signup"); });

    if (signInButton) {
      signInButton.addEventListener("click", function () {
        var email = (document.querySelector("[data-donor-signin-email]") || {}).value || "";
        var password = (document.querySelector("[data-donor-signin-password]") || {}).value || "";
        if (!email.trim() || !password.trim()) {
          setStatus("Please enter email and password.", "error");
          return;
        }
        signInButton.disabled = true;
        signInButton.textContent = "Signing In...";
        fetch(apiBase + "/auth/sign-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            password: password.trim(),
          }),
        })
          .then(parseResponse)
          .then(function (result) {
            setDonorSession({
              token: result.token,
              profile: result.profile,
            });
            setStatus("Signed in successfully as " + (result.profile && result.profile.email || "donor") + ".", "success");
            markSiteEntered();
            setTimeout(function () {
              window.location.href = withRoot("index.html");
            }, 500);
          })
          .catch(function (error) {
            if (isConnectionFailure(error && error.message) || isLocalPreviewRuntime()) {
              try {
                var demoResult = demoSignInDonor({
                  email: email.trim(),
                  password: password.trim(),
                });
                setDonorSession({
                  token: demoResult.token,
                  profile: demoResult.profile,
                });
                setStatus("Signed in successfully (local demo mode).", "success");
                markSiteEntered();
                setTimeout(function () {
                  window.location.href = withRoot("index.html");
                }, 500);
                return;
              } catch (demoError) {
                setStatus("Sign in failed. " + demoError.message + " (local demo mode)", "error");
                return;
              }
            }
            var hint = String(error.message || "").toLowerCase().indexOf("failed to fetch") !== -1
              ? " Backend API is not running."
              : "";
            setStatus("Sign in failed. " + error.message + hint, "error");
          })
          .finally(function () {
            signInButton.disabled = false;
            signInButton.textContent = "Sign In";
          });
      });
    }

    if (signUpButton) {
      signUpButton.addEventListener("click", function () {
        var firstName = (document.querySelector("[data-donor-signup-first-name]") || {}).value || "";
        var lastName = (document.querySelector("[data-donor-signup-last-name]") || {}).value || "";
        var email = (document.querySelector("[data-donor-signup-email]") || {}).value || "";
        var phone = (document.querySelector("[data-donor-signup-phone]") || {}).value || "";
        var password = (document.querySelector("[data-donor-signup-password]") || {}).value || "";
        var passwordConfirm = (document.querySelector("[data-donor-signup-password-confirm]") || {}).value || "";

        if (!firstName.trim() || !email.trim() || !password.trim()) {
          setStatus("First name, email, and password are required.", "error");
          return;
        }
        if (password.trim().length < 8) {
          setStatus("Password must be at least 8 characters.", "error");
          return;
        }
        if (password.trim() !== passwordConfirm.trim()) {
          setStatus("Password confirmation does not match.", "error");
          return;
        }
        signUpButton.disabled = true;
        signUpButton.textContent = "Creating...";
        fetch(apiBase + "/auth/sign-up", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            first_name: firstName.trim(),
            last_name: lastName.trim() || null,
            email: email.trim(),
            phone: phone.trim() || null,
            password: password.trim(),
          }),
        })
          .then(parseResponse)
          .then(function (result) {
            setDonorSession({
              token: result.token,
              profile: result.profile,
            });
            setStatus("Account created and signed in successfully.", "success");
            markSiteEntered();
            setTimeout(function () {
              window.location.href = withRoot("index.html");
            }, 550);
          })
          .catch(function (error) {
            if (isConnectionFailure(error && error.message) || isLocalPreviewRuntime()) {
              try {
                var demoResult = demoCreateDonor({
                  first_name: firstName.trim(),
                  last_name: lastName.trim() || null,
                  email: email.trim(),
                  phone: phone.trim() || null,
                  password: password.trim(),
                });
                setDonorSession({
                  token: demoResult.token,
                  profile: demoResult.profile,
                });
                setStatus("Account created and signed in successfully (local demo mode).", "success");
                markSiteEntered();
                setTimeout(function () {
                  window.location.href = withRoot("index.html");
                }, 550);
                return;
              } catch (demoError) {
                setStatus("Sign up failed. " + demoError.message + " (local demo mode)", "error");
                return;
              }
            }
            var hint = String(error.message || "").toLowerCase().indexOf("failed to fetch") !== -1
              ? " Backend API is not running."
              : "";
            setStatus("Sign up failed. " + error.message + hint, "error");
          })
          .finally(function () {
            signUpButton.disabled = false;
            signUpButton.textContent = "Create Account";
          });
      });
    }

    setTab(preferredMode === "signup" ? "signup" : "signin");
  }

  function initAdminPanel() {
    var apiBase = getApiBaseUrl();
    var loginPanel = document.getElementById("admin-login-panel");
    var dashboard = document.getElementById("admin-dashboard");
    var loginButton = document.getElementById("admin-login-btn");
    var logoutButton = document.getElementById("admin-logout-btn");
    var statusBox = document.getElementById("admin-status");
    var sectionsRoot = document.getElementById("admin-sections");
    var sectionKeyInput = document.getElementById("admin-section-key");
    var sectionJsonInput = null;
    var formEditorRoot = document.getElementById("admin-form-editor");
    var loadButton = document.getElementById("admin-load-content-btn");
    var saveButton = document.getElementById("admin-save-content-btn");
    var saveGaButton = document.getElementById("admin-save-ga-btn");
    var gaIdInput = document.getElementById("admin-ga-id");
    var gaStatus = document.getElementById("admin-ga-status");
    var previewShell = null;
    var previewFrame = null;
    var previewLabel = null;

    var editableSections = [
      {
        key: "home.hero",
        label: "Home Hero",
        page: "index.html",
        type: "object",
        fields: [
          { name: "heading", label: "Heading" },
          { name: "subheading", label: "Subheading", multiline: true },
          { name: "ctaText", label: "Primary CTA Text" },
          { name: "image", label: "Hero Image URL" },
        ],
      },
      {
        key: "home.whoWeAre",
        label: "Home Who We Are",
        page: "index.html",
        type: "object",
        fields: [
          { name: "heading", label: "Section Title" },
          { name: "subText", label: "Description", multiline: true },
          { name: "buttonText", label: "Button Label" },
        ],
      },
      {
        key: "whoWeAre.sections.0",
        label: "Who We Are · Overview",
        page: "pages/who-we-are.html?who_tab=0",
        type: "object",
        fields: [
          { name: "title", label: "Tab Label" },
          { name: "descriptionHtml", label: "Main Body (HTML)", multiline: true },
          { name: "summary", label: "Secondary Summary", multiline: true },
          { name: "frontImage", label: "Primary Image URL" },
          { name: "backImage", label: "Secondary / Overlay Image URL" },
        ],
      },
      {
        key: "whoWeAre.sections.1",
        label: "Who We Are · What Drives Us",
        page: "pages/who-we-are.html?who_tab=1",
        type: "object",
        fields: [
          { name: "title", label: "Tab Label" },
          { name: "descriptionHtml", label: "Main Body (HTML)", multiline: true },
          { name: "summary", label: "Secondary Summary", multiline: true },
          { name: "frontImage", label: "Primary Image URL" },
          { name: "backImage", label: "Secondary / Overlay Image URL" },
        ],
      },
      {
        key: "whoWeAre.sections.2",
        label: "Who We Are · What Guides Us",
        page: "pages/who-we-are.html?who_tab=2",
        type: "object",
        fields: [
          { name: "title", label: "Tab Label" },
          { name: "descriptionHtml", label: "Main Body (HTML)", multiline: true },
          { name: "summary", label: "Secondary Summary", multiline: true },
          { name: "frontImage", label: "Primary Image URL" },
          { name: "backImage", label: "Secondary / Overlay Image URL" },
        ],
      },
      {
        key: "whoWeAre.sections.3",
        label: "Who We Are · Our Approach",
        page: "pages/who-we-are.html?who_tab=3",
        type: "object",
        fields: [
          { name: "title", label: "Tab Label" },
          { name: "descriptionHtml", label: "Main Body (HTML)", multiline: true },
          { name: "summary", label: "Secondary Summary", multiline: true },
          { name: "frontImage", label: "Primary Image URL" },
          { name: "backImage", label: "Secondary / Overlay Image URL" },
        ],
      },
      {
        key: "whoWeAre.sections.4",
        label: "Who We Are · Our Board Members",
        page: "pages/who-we-are.html?who_tab=4",
        type: "object",
        fields: [
          { name: "title", label: "Tab Label" },
          { name: "descriptionHtml", label: "Main Body (HTML)", multiline: true },
          { name: "summary", label: "Secondary Summary", multiline: true },
          { name: "frontImage", label: "Primary Image URL" },
          { name: "backImage", label: "Secondary / Overlay Image URL" },
        ],
      },
      {
        key: "whoWeAre.sections.5",
        label: "Who We Are · Endowment Fund",
        page: "pages/who-we-are.html?who_tab=5",
        type: "object",
        fields: [
          { name: "title", label: "Tab Label" },
          { name: "descriptionHtml", label: "Main Body (HTML)", multiline: true },
          { name: "summary", label: "Secondary Summary", multiline: true },
          { name: "frontImage", label: "Primary Image URL" },
          { name: "backImage", label: "Secondary / Overlay Image URL" },
        ],
      },
      {
        key: "ourStory.timeline",
        label: "Our Story Timeline",
        page: "pages/our-story.html",
        type: "list",
        itemLabel: "Milestone",
        fields: [
          { name: "year", label: "Year" },
          { name: "summary", label: "Summary", multiline: true },
          { name: "descriptionHtml", label: "Description (HTML)", multiline: true },
          { name: "image", label: "Image URL" },
        ],
      },
      {
        key: "partners.institutional",
        label: "Our Partners",
        page: "pages/partners.html",
        type: "list",
        itemLabel: "Partner",
        fields: [
          { name: "name", label: "Partner Name" },
          { name: "logo", label: "Logo URL" },
          { name: "url", label: "Partner URL" },
        ],
      },
      {
        key: "whatWeDo.programs",
        label: "What We Do Programs",
        page: "pages/what-we-do.html",
        type: "list",
        itemLabel: "Program",
        fields: [
          { name: "title", label: "Program Title" },
          { name: "excerpt", label: "Program Summary", multiline: true },
          { name: "image", label: "Image URL" },
        ],
      },
      {
        key: "impact.stories",
        label: "Impact Stories",
        page: "pages/our-impact.html",
        type: "list",
        itemLabel: "Story",
        fields: [
          { name: "title", label: "Name / Title" },
          { name: "designation", label: "Role / Designation" },
          { name: "excerpt", label: "Preview", multiline: true },
          { name: "image", label: "Image URL" },
        ],
      },
      {
        key: "mediaCenter.news",
        label: "Media News",
        page: "pages/media-center.html",
        type: "list",
        itemLabel: "News Item",
        fields: [
          { name: "title", label: "Headline" },
          { name: "excerpt", label: "Summary", multiline: true },
          { name: "image", label: "Image URL" },
          { name: "date", label: "Date" },
        ],
      },
      {
        key: "donate.methods",
        label: "Donate Methods",
        page: "pages/donate-now.html",
        type: "list",
        itemLabel: "Method",
        fields: [
          { name: "title", label: "Method Name" },
          { name: "description", label: "Description", multiline: true },
        ],
      },
    ];

    var activeSection = editableSections[0] ? editableSections[0].key : "";
    var adminSession = getAdminSession();
    var currentContent = {};
    var analyticsSectionKey = "system.analytics";

    function setStatus(message, kind) {
      if (!statusBox) return;
      statusBox.textContent = message;
      statusBox.classList.remove("hidden", "is-error", "is-success");
      statusBox.classList.add(kind === "error" ? "is-error" : "is-success");
    }

    function setLoggedIn(isLoggedIn) {
      if (loginPanel) loginPanel.classList.toggle("hidden", isLoggedIn);
      if (dashboard) dashboard.classList.toggle("hidden", !isLoggedIn);
      if (statusBox) {
        statusBox.classList.add("hidden");
        statusBox.classList.remove("is-error", "is-success");
        statusBox.textContent = "";
      }
    }

    function parseResponse(response) {
      return response
        .json()
        .catch(function () {
          return {};
        })
        .then(function (data) {
          if (!response.ok) {
            throw new Error((data && data.detail) || "Request failed.");
          }
          return data;
        });
    }

    function adminHeaders() {
      var token = adminSession && adminSession.token;
      return {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      };
    }

    function sectionConfig(key) {
      return editableSections.find(function (item) {
        return item.key === key;
      });
    }

    function ensurePreviewPanel() {
      if (previewShell || !dashboard) return;
      var head = dashboard.querySelector(".admin-head");
      if (!head || !head.parentNode) return;
      previewShell = document.createElement("section");
      previewShell.className = "admin-live-preview mt-sm";
      previewShell.innerHTML =
        '<div class="admin-live-preview-head">' +
        '<strong>Visual Preview</strong>' +
        '<span class="small-note" id="admin-preview-label">Current section preview</span>' +
        "</div>" +
        '<iframe id="admin-preview-frame" title="Section live preview" loading="lazy"></iframe>';
      head.parentNode.insertBefore(previewShell, head.nextSibling);
      previewFrame = previewShell.querySelector("#admin-preview-frame");
      previewLabel = previewShell.querySelector("#admin-preview-label");
    }

    function refreshSectionPreview() {
      ensurePreviewPanel();
      if (!previewFrame) return;
      var config = sectionConfig(activeSection);
      var pagePath = (config && config.page) || "index.html";
      var url = withRoot(pagePath);
      var previewUrl = url + (url.indexOf("?") === -1 ? "?" : "&") + "admin_preview=" + encodeURIComponent(activeSection) + "&t=" + Date.now();
      previewFrame.src = previewUrl;
      if (previewLabel) {
        previewLabel.textContent = (config ? config.label : activeSection) + " · " + pagePath;
      }
    }

    function pushPreviewDraft() {
      var existing = getPreviewDraftMap();
      existing[activeSection] = currentContent;
      setPreviewDraftMap(existing);
      if (previewFrame && previewFrame.contentWindow) {
        previewFrame.contentWindow.postMessage(
          {
            type: "enf-admin-preview-update",
            sectionKey: activeSection,
            content: currentContent,
          },
          window.location.origin
        );
      }
    }

    function readFormIntoContent(config) {
      if (!config || !formEditorRoot) return currentContent;
      if (config.type === "object") {
        var updated = {};
        (config.fields || []).forEach(function (field) {
          var input = formEditorRoot.querySelector('[data-admin-field="' + field.name + '"]');
          updated[field.name] = input ? input.value : "";
        });
        return updated;
      }
      if (config.type === "list") {
        var cards = Array.prototype.slice.call(formEditorRoot.querySelectorAll("[data-admin-item-index]"));
        return cards
          .map(function (card) {
            var obj = {};
            (config.fields || []).forEach(function (field) {
              var input = card.querySelector('[data-admin-field="' + field.name + '"]');
              obj[field.name] = input ? input.value : "";
            });
            return obj;
          })
          .filter(function (item) {
            return Object.keys(item).some(function (fieldName) {
              return String(item[fieldName] || "").trim() !== "";
            });
          });
      }
      return currentContent;
    }

    function renderObjectEditor(config, payload) {
      if (!formEditorRoot) return;
      var safePayload = payload && typeof payload === "object" ? payload : {};
      formEditorRoot.innerHTML = (config.fields || [])
        .map(function (field) {
          var value = safePayload[field.name] != null ? String(safePayload[field.name]) : "";
          var isMediaField = /image|logo|photo|thumb|icon|banner|cover|url/i.test(field.name);
          return (
            '<div class="field">' +
            "<label>" +
            escapeHtml(field.label) +
            "</label>" +
            (field.multiline
              ? '<textarea data-admin-field="' + escapeHtml(field.name) + '" rows="4">' + escapeHtml(value) + "</textarea>"
              : '<input type="text" data-admin-field="' + escapeHtml(field.name) + '" value="' + escapeHtml(value) + '">') +
            (isMediaField
              ? '<div class="admin-upload-row"><input type="file" accept="image/*" data-admin-upload="' + escapeHtml(field.name) + '"></div>'
              : "") +
            "</div>"
          );
        })
        .join("");
    }

    function renderListEditor(config, payload) {
      if (!formEditorRoot) return;
      var list = Array.isArray(payload) ? payload : [];
      var items = list.length ? list : [{}];
      formEditorRoot.innerHTML =
        '<div class="admin-list-editor">' +
        items
          .map(function (item, index) {
            return (
              '<article class="admin-list-item" draggable="true" data-admin-item-index="' +
              index +
              '">' +
              '<div class="admin-list-item-head">' +
              '<strong>' +
              escapeHtml(config.itemLabel || "Item") +
              " " +
              String(index + 1) +
              "</strong>" +
              '<div class="admin-list-item-actions">' +
              '<button type="button" class="btn btn-ghost is-mini" data-admin-move="up">↑</button>' +
              '<button type="button" class="btn btn-ghost is-mini" data-admin-move="down">↓</button>' +
              '<button type="button" class="btn btn-ghost is-mini" data-admin-remove>Remove</button>' +
              "</div>" +
              "</div>" +
              '<div class="form-grid">' +
              (config.fields || [])
                .map(function (field) {
                  var value = item && item[field.name] != null ? String(item[field.name]) : "";
                  var isMediaField = /image|logo|photo|thumb|icon|banner|cover|url/i.test(field.name);
                  return (
                    '<div class="field">' +
                    "<label>" +
                    escapeHtml(field.label) +
                    "</label>" +
                    (field.multiline
                      ? '<textarea data-admin-field="' + escapeHtml(field.name) + '" rows="3">' + escapeHtml(value) + "</textarea>"
                      : '<input type="text" data-admin-field="' + escapeHtml(field.name) + '" value="' + escapeHtml(value) + '">') +
                    (isMediaField
                      ? '<div class="admin-upload-row"><input type="file" accept="image/*" data-admin-upload="' + escapeHtml(field.name) + '"></div>'
                      : "") +
                    "</div>"
                  );
                })
                .join("") +
              "</div>" +
              "</article>"
            );
          })
          .join("") +
        '<button type="button" class="btn btn-secondary is-mini mt-sm" id="admin-add-list-item">Add ' +
        escapeHtml(config.itemLabel || "Item") +
        "</button>" +
        "</div>";

      var addItemButton = document.getElementById("admin-add-list-item");
      if (addItemButton) {
        addItemButton.addEventListener("click", function () {
          var data = readFormIntoContent(config);
          data.push({});
          currentContent = data;
          if (sectionJsonInput) {
            sectionJsonInput.value = JSON.stringify(currentContent, null, 2);
          }
          renderListEditor(config, currentContent);
        });
      }

      Array.prototype.slice
        .call(formEditorRoot.querySelectorAll("[data-admin-remove]"))
        .forEach(function (button) {
          button.addEventListener("click", function () {
            var itemEl = button.closest("[data-admin-item-index]");
            if (!itemEl) return;
            var idx = Number(itemEl.getAttribute("data-admin-item-index"));
            var data = readFormIntoContent(config);
            data.splice(idx, 1);
            currentContent = data;
            if (sectionJsonInput) {
              sectionJsonInput.value = JSON.stringify(currentContent, null, 2);
            }
            renderListEditor(config, currentContent);
          });
        });

      Array.prototype.slice
        .call(formEditorRoot.querySelectorAll("[data-admin-move]"))
        .forEach(function (button) {
          button.addEventListener("click", function () {
            var itemEl = button.closest("[data-admin-item-index]");
            if (!itemEl) return;
            var idx = Number(itemEl.getAttribute("data-admin-item-index"));
            var direction = button.getAttribute("data-admin-move");
            var swapIndex = direction === "up" ? idx - 1 : idx + 1;
            var data = readFormIntoContent(config);
            if (swapIndex < 0 || swapIndex >= data.length) return;
            var temp = data[idx];
            data[idx] = data[swapIndex];
            data[swapIndex] = temp;
            currentContent = data;
            if (sectionJsonInput) {
              sectionJsonInput.value = JSON.stringify(currentContent, null, 2);
            }
            renderListEditor(config, currentContent);
          });
        });

      var dragSourceIndex = null;
      Array.prototype.slice
        .call(formEditorRoot.querySelectorAll("[data-admin-item-index]"))
        .forEach(function (itemEl) {
          itemEl.addEventListener("dragstart", function () {
            dragSourceIndex = Number(itemEl.getAttribute("data-admin-item-index"));
            itemEl.classList.add("is-dragging");
          });
          itemEl.addEventListener("dragend", function () {
            itemEl.classList.remove("is-dragging");
          });
          itemEl.addEventListener("dragover", function (event) {
            event.preventDefault();
          });
          itemEl.addEventListener("drop", function (event) {
            event.preventDefault();
            var targetIndex = Number(itemEl.getAttribute("data-admin-item-index"));
            if (dragSourceIndex == null || targetIndex === dragSourceIndex) return;
            var data = readFormIntoContent(config);
            if (dragSourceIndex < 0 || dragSourceIndex >= data.length || targetIndex < 0 || targetIndex >= data.length) return;
            var moved = data.splice(dragSourceIndex, 1)[0];
            data.splice(targetIndex, 0, moved);
            currentContent = data;
            if (sectionJsonInput) {
              sectionJsonInput.value = JSON.stringify(currentContent, null, 2);
            }
            renderListEditor(config, currentContent);
          });
        });

      Array.prototype.slice
        .call(formEditorRoot.querySelectorAll("[data-admin-upload]"))
        .forEach(function (uploadInput) {
          uploadInput.addEventListener("change", function () {
            var file = uploadInput.files && uploadInput.files[0];
            if (!file) return;
            var fieldName = uploadInput.getAttribute("data-admin-upload") || "";
            var card = uploadInput.closest("[data-admin-item-index]") || formEditorRoot;
            var linkedInput = card.querySelector('[data-admin-field=\"' + fieldName + '\"]');
            if (!linkedInput) return;
            var reader = new FileReader();
            reader.onload = function () {
              linkedInput.value = String(reader.result || "");
              syncJsonFromForm();
            };
            reader.readAsDataURL(file);
          });
        });
    }

    function renderFormEditor(sectionKey, payload) {
      if (!formEditorRoot) return;
      var config = sectionConfig(sectionKey);
      if (!config) {
        formEditorRoot.innerHTML =
          '<div class="integration-note">No visual editor configured for this section yet.</div>';
        return;
      }
      if (config.type === "list") {
        renderListEditor(config, payload);
      } else {
        renderObjectEditor(config, payload);
      }
    }

    function syncJsonFromForm() {
      var config = sectionConfig(activeSection);
      if (!config) return;
      currentContent = readFormIntoContent(config);
      if (sectionJsonInput) {
        sectionJsonInput.value = JSON.stringify(currentContent, null, 2);
      }
      pushPreviewDraft();
    }

    function loadSection(sectionKey) {
      if (!sectionKey || !adminSession || !adminSession.token) return;
      if (sectionKeyInput) sectionKeyInput.value = sectionKey;
      refreshSectionPreview();
      fetch(apiBase + "/admin/content/" + encodeURIComponent(sectionKey), {
        method: "GET",
        headers: adminHeaders(),
      })
        .then(parseResponse)
        .then(function (result) {
          var payload = result && result.content ? result.content : null;
          if (payload == null || (typeof payload === "object" && !Array.isArray(payload) && !Object.keys(payload).length)) {
            var fallback = getContentAtPath(content, sectionKey);
            payload = fallback != null ? JSON.parse(JSON.stringify(fallback)) : {};
          }
          currentContent = payload;
          if (sectionJsonInput) {
            sectionJsonInput.value = JSON.stringify(payload, null, 2);
          }
          renderFormEditor(sectionKey, payload);
          pushPreviewDraft();
        })
        .catch(function (error) {
          var fallback = getContentAtPath(content, sectionKey);
          currentContent = fallback != null ? JSON.parse(JSON.stringify(fallback)) : {};
          renderFormEditor(sectionKey, currentContent);
          pushPreviewDraft();
          setStatus("Loaded base section content (draft unavailable).", "success");
        });
    }

    function loadAnalyticsConfig() {
      if (!adminSession || !adminSession.token || !gaIdInput || !gaStatus) return;
      fetch(apiBase + "/admin/content/" + encodeURIComponent(analyticsSectionKey), {
        method: "GET",
        headers: adminHeaders(),
      })
        .then(parseResponse)
        .then(function (result) {
          var payload = result && result.content ? result.content : {};
          var id = String(payload.ga_measurement_id || document.body.getAttribute("data-ga-id") || "").trim();
          gaIdInput.value = id;
          gaStatus.textContent = /^G-[A-Z0-9]+$/i.test(id) && !/X{4,}/i.test(id)
            ? "Status: Configured with valid measurement ID."
            : "Status: Placeholder mode (tracking not active).";
        })
        .catch(function () {
          gaStatus.textContent = "Status: Could not load analytics draft.";
        });
    }

    function renderSections() {
      if (!sectionsRoot) return;
      ensurePreviewPanel();
      sectionsRoot.innerHTML = editableSections
        .map(function (item) {
          return (
            '<button type="button" class="admin-section-btn ' +
            (item.key === activeSection ? "is-active" : "") +
            '" data-admin-section="' +
            escapeHtml(item.key) +
            '">' +
            "<strong>" +
            escapeHtml(item.label) +
            "</strong></button>"
          );
        })
        .join("");
      Array.prototype.slice
        .call(sectionsRoot.querySelectorAll("[data-admin-section]"))
        .forEach(function (button) {
          button.addEventListener("click", function () {
            activeSection = button.getAttribute("data-admin-section") || "";
            renderSections();
            loadSection(activeSection);
          });
        });
    }

    if (loginButton) {
      loginButton.addEventListener("click", function () {
        var username = (document.getElementById("admin-username") || {}).value || "";
        var password = (document.getElementById("admin-password") || {}).value || "";
        if (!username.trim() || !password.trim()) {
          setStatus("Please enter admin username and password.", "error");
          return;
        }
        loginButton.disabled = true;
        loginButton.textContent = "Logging In...";
        fetch(apiBase + "/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: username.trim(),
            password: password.trim(),
          }),
        })
          .then(parseResponse)
          .then(function (result) {
            adminSession = {
              token: result.token,
              username: result.username,
            };
            setAdminSession(adminSession);
            setLoggedIn(true);
            renderSections();
            loadSection(activeSection);
            loadAnalyticsConfig();
            refreshSectionPreview();
            if (window.location.hash !== "#dashboard") {
              window.location.hash = "dashboard";
            }
          })
          .catch(function (error) {
            var hint = String(error.message || "").toLowerCase().indexOf("failed to fetch") !== -1
              ? " Backend API is not running."
              : "";
            setStatus("Admin login failed. " + error.message + hint, "error");
          })
          .finally(function () {
            loginButton.disabled = false;
            loginButton.textContent = "Enter";
          });
      });
    }

    if (logoutButton) {
      logoutButton.addEventListener("click", function () {
        if (adminSession && adminSession.token) {
          fetch(apiBase + "/admin/logout", {
            method: "POST",
            headers: adminHeaders(),
          }).catch(function () {
            // ignore, local session will still be cleared
          });
        }
        clearAdminSession();
        adminSession = null;
        setLoggedIn(false);
      });
    }

    if (loadButton) {
      loadButton.addEventListener("click", function () {
        if (!activeSection) return;
        loadSection(activeSection);
      });
    }

    if (formEditorRoot) {
      formEditorRoot.addEventListener("input", function () {
        syncJsonFromForm();
      });
      formEditorRoot.addEventListener("change", function (event) {
        var target = event.target;
        if (!target || !target.matches || !target.matches("[data-admin-upload]")) return;
        var file = target.files && target.files[0];
        if (!file) return;
        var fieldName = target.getAttribute("data-admin-upload") || "";
        var card = target.closest("[data-admin-item-index]") || formEditorRoot;
        var linkedInput = card.querySelector('[data-admin-field=\"' + fieldName + '\"]');
        if (!linkedInput) return;
        var reader = new FileReader();
        reader.onload = function () {
          linkedInput.value = String(reader.result || "");
          syncJsonFromForm();
        };
        reader.readAsDataURL(file);
      });
    }

    if (saveButton) {
      saveButton.addEventListener("click", function () {
        if (!activeSection || !adminSession || !adminSession.token) return;
        var config = sectionConfig(activeSection);
        var parsedContent = readFormIntoContent(config);
        saveButton.disabled = true;
        saveButton.textContent = "Saving...";
        fetch(apiBase + "/admin/content/" + encodeURIComponent(activeSection), {
          method: "PUT",
          headers: adminHeaders(),
          body: JSON.stringify({
            content: parsedContent,
          }),
        })
          .then(parseResponse)
          .then(function () {
            setStatus("Content draft saved for " + activeSection + ".", "success");
            currentContent = parsedContent;
            updateContentOverride(activeSection, currentContent);
            pushPreviewDraft();
          })
          .catch(function (error) {
            setStatus("Failed to save draft. " + error.message, "error");
          })
          .finally(function () {
            saveButton.disabled = false;
            saveButton.textContent = "Save Draft";
          });
      });
    }

    if (saveGaButton) {
      saveGaButton.addEventListener("click", function () {
        if (!adminSession || !adminSession.token || !gaIdInput) return;
        var gaMeasurementId = String(gaIdInput.value || "").trim();
        saveGaButton.disabled = true;
        saveGaButton.textContent = "Saving...";
        fetch(apiBase + "/admin/content/" + encodeURIComponent(analyticsSectionKey), {
          method: "PUT",
          headers: adminHeaders(),
          body: JSON.stringify({
            content: {
              ga_measurement_id: gaMeasurementId,
              note: "Configure this ID to activate Google Analytics tracking in site.js",
              script_location: "assets/js/site.js -> initGoogleAnalytics()",
              reporting_placeholder: "Future analytics dashboard can be embedded here.",
            },
          }),
        })
          .then(parseResponse)
          .then(function () {
            if (gaStatus) {
              gaStatus.textContent = /^G-[A-Z0-9]+$/i.test(gaMeasurementId) && !/X{4,}/i.test(gaMeasurementId)
                ? "Status: Configured with valid measurement ID."
                : "Status: Placeholder mode (tracking not active).";
            }
            setStatus("Analytics configuration draft saved.", "success");
          })
          .catch(function (error) {
            setStatus("Failed to save analytics draft. " + error.message, "error");
          })
          .finally(function () {
            saveGaButton.disabled = false;
            saveGaButton.textContent = "Save Analytics Draft";
          });
      });
    }

    if (adminSession && adminSession.token) {
      setLoggedIn(true);
      renderSections();
      loadSection(activeSection);
      loadAnalyticsConfig();
      refreshSectionPreview();
      if (window.location.hash !== "#dashboard") {
        window.location.hash = "dashboard";
      }
    } else {
      setLoggedIn(false);
    }
  }

  function initAssistantWidget() {
    var chunks = buildContentChunks(content);
    if (!chunks.length) return;

    var shell = document.createElement("div");
    shell.innerHTML =
      '<button class="assistant-fab" type="button" id="assistant-fab">Ask ENF</button>' +
      '<section class="assistant-panel" id="assistant-panel" aria-live="polite">' +
      '<div class="assistant-head">' +
      '<h3>ENF Assistant (Site Content Only)</h3>' +
      '<button class="assistant-close" type="button" id="assistant-close">×</button>' +
      "</div>" +
      '<p class="assistant-note">Answers are generated only from website content currently loaded on this page.</p>' +
      '<form id="assistant-form" class="assistant-form">' +
      '<input id="assistant-input" type="text" placeholder="Ask about donations, programs, timeline, or policies">' +
      '<button class="btn btn-secondary" type="submit">Search</button>' +
      "</form>" +
      '<div class="assistant-prompts">' +
      '<button type="button" data-assistant-suggest="How do monthly donations work?">Monthly billing</button>' +
      '<button type="button" data-assistant-suggest="What programs does ENF run?">Programs</button>' +
      '<button type="button" data-assistant-suggest="Show me ENF timeline milestones">Timeline</button>' +
      "</div>" +
      '<div class="assistant-results" id="assistant-results">Try: "How do monthly donations work?"</div>' +
      "</section>";

    document.body.appendChild(shell);

    var fab = document.getElementById("assistant-fab");
    var panel = document.getElementById("assistant-panel");
    var close = document.getElementById("assistant-close");
    var form = document.getElementById("assistant-form");
    var input = document.getElementById("assistant-input");
    var results = document.getElementById("assistant-results");
    var prompts = Array.prototype.slice.call(document.querySelectorAll("[data-assistant-suggest]"));

    function toggle(open) {
      panel.classList.toggle("is-open", open);
    }

    if (fab) {
      fab.addEventListener("click", function () {
        toggle(!panel.classList.contains("is-open"));
      });
    }
    if (close) {
      close.addEventListener("click", function () {
        toggle(false);
      });
    }

    function runQuery(rawQuery) {
      var query = (rawQuery || "").trim().toLowerCase();
      if (!query) {
        results.textContent = "Type a question to search ENF content.";
        return;
      }

      var terms = query.split(/\s+/).filter(Boolean);
      var ranked = chunks
        .map(function (chunk) {
          var score = 0;
          terms.forEach(function (term) {
            if (chunk.text.indexOf(term) !== -1) score += 3;
            if (chunk.title.indexOf(term) !== -1) score += 6;
          });
          return {
            title: chunk.title,
            text: chunk.rawText,
            score: score,
          };
        })
        .filter(function (item) {
          return item.score > 0;
        })
        .sort(function (a, b) {
          return b.score - a.score;
        })
        .slice(0, 3);

      if (!ranked.length) {
        results.innerHTML = '<p>No direct match in current site content. Try terms like "monthly", "program", "timeline", "privacy", or "partners".</p>';
        return;
      }

      results.innerHTML = ranked
        .map(function (item) {
          return (
            '<article class="assistant-result"><h4>' +
            escapeHtml(item.title) +
            "</h4><p>" +
            escapeHtml(truncate(item.text, 230)) +
            '</p><small>Match score: ' +
            item.score +
            "</small></article>"
          );
        })
        .join("");
    }

    if (form && input && results) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        runQuery(input.value || "");
      });
    }

    prompts.forEach(function (button) {
      button.addEventListener("click", function () {
        var query = button.getAttribute("data-assistant-suggest") || "";
        if (input) input.value = query;
        runQuery(query);
        toggle(true);
      });
    });
  }

  function buildContentChunks(data) {
    var chunks = [];

    function push(title, text) {
      var raw = sanitizeText(text || "");
      if (!raw) return;
      chunks.push({
        title: String(title || "ENF"),
        rawText: raw,
        text: raw.toLowerCase(),
      });
    }

    push("Donate", data && data.donate && data.donate.subText);
    push("Donation Education Program", data && data.donationEducationProgram && data.donationEducationProgram.descriptionHtml);
    (data.whatWeDo && data.whatWeDo.programs ? data.whatWeDo.programs : []).forEach(function (program) {
      push("Program: " + program.title, program.articleHtml || program.excerpt);
    });
    (data.whoWeAre && data.whoWeAre.sections ? data.whoWeAre.sections : []).forEach(function (section) {
      push("Who We Are: " + section.title, section.descriptionHtml || section.summary);
    });
    (data.ourStory && data.ourStory.timeline ? data.ourStory.timeline : []).forEach(function (item) {
      push("Timeline " + item.year, item.descriptionHtml || item.summary);
    });
    (data.mediaCenter && data.mediaCenter.news ? data.mediaCenter.news : []).forEach(function (item) {
      push("News: " + item.title, item.articleHtml || item.excerpt);
    });
    push("Privacy Policy", data && data.policies && data.policies.privacyHtml);
    push("Terms and Conditions", data && data.policies && data.policies.termsHtml);

    return chunks;
  }

  function renderByPage() {
    if (page === "home") return renderHome();
    if (page === "who-we-are") return renderWhoWeArePage();
    if (page === "our-story") return renderOurStoryPage();
    if (page === "what-we-do") return renderWhatWeDoPage();
    if (page === "partners") return renderPartnersPage();
    if (page === "our-impact") return renderImpactPage();
    if (page === "media-center") return renderMediaCenterPage();
    if (page === "donate-now") return renderDonatePage();
    if (page === "donation-education") return renderDonationEducationPage();
    if (page === "donation-success") return renderDonationResult("success");
    if (page === "donation-failed") return renderDonationResult("failed");
    if (page === "subscription-support") return renderSubscriptionSupportPage();
    if (page === "donor-account") return renderDonorAccountPage();
    if (page === "admin") return renderAdminPage();
    if (page === "privacy-policy") return renderPolicyPage("privacy");
    if (page === "terms-and-condition") return renderPolicyPage("terms");

    root.innerHTML =
      '<section class="section-space">' +
      '<div class="container surface-card" style="padding:1rem">' +
      '<h2 class="section-title">Page Not Configured</h2>' +
      '<p class="section-subtitle">This route is available as a placeholder for future expansion.</p>' +
      '<a class="btn btn-primary mt-sm" href="' + withRoot("index.html") + '">Back to Home</a>' +
      "</div>" +
      "</section>";
  }

  function applyAdminPreviewDraftFromQuery() {
    var params = getQueryParams();
    var sectionKey = params.get("admin_preview") || "";
    if (!sectionKey) return false;
    var drafts = getPreviewDraftMap();
    if (drafts && Object.prototype.hasOwnProperty.call(drafts, sectionKey)) {
      setContentAtPath(content, sectionKey, drafts[sectionKey]);
      return true;
    }
    return false;
  }

  var isAdminPage = page === "admin";
  var isPreviewFrame = !!getQueryParams().get("admin_preview");
  if (isPreviewFrame) {
    applyAdminPreviewDraftFromQuery();
  }
  if (!isAdminPage) {
    renderHeader();
  } else {
    headerRoot.innerHTML = "";
    footerRoot.innerHTML = "";
    document.body.classList.add("admin-mode");
  }
  initGoogleAnalytics();
  renderByPage();
  if (!isAdminPage) {
    renderFooter();
  }
  initReveal();
  initInteractiveCards();
  initHeroParallax();
  if (!isAdminPage) {
    initScrollProgress();
    initAssistantWidget();
  }
  initHomeIntroOverlay();

  if (!isAdminPage) {
    window.addEventListener("storage", function (event) {
      if (event.key !== "enfContentOverrides") return;
      applyStoredContentOverrides();
      renderByPage();
      initReveal();
      initHeroParallax();
      initScrollProgress();
    });
  }

  if (isPreviewFrame) {
    window.addEventListener("message", function (event) {
      if (event.origin !== window.location.origin) return;
      var data = event.data || {};
      if (data.type !== "enf-admin-preview-update" || !data.sectionKey) return;
      setContentAtPath(content, data.sectionKey, data.content);
      renderByPage();
      initReveal();
      initInteractiveCards();
      initHeroParallax();
    });
  }
})();
