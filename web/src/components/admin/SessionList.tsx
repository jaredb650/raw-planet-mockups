import Link from "next/link";
import { fmtTimeRange } from "@/lib/time";
import type { SessionRow } from "@/lib/admin/dashboard";
import { Icon } from "./Icon";
import { BookingStatusPill, ExpName, Pill } from "./Pill";
import { SOURCE_LABEL, plural, telHref } from "./format";
import { QuickStatus } from "./QuickStatus";
import s from "./today.module.css";
import a from "./admin.module.css";
import type { BookingSource, BookingStatus } from "@/lib/db/schema";

/** Run-sheet rows for a day's sessions: time, what, who, how to reach them, what to do. */
export function SessionList({ sessions, now }: { sessions: SessionRow[]; now: Date }) {
  return (
    <ul className={s.sessions}>
      {sessions.map((b) => {
        const ended = new Date(b.endAt) <= now;
        const live = !ended && new Date(b.startAt) <= now;
        const realEmail = !b.contactEmail.endsWith("@rawplanet.invalid");
        return (
          <li key={b.id} className={`${s.session} ${live ? s.live : ""}`}>
            <div className={s.time}>
              <span className={s.timeMain}>{fmtTimeRange(b.startAt, b.endAt)}</span>
              {live && <span className={s.nowTag}>On now</span>}
            </div>
            <div className={s.body}>
              <div className={s.what}>
                <ExpName theme={b.theme} name={b.experienceName} />
                <span className={a.muted}> · {plural(b.guests, "guest")}</span>
                {b.source !== "direct" && <span className={a.muted}> · {SOURCE_LABEL[b.source as BookingSource] ?? b.source}</span>}
              </div>
              <Link href={`/admin/bookings/${b.id}`} className={s.guest}>
                {b.contactName}
              </Link>
              <div className={s.tags}>
                {b.status !== "confirmed" && <BookingStatusPill status={b.status as BookingStatus} />}
                {b.occasion && <Pill tone="accent">{b.occasion}</Pill>}
                {b.isGift && <Pill tone="info">Gift{b.giftRecipientName ? ` for ${b.giftRecipientName}` : ""}</Pill>}
              </div>
              {b.customerNotes && <p className={s.note}>“{b.customerNotes}”</p>}
              {b.internalNotes && <p className={s.note}>Note: {b.internalNotes}</p>}
              <div className={s.quick}>
                {b.contactPhone && (
                  <>
                    <a className={`${a.btn} ${a.btnSm}`} href={`tel:${telHref(b.contactPhone)}`}>
                      <Icon name="phone" size={15} /> Call
                    </a>
                    <a className={`${a.btn} ${a.btnSm}`} href={`sms:${telHref(b.contactPhone)}`}>
                      <Icon name="sms" size={15} /> Text
                    </a>
                  </>
                )}
                {realEmail && (
                  <a className={`${a.btn} ${a.btnSm}`} href={`mailto:${b.contactEmail}?subject=${encodeURIComponent(`Your Raw Planet session (${b.code})`)}`}>
                    <Icon name="mail" size={15} /> Email
                  </a>
                )}
                {!b.contactPhone && <span className={`${a.small} ${a.muted}`}>No phone on file</span>}
                {ended && b.status === "confirmed" && <QuickStatus id={b.id} />}
                <Link className={`${a.btn} ${a.btnSm} ${a.btnGhost}`} href={`/admin/bookings/${b.id}`}>
                  Open <Icon name="right" size={14} />
                </Link>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
