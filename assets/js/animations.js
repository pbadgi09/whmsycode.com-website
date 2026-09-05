// Scroll-reveal, vanilla IntersectionObserver, no dependencies.
//
// Progressive enhancement by construction: every ".reveal" element's base
// CSS state is fully visible. This script is the only thing that ever hides
// them (by adding "reveal-pending" right before observing), so if this
// script never runs — blocked, throws, or the browser lacks
// IntersectionObserver — content simply stays visible instead of being
// silently stuck invisible forever.
export function initScrollReveal() {
  if (!("IntersectionObserver" in window)) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const groups = document.querySelectorAll("[data-reveal-stagger]");
  groups.forEach((group) => {
    group.querySelectorAll(".reveal").forEach((el, index) => {
      el.style.transitionDelay = `${Math.min(index, 6) * 60}ms`;
    });
  });

  const targets = document.querySelectorAll(".reveal");
  if (targets.length === 0) return;

  targets.forEach((el) => el.classList.add("reveal-pending"));

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.remove("reveal-pending");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
  );

  targets.forEach((el) => observer.observe(el));
}
