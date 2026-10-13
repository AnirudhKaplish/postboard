// Dependency-free SVG line chart for two series (posts, comments) over time.
const W = 720;
const H = 240;
const PAD = { top: 16, right: 16, bottom: 28, left: 32 };

export default function ActivityChart({ data }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.posts, d.comments]));
  const niceMax = max <= 4 ? max : Math.ceil(max / 2) * 2;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i) => PAD.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v) => PAD.top + innerH - (v / niceMax) * innerH;
  const line = (key) => data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(' ');
  const ticks = Array.from(new Set([0, Math.round(niceMax / 2), niceMax]));
  const labelEvery = Math.ceil(data.length / 6);
  const fmt = (day) => new Date(day + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Posts and comments per day over the last 30 days">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="chart-grid" />
            <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" className="chart-label">{t}</text>
          </g>
        ))}
        {data.map((d, i) =>
          i % labelEvery === 0 ? (
            <text key={d.day} x={x(i)} y={H - 8} textAnchor="middle" className="chart-label">{fmt(d.day)}</text>
          ) : null
        )}
        <path d={line('comments')} className="chart-line series-b" />
        <path d={line('posts')} className="chart-line series-a" />
        {data.map((d, i) => (
          <g key={d.day}>
            <circle cx={x(i)} cy={y(d.posts)} r="3" className="series-a-dot" />
            <circle cx={x(i)} cy={y(d.comments)} r="3" className="series-b-dot" />
            <rect x={x(i) - innerW / data.length / 2} y={PAD.top} width={innerW / data.length} height={innerH} fill="transparent">
              <title>{`${fmt(d.day)}: ${d.posts} post${d.posts === 1 ? '' : 's'}, ${d.comments} comment${d.comments === 1 ? '' : 's'}`}</title>
            </rect>
          </g>
        ))}
      </svg>
      <figcaption className="legend">
        <span><i className="swatch series-a-bg" /> Posts</span>
        <span><i className="swatch series-b-bg" /> Comments</span>
      </figcaption>
    </figure>
  );
}
