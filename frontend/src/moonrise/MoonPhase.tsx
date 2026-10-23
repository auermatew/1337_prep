// Elapsed time as a moon phase: new moon at 0, full moon at 1.
export function MoonPhase({
  progress,
  size = 28,
}: {
  progress: number;
  size?: number;
}) {
  const p = Math.max(0, Math.min(1, progress || 0));
  const r = 12;
  const c = 14;
  const rx = Math.abs(1 - 2 * p) * r;
  const d =
    `M${c} ${c - r} A${r} ${r} 0 0 1 ${c} ${c + r} ` +
    `A${rx.toFixed(2)} ${r} 0 0 ${p < 0.5 ? 0 : 1} ${c} ${c - r} Z`;
  return (
    <svg
      className="ms-phase"
      width={size}
      height={size}
      viewBox="0 0 28 28"
      role="img"
      aria-label={`${Math.round(p * 100)}% elapsed`}
    >
      <circle className="ms-phase-dark" cx={c} cy={c} r={r} />
      {p > 0 && <path className="ms-phase-lit" d={d} />}
      <circle className="ms-phase-ring" cx={c} cy={c} r={r + 1.5} />
    </svg>
  );
}
