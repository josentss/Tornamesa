export function IconInstagram({ className = "w-4 h-4" }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4zm9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8A1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5a5 5 0 0 1-5 5a5 5 0 0 1-5-5a5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3a3 3 0 0 0 3 3a3 3 0 0 0 3-3a3 3 0 0 0-3-3"
      />
    </svg>
  );
}

export function IconX({ className = "w-4 h-4" }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="m17.687 3.063l-4.996 5.711l-4.32-5.711H2.112l7.477 9.776l-7.086 8.099h3.034l5.469-6.25l4.78 6.25h6.102l-7.794-10.304l6.625-7.571zm-1.064 16.06L5.654 4.782h1.803l10.846 14.34z"
      />
    </svg>
  );
}

export function IconRym({ className = "w-4 h-4" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill="none"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      {/* waves RYM */}
      <path
        fill="currentColor"
        d="M4.8 9.2c2.8-1.4 5.4-1.9 7.4-1.1 2.1.8 4.2 1.3 7 .6-.4-1.8-1.1-3.4-2.1-4.8-2.6.3-5.4.2-7.6-.7C7.2 5.2 5.6 7 4.8 9.2Z"
      />
      <path
        fill="currentColor"
        d="M4.6 12.2c2.6-1.6 5.5-2.6 8.2-2.1 2.4.4 4.4 1.4 6.6 1.1-.15 1.3-.45 2.5-.9 3.6-2.5 1.9-5.4 3.4-7.8 3.7-2.6.3-3.4-2.8-6.1-2.1-1.2.3-2.4.9-3.5 1.6.3-1.9.8-3.6 1.5-5.2Z"
      />
      <path
        fill="currentColor"
        d="M6.2 16.8c1.9-1.1 4-1.8 6-1.6 2.2.2 4.4 1.4 6.5 2.6-.9 1.4-2.1 2.6-3.5 3.5-2.1-.4-4.1-.6-5.7-.2-1.5.4-2.6 1.2-3.8 1.9.1-.6.2-1.2.2-1.8.1-1.5.2-2.9.3-4.4Z"
      />
      <circle cx="14.2" cy="14.4" r="1.35" fill="currentColor" />
    </svg>
  );
}

export function socialHref(kind, handle) {
  if (!handle) return null;
  const h = String(handle).replace(/^@/, "").trim();
  if (!h) return null;
  if (kind === "instagram") return `https://instagram.com/${h}`;
  if (kind === "twitter") return `https://x.com/${h}`;
  if (kind === "rym") return `https://rateyourmusic.com/~${h}`;
  return null;
}
