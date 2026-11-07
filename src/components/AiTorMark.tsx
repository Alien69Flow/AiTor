import { useId } from "react";

interface AiTorMarkProps {
  /** Tailwind size classes; the mark scales from 14px to hero sizes. */
  className?: string;
  /**
   * Rounded dark tile with the gradient edge (the favicon/PWA form).
   * Turn it off for inline glyphs next to text.
   */
  tile?: boolean;
  /** Accessible name; pass "" only when a visible label sits next to it. */
  label?: string;
}

/**
 * Ai Tor identity mark: an "A" monogram whose apex is crowned by the gold
 * oracle orb, on the same gradient as the wordmark. Single source of truth for
 * the logo in the UI — public/favicon.svg is the raster twin, regenerated with
 * scripts/generate-icons.py.
 */
export function AiTorMark({ className = "h-6 w-6", tile = true, label = "Ai Tor" }: AiTorMarkProps) {
  const raw = useId();
  const uid = raw.replace(/[^a-zA-Z0-9]/g, "");

  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      role="img"
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <defs>
        <linearGradient id={`edge${uid}`} x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#A8E94A" />
          <stop offset="0.55" stopColor="#69AF00" />
          <stop offset="1" stopColor="#FFD700" />
        </linearGradient>
        <linearGradient id={`letter${uid}`} x1="18" y1="50" x2="46" y2="18" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5F9E00" />
          <stop offset="0.55" stopColor="#9BDD2B" />
          <stop offset="1" stopColor="#D8FF74" />
        </linearGradient>
        <radialGradient id={`orb${uid}`} cx="0.35" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#FFFBE0" />
          <stop offset="0.5" stopColor="#FFD700" />
          <stop offset="1" stopColor="#C79200" />
        </radialGradient>
      </defs>

      {tile && (
        <rect x="2" y="2" width="60" height="60" rx="16" fill="#0A0F14" stroke={`url(#edge${uid})`} strokeWidth="2.4" />
      )}
      <path
        d="M15.5 48.5 L32 19 L48.5 48.5"
        stroke={`url(#letter${uid})`}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M23.5 39.5 H40.5" stroke={`url(#letter${uid})`} strokeWidth="5" strokeLinecap="round" />
      <circle cx="32" cy="10" r="3.8" fill={`url(#orb${uid})`} />
    </svg>
  );
}
