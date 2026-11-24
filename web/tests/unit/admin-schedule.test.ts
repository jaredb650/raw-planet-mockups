import { describe, expect, it } from "vitest";
import { blockSpans, seriesDates } from "@/lib/admin/schedule";
import { fmt } from "@/lib/time";

const local = (d: Date) => fmt(d, "yyyy-MM-dd HH:mm");

describe("blockSpans", () => {
  it("keeps the wall-clock time when weekly repeats cross DST (Nov 1 2026)", () => {
    const s = blockSpans({ startDate: "2026-10-26", endDate: "2026-10-26", startTime: "10:00", endTime: "12:00", allDay: false, repeatWeeks: 1 });
    expect(s.map((x) => `${local(x.s)}→${local(x.e)}`)).toEqual(["2026-10-26 10:00→2026-10-26 12:00", "2026-11-02 10:00→2026-11-02 12:00"]);
  });
  it("runs all-day, multi-day blocks to midnight after the last day", () => {
    const [x] = blockSpans({ startDate: "2026-12-24", endDate: "2026-12-26", startTime: "", endTime: "", allDay: true, repeatWeeks: 0 });
    expect([local(x.s), local(x.e)]).toEqual(["2026-12-24 00:00", "2026-12-27 00:00"]);
  });
});

describe("seriesDates", () => {
  it("weekly and biweekly", () => {
    expect(seriesDates("2026-11-10", "biweekly", 3)).toEqual(["2026-11-10", "2026-11-24", "2026-12-08"]);
    expect(seriesDates("2026-11-10", "weekly", 2)).toEqual(["2026-11-10", "2026-11-17"]);
    expect(seriesDates("2026-11-10", "none", 5)).toEqual(["2026-11-10"]);
  });
  it("monthly keeps the nth weekday and skips months without it", () => {
    // 2026-11-12 is the 2nd Thursday
    expect(seriesDates("2026-11-12", "monthly", 3)).toEqual(["2026-11-12", "2026-12-10", "2027-01-14"]);
    // 2026-10-29 is the 5th Thursday; Nov 2026 has only 4, Dec has 5 (Dec 31)
    expect(seriesDates("2026-10-29", "monthly", 3)).toEqual(["2026-10-29", "2026-12-31"]);
  });
});
