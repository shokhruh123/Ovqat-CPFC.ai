"use client";

import { useEffect } from "react";

/**
 * Визуальный слой — порт yolguard/frontend/ui.js на React:
 * ripple на тактильных элементах, spotlight на карточках, reveal при появлении.
 * Всё через transform/opacity, с уважением к prefers-reduced-motion.
 */
export function VisualEffects() {
  useEffect(() => {
    const reduce =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (reduce) return;

    const onDown = (e: PointerEvent) => {
      const el = (e.target as HTMLElement).closest?.(
        ".btn-ripple, .tabbtn, .hist-row"
      ) as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const d = Math.max(r.width, r.height);
      const s = document.createElement("span");
      s.className = "rip";
      s.style.width = s.style.height = `${d}px`;
      s.style.left = `${e.clientX - r.left - d / 2}px`;
      s.style.top = `${e.clientY - r.top - d / 2}px`;
      const pos = getComputedStyle(el).position;
      if (pos === "static") el.style.position = "relative";
      if (getComputedStyle(el).overflow === "visible") el.style.overflow = "hidden";
      el.appendChild(s);
      setTimeout(() => s.remove(), 650);
    };
    document.addEventListener("pointerdown", onDown, { passive: true });

    let spotlight: ((e: PointerEvent) => void) | null = null;
    if (window.matchMedia?.("(pointer: fine)").matches) {
      spotlight = (e: PointerEvent) => {
        const c = (e.target as HTMLElement).closest?.(".spot") as HTMLElement | null;
        if (!c) return;
        const r = c.getBoundingClientRect();
        c.style.setProperty("--mx", `${e.clientX - r.left}px`);
        c.style.setProperty("--my", `${e.clientY - r.top}px`);
      };
      document.addEventListener("pointermove", spotlight, { passive: true });
    }

    // reveal для динамически вставленных рядов истории/сообщений
    let io: IntersectionObserver | null = null;
    let mo: MutationObserver | null = null;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(
        (ents) =>
          ents.forEach((en) => {
            if (en.isIntersecting) {
              en.target.classList.add("in");
              io?.unobserve(en.target);
            }
          }),
        { threshold: 0.08 }
      );
      const scan = () =>
        document.querySelectorAll(".reveal:not(.in)").forEach((el) => io?.observe(el));
      mo = new MutationObserver(scan);
      mo.observe(document.body, { childList: true, subtree: true });
      scan();
    }

    return () => {
      document.removeEventListener("pointerdown", onDown);
      if (spotlight) document.removeEventListener("pointermove", spotlight);
      io?.disconnect();
      mo?.disconnect();
    };
  }, []);

  return null;
}
