import { fmtHour } from "./format";
import s from "./insights.module.css";

export type BarRow = { key: string; label: string; value: number; text: string };

/** Labelled horizontal bars. Every row prints its value, so nothing depends on colour or bar length alone. */
export function Bars({ rows, label }: { rows: BarRow[]; label: string }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <ul className={s.bars} aria-label={label}>
      {rows.map((r) => (
        <li key={r.key}>
          <span>{r.label}</span>
          <span className={s.barValue}>{r.text}</span>
          <span className={s.barTrack} aria-hidden>
            <span className={`${s.barFill} ${r.value < 0 ? s.barFillNeg : ""}`} style={{ width: `${(Math.abs(r.value) / max) * 100}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

const WEEK = [1, 2, 3, 4, 5, 6, 0];
const DAY_NAME = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Booked share of open hours by weekday and hour. The percent is printed in every cell; the tint only helps scanning. */
export function OccupancyHeatmap({ cells }: { cells: { weekday: number; hour: number; openHours: number; bookedHours: number }[] }) {
  const hours = [...new Set(cells.map((c) => c.hour))].sort((x, y) => x - y);
  const at = (weekday: number, hour: number) => cells.find((c) => c.weekday === weekday && c.hour === hour);
  return (
    <div style={{ overflowX: "auto" }} tabIndex={0} role="region" aria-label="Studio occupancy by weekday and hour">
      <table className={s.grid}>
        <caption>Share of open hours that were booked</caption>
        <thead>
          <tr>
            <th scope="col">
              <span className="sr-only">Hour</span>
            </th>
            {WEEK.map((d) => (
              <th key={d} scope="col">
                {DAY_NAME[d]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hours.map((h) => (
            <tr key={h}>
              <th scope="row">{fmtHour(h)}</th>
              {WEEK.map((d) => {
                const c = at(d, h);
                if (!c) return <td key={d} className={s.closed}>–</td>;
                const pct = Math.round((c.bookedHours / c.openHours) * 100);
                return (
                  <td
                    key={d}
                    style={{ background: `color-mix(in srgb, var(--brick) ${Math.round(pct * 0.5)}%, var(--a-hover))` }}
                    title={`${DAY_NAME[d]} ${fmtHour(h)}: ${c.bookedHours.toFixed(1)} of ${c.openHours.toFixed(1)} open hours booked`}
                  >
                    {pct}%
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
