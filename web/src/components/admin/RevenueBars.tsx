import { formatMoney } from "@/lib/money";
import { fmt } from "@/lib/time";

/** 30-day net cash bars (inline SVG). Refund days dip below the baseline. */
export function RevenueBars({ data, height = 120 }: { data: { date: string; cents: number }[]; height?: number }) {
  const W = 600;
  const H = height;
  const pad = { t: 16, b: 20 };
  const max = Math.max(1, ...data.map((d) => d.cents));
  const min = Math.min(0, ...data.map((d) => d.cents));
  const span = max - min || 1;
  const plotH = H - pad.t - pad.b;
  const y0 = pad.t + (max / span) * plotH;
  const bw = W / data.length;
  const peak = data.reduce((p, d) => (d.cents > p.cents ? d : p), data[0] ?? { date: "", cents: 0 });
  const total = data.reduce((n, d) => n + d.cents, 0);
  const label = (k: string) => fmt(`${k}T12:00:00Z`, "MMM d");
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img" aria-label={`Net revenue, last 30 days: ${formatMoney(total)} in total, best day ${peak ? formatMoney(peak.cents) : "$0"}.`}>
        <line x1="0" x2={W} y1={y0} y2={y0} stroke="var(--a-line-strong)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {data.map((d, i) => {
          if (d.cents === 0) return null;
          const h = (Math.abs(d.cents) / span) * plotH;
          const y = d.cents > 0 ? y0 - h : y0;
          return (
            <rect key={d.date} x={i * bw + bw * 0.18} y={y} width={bw * 0.64} height={Math.max(1.5, h)} rx="1.5" fill={d.cents > 0 ? "var(--brick)" : "var(--ink-faint)"}>
              <title>{`${label(d.date)}: ${formatMoney(d.cents)}`}</title>
            </rect>
          );
        })}
      </svg>
      <figcaption style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--ink-soft)", marginTop: 4 }}>
        <span>{data[0] ? label(data[0].date) : ""}</span>
        {peak && peak.cents > 0 && <span>Best day {label(peak.date)} · {formatMoney(peak.cents)}</span>}
        <span>Today</span>
      </figcaption>
    </figure>
  );
}
