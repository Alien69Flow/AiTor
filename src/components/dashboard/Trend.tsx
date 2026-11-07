/** Tiny inline trend line shared by the market panels. */
export function Trend({
  points,
  className,
  up = true,
  height = 30,
}: {
  points: number[];
  className?: string;
  up?: boolean;
  height?: number;
}) {
  if (points.length < 2) return <div className={className} />;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const rising = points[points.length - 1] >= points[0];
  const path = points
    .map((p, i) => `${(i / (points.length - 1)) * 100},${height - 2 - ((p - min) / span) * (height - 4)}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className={className} aria-hidden="true">
      <polyline
        points={path}
        fill="none"
        stroke={up && rising ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
        strokeWidth="1.6"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
