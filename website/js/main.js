/* ==========================================================================
   Bhoomi Fitness — site behaviour
   Progressive enhancement: every interaction below degrades gracefully.
   If GSAP/ScrollTrigger fail to load from the CDN, content stays fully
   visible and usable (see .js-anim in css/style.css).
   ========================================================================== */
(function () {
  "use strict";

  var prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  /* ---------------- Mobile nav toggle ---------------- */
  var navToggle = document.getElementById("nav-toggle");
  var mainNav = document.getElementById("main-nav");

  if (navToggle && mainNav) {
    navToggle.addEventListener("click", function () {
      var isOpen = mainNav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    mainNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        mainNav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------------- Header background on scroll ---------------- */
  var header = document.getElementById("site-header");
  if (header) {
    var onScroll = function () {
      if (window.scrollY > 40) {
        header.style.backgroundColor = "rgba(10,10,10,0.92)";
      } else {
        header.style.backgroundColor = "";
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------------- Footer year ---------------- */
  var yearEl = document.getElementById("footer-year");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  /* Member Login / Member App / Staff App links point at ./app/ and
     ./staff/ — the client-app and master-app PWAs published alongside this
     site at those subpaths by .github/workflows/deploy-pages.yml. No JS
     needed for them; they're plain relative links. */

  /* ---------------- Membership "coming soon" capture ----------------
     Posts nowhere functional yet — see the HTML comment above the form
     in index.html for where a real backend endpoint would go. */
  var membershipForm = document.getElementById("membership-form");
  var membershipNote = document.getElementById("membership-note");
  if (membershipForm && membershipNote) {
    membershipForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var emailInput = document.getElementById("membership-email");
      var email = emailInput ? emailInput.value.trim() : "";
      if (!email) {
        membershipNote.textContent = "Please enter a valid email address.";
        return;
      }
      // No network call yet — membership sign-up backend doesn't exist.
      membershipNote.textContent =
        "Thanks — we'll email you the moment memberships open online.";
      membershipForm.reset();
    });
  }

  /* ---------------- Scroll-triggered motion (GSAP) ---------------- */
  var gsapReady =
    !prefersReducedMotion &&
    typeof window.gsap !== "undefined" &&
    typeof window.ScrollTrigger !== "undefined";

  if (!gsapReady) {
    // No animation library (or user prefers reduced motion): leave
    // everything in its default, fully-visible CSS state.
    return;
  }

  var gsap = window.gsap;
  gsap.registerPlugin(window.ScrollTrigger);

  // Mark reveal elements as JS-animated only now — this is what actually
  // hides them (see .js-anim.reveal in style.css), so a failed CDN load
  // never leaves content stuck invisible. The hero's own reveal elements
  // are handled separately below (they play on load, not on scroll).
  var revealEls = document.querySelectorAll(".reveal:not(#hero .reveal)");
  var heroRevealEls = document.querySelectorAll("#hero .reveal");

  revealEls.forEach(function (el) {
    el.classList.add("js-anim");
  });
  heroRevealEls.forEach(function (el) {
    el.classList.add("js-anim");
  });

  revealEls.forEach(function (el, i) {
    gsap.to(el, {
      opacity: 1,
      y: 0,
      duration: 1,
      ease: "power3.out",
      delay: (i % 4) * 0.06,
      scrollTrigger: {
        trigger: el,
        start: "top 88%",
        toggleActions: "play none none reverse",
      },
    });
  });

  // Hero headline: lines slide up into place on load.
  var heroLines = document.querySelectorAll(".hero-title .reveal-line span");
  if (heroLines.length) {
    gsap.set(heroLines, { yPercent: 115 });
    gsap.to(heroLines, {
      yPercent: 0,
      duration: 1.1,
      ease: "power4.out",
      stagger: 0.12,
      delay: 0.2,
    });
  }

  // Hero eyebrow + sub + actions: fade/slide up in sequence after the
  // headline, once on load — this is the first thing a visitor sees, so
  // it is not scroll-triggered.
  gsap.to(heroRevealEls, {
    opacity: 1,
    y: 0,
    duration: 1,
    ease: "power3.out",
    delay: 0.6,
    stagger: 0.12,
  });

  // Subtle parallax on the hero background — slow, not gimmicky.
  var heroBg = document.querySelector(".hero-bg");
  if (heroBg) {
    gsap.to(heroBg, {
      yPercent: 14,
      ease: "none",
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "bottom top",
        scrub: true,
      },
    });
  }
})();
