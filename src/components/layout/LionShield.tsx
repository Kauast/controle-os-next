type Props = { className?: string; tone?: "silver" | "onyx" };

export function LionShield({ className, tone = "silver" }: Props) {
  const stroke = tone === "silver" ? "currentColor" : "var(--color-onyx)";
  return (
    <svg
      viewBox="0 0 64 72"
      className={className}
      fill="none"
      stroke={stroke}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* Shield */}
      <path d="M4 6 L32 2 L60 6 L60 36 C60 52 48 64 32 70 C16 64 4 52 4 36 Z" opacity="0.95" />
      <path d="M9 10 L32 7 L55 10 L55 35 C55 49 45 59 32 64 C19 59 9 49 9 35 Z" opacity="0.35" />
      {/* Mane rays */}
      <g opacity="0.9">
        <path d="M20 22 L14 16" />
        <path d="M24 19 L20 12" />
        <path d="M32 17 L32 10" />
        <path d="M40 19 L44 12" />
        <path d="M44 22 L50 16" />
        <path d="M18 30 L11 28" />
        <path d="M46 30 L53 28" />
        <path d="M20 38 L13 40" />
        <path d="M44 38 L51 40" />
      </g>
      {/* Lion face */}
      <circle cx="32" cy="32" r="10" />
      <circle cx="28" cy="31" r="1.2" fill="currentColor" />
      <circle cx="36" cy="31" r="1.2" fill="currentColor" />
      <path d="M30 36 Q32 38 34 36" />
      <path d="M32 34 L32 36" />
    </svg>
  );
}
