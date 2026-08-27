"use client";

import { useState, useEffect, useRef } from "react";

export default function HScroll({ children, resetKey = "" }) {
  const ref = useRef(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollLeft = 0;

    const update = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      setShowLeft(scrollLeft > 4);
      setShowRight(scrollLeft + clientWidth < scrollWidth - 4);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [resetKey]);

  return (
    <div className="md:hidden relative max-w-full">
      {/* fade left degradado pa más*/}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 left-0 w-8 z-10 bg-gradient-to-r from-[#0a0f16] to-transparent transition-opacity duration-200 ${
          showLeft ? "opacity-100" : "opacity-0"
        }`}
      />
      {/* fade right degradado pa mostrar más */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 right-0 w-10 z-10 bg-gradient-to-l from-[#0a0f16] to-transparent transition-opacity duration-200 ${
          showRight ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        ref={ref}
        className="overflow-x-auto overscroll-x-contain pb-1 scrollbar-none"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="flex gap-3 w-max pr-2">{children}</div>
      </div>
    </div>
  );
}
