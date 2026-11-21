const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

// ClipShield landing — progressive enhancement. No dependencies.
// Interaction budget (8): sticky header, smooth anchors + mobile nav,
// scroll-reveal (once), hover lifts (CSS), accordion FAQ (native details),
// product mockup bob (CSS), wired CTAs, living footer + back-to top.

(function () {
  "use strict";

  var APP_URL = "https://clipshield.db.app/";

  // Gate reveal/hidden state behind a JS class so the page is fully
  // visible with JavaScript disabled.
  document.documentElement.classList.add("js");

  // --- 1. Sticky header scroll response (one passive listener) ---
  var header = document.querySelector("[data-header]");
  if (header) {
    var onScroll = function () {
      if (window.scrollY > 8) header.classList.add("is-scrolled");
      else header.classList.remove("is-scrolled");
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // --- 2. Mobile nav toggle with correct aria-expanded, closes on link ---
  var burger = document.querySelector("[data-burger]");
  var mobileNav = document.querySelector("[data-mobile-nav]");
  if (burger && mobileNav) {
    var closeMobile = function () {
      mobileNav.classList.remove("is-open");
      burger.setAttribute("aria-expanded", "false");
      burger.setAttribute("aria-label", "Open menu");
    };
    burger.addEventListener("click", function () {
      var open = mobileNav.classList.toggle("is-open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
    mobileNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", closeMobile);
    });
  }

  // --- 3. Scroll-reveal, once (IntersectionObserver, reduced-motion aware) ---
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var reveals = document.querySelectorAll(".reveal");
  if (reduce || !("IntersectionObserver" in window)) {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    reveals.forEach(function (el) { io.observe(el); });
  }

  // --- 4. Smooth anchor offset (header height) when CSS smooth scroll alone
  //        would land under the sticky header. Respects reduced motion. ---
  var smooth = !reduce;
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener("click", function (e) {
      var id = link.getAttribute("href");
      if (id === "#" || id.length < 2) return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      var top = target.getBoundingClientRect().top + window.scrollY - 76;
      if (smooth) window.scrollTo({ top: top, behavior: "smooth" });
      else window.scrollTo(0, top);
      // Move focus for a11y without a jarring jump.
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    });
  });

  // --- 5. Wired CTAs: ensure every product-entry link uses the one URL
  //        constant with target=_blank rel=noopener (href is already the
  //        no-JS fallback in the HTML). ---
  document.querySelectorAll("[data-signin]").forEach(function (el) {
    el.setAttribute("href", APP_URL);
    el.setAttribute("target", "_blank");
    el.setAttribute("rel", "noopener");
  });

  // --- 6. Back to top ---
  var toTop = document.querySelector("[data-back-to-top]");
  if (toTop) {
    toTop.addEventListener("click", function (e) {
      e.preventDefault();
      if (smooth) window.scrollTo({ top: 0, behavior: "smooth" });
      else window.scrollTo(0, 0);
    });
  }
})();