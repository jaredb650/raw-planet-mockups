import { notFound } from "next/navigation";
import { asc, eq, isNull, or } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { addons, experiences } from "@/lib/db/schema";
import { formatMoney } from "@/lib/money";
import { PageHeader, Panel, Empty } from "@/components/admin/PageHeader";
import { ActionForm, ConfirmSubmit, InlineMessage, SubmitButton } from "@/components/admin/ActionForm";
import { Pill } from "@/components/admin/Pill";
import { Icon } from "@/components/admin/Icon";
import { deleteAddonAction, saveAddonAction, updateExperienceAction } from "../actions";
import a from "@/components/admin/admin.module.css";
import e from "@/components/admin/exp.module.css";

export const metadata = { title: "Edit experience" };

const DAYS: [number, string][] = [
  [1, "Mon"],
  [2, "Tue"],
  [3, "Wed"],
  [4, "Thu"],
  [5, "Fri"],
  [6, "Sat"],
  [0, "Sun"],
];
const dollars = (c: number) => (c / 100).toFixed(c % 100 ? 2 : 0);

export default async function EditExperiencePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const db = await getDb();
  const [x] = await db.select().from(experiences).where(eq(experiences.id, id)).limit(1);
  if (!x) notFound();
  const extras = await db
    .select()
    .from(addons)
    .where(or(eq(addons.experienceId, x.id), isNull(addons.experienceId)))
    .orderBy(asc(addons.sortOrder), asc(addons.name));
  const durRows = [...x.durationOptions, { minutes: "", priceCents: null, label: "" }, { minutes: "", priceCents: null, label: "" }];
  const placeholderAddress = !x.address || /exact address|confirmed with/i.test(x.address);

  return (
    <div className={`${a.page} ${a.pageNarrow}`}>
      <PageHeader
        back={{ href: "/admin/experiences", label: "Experiences" }}
        title={x.shortName}
        sub={
          <>
            {x.active ? <Pill tone="success">Live</Pill> : <Pill tone="neutral">Hidden</Pill>}{" "}
            <a className={a.ext} href={`/experiences/${x.slug}`} target="_blank" rel="noreferrer">
              /experiences/{x.slug}
            </a>
          </>
        }
      />
      {sp.created === "1" && (
        <p className={`${a.notice} ${a.noticeOk}`} style={{ marginBottom: 16 }}>
          Created. Fill in the details, then tick “Live on website” and save.
        </p>
      )}

      <ActionForm action={updateExperienceAction} className={a.stack} hideMessage>
        <input type="hidden" name="id" value={x.id} />

        <Panel title="Basics">
          <div className={`${a.panelBody} ${a.form}`}>
            <label className={a.check}>
              <input type="checkbox" name="active" defaultChecked={x.active} />
              <span>
                <strong>Live on website</strong>
                <span className={a.cellSub}>Untick to hide it from the site and stop new bookings. Existing bookings stay.</span>
              </span>
            </label>
            <div className={a.formRow}>
              <div className={a.field}>
                <label htmlFor="x-name">Name</label>
                <input id="x-name" name="name" className={a.input} defaultValue={x.name} required />
              </div>
              <div className={a.field}>
                <label htmlFor="x-short">Short name</label>
                <input id="x-short" name="shortName" className={a.input} defaultValue={x.shortName} />
                <span className={a.hint}>Used in lists, emails and the calendar.</span>
              </div>
            </div>
            <div className={a.field}>
              <label htmlFor="x-tag">Tagline</label>
              <input id="x-tag" name="tagline" className={a.input} defaultValue={x.tagline} maxLength={200} />
            </div>
            <div className={a.field}>
              <label htmlFor="x-sum">Summary</label>
              <textarea id="x-sum" name="summary" className={a.textarea} defaultValue={x.summary} rows={3} maxLength={600} />
            </div>
            <div className={a.field}>
              <label htmlFor="x-desc">Full description</label>
              <textarea id="x-desc" name="description" className={a.textarea} defaultValue={x.description} rows={7} />
              <span className={a.hint}>Blank line = new paragraph.</span>
            </div>
            <div className={a.formRow}>
              <div className={a.field}>
                <label htmlFor="x-theme">Colour</label>
                <select id="x-theme" name="theme" className={a.select} defaultValue={x.theme}>
                  <option value="production">Ochre (production)</option>
                  <option value="dj">Orange (DJ)</option>
                  <option value="wellness">Green (wellness)</option>
                </select>
              </div>
              <div className={a.field}>
                <label htmlFor="x-sort">Order on the site</label>
                <input id="x-sort" name="sortOrder" type="number" className={a.input} defaultValue={x.sortOrder} />
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Price and session lengths">
          <div className={`${a.panelBody} ${a.form}`}>
            <fieldset className={a.fieldset}>
              <legend className="sr-only">Pricing</legend>
              <label className={a.check}>
                <input type="radio" name="pricingMode" value="per_person" defaultChecked={x.pricingMode === "per_person"} />
                <span>Price per person</span>
              </label>
              <label className={a.check}>
                <input type="radio" name="pricingMode" value="per_session" defaultChecked={x.pricingMode === "per_session"} />
                <span>Price per session (covers a set number of guests)</span>
              </label>
            </fieldset>
            <div className={a.field}>
              <span className={a.label}>Lengths guests can choose</span>
              <div className={e.durRow}>
                <span className={e.durHead}>Minutes</span>
                <span className={e.durHead}>Price ($)</span>
                <span className={e.durHead}>Label (optional)</span>
              </div>
              {durRows.map((o, i) => (
                <div className={e.durRow} key={i}>
                  <input name="durMinutes" className={a.input} inputMode="numeric" defaultValue={o.minutes} aria-label={`Length ${i + 1} minutes`} placeholder={i >= x.durationOptions.length ? "e.g. 180" : undefined} />
                  <input name="durPrice" className={a.input} inputMode="decimal" defaultValue={o.priceCents == null ? "" : dollars(o.priceCents)} aria-label={`Length ${i + 1} price`} />
                  <input name="durLabel" className={a.input} defaultValue={o.label ?? ""} aria-label={`Length ${i + 1} label`} placeholder={i === 0 ? "Most popular" : undefined} />
                </div>
              ))}
              <span className={a.hint}>Clear a row to remove that length. Existing bookings keep the price they paid.</span>
            </div>
            <div className={a.formRow} style={{ ["--cols" as string]: 3 }}>
              <div className={a.field}>
                <label htmlFor="x-min">Min guests</label>
                <input id="x-min" name="minGuests" type="number" min={1} className={a.input} defaultValue={x.minGuests} required />
              </div>
              <div className={a.field}>
                <label htmlFor="x-max">Max guests</label>
                <input id="x-max" name="maxGuests" type="number" min={1} className={a.input} defaultValue={x.maxGuests} required />
              </div>
              <div className={a.field}>
                <label htmlFor="x-age">Minimum age</label>
                <input id="x-age" name="minAge" type="number" min={0} className={a.input} defaultValue={x.minAge ?? ""} placeholder="Any" />
              </div>
            </div>
            <div className={a.formRow}>
              <div className={a.field}>
                <label htmlFor="x-inc">Guests included (per-session pricing)</label>
                <input id="x-inc" name="includedGuests" type="number" min={1} className={a.input} defaultValue={x.includedGuests} />
              </div>
              <div className={a.field}>
                <label htmlFor="x-extra">Each extra guest ($)</label>
                <input id="x-extra" name="extraGuest" inputMode="decimal" className={a.input} defaultValue={dollars(x.extraGuestCents)} />
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Opening hours (New York time)">
          <div className={`${a.panelBody} ${a.form}`}>
            <p className={a.hint}>Guests can start a session any time inside these hours, as long as it ends before closing. Leave a day blank to close it. Add a second window for split days.</p>
            <div className={e.hours}>
              {DAYS.map(([d, label]) => {
                const w = x.schedule[String(d)] ?? [];
                return (
                  <div key={d} className={e.hourRow} role="group" aria-label={label}>
                    <span className={e.dayName}>{label}</span>
                    {[0, 1].map((k) => (
                      <div className={e.win} key={k}>
                        <input name={`h_${d}_${k}_start`} type="time" step={900} className={`${a.input} ${a.inputSm}`} defaultValue={w[k]?.start ?? ""} aria-label={`${label} window ${k + 1} opens`} />
                        <span aria-hidden>–</span>
                        <input
                          name={`h_${d}_${k}_end`}
                          type="time"
                          step={900}
                          className={`${a.input} ${a.inputSm}`}
                          defaultValue={w[k]?.end === "24:00" ? "00:00" : (w[k]?.end ?? "")}
                          aria-label={`${label} window ${k + 1} closes`}
                        />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
            <div className={a.formRow} style={{ ["--cols" as string]: 3 }}>
              <div className={a.field}>
                <label htmlFor="x-step">Start times every (min)</label>
                <input id="x-step" name="slotStepMinutes" type="number" min={15} step={15} className={a.input} defaultValue={x.slotStepMinutes} required />
              </div>
              <div className={a.field}>
                <label htmlFor="x-buf">Gap between sessions (min)</label>
                <input id="x-buf" name="bufferMinutes" type="number" min={0} step={5} className={a.input} defaultValue={x.bufferMinutes} />
              </div>
              <div className={a.field}>
                <label htmlFor="x-lead">Minimum notice (hours)</label>
                <input id="x-lead" name="leadTimeHours" type="number" min={0} className={a.input} defaultValue={x.leadTimeHours} />
              </div>
            </div>
            <div className={a.formRow}>
              <div className={a.field}>
                <label htmlFor="x-adv">Bookable up to (days ahead)</label>
                <input id="x-adv" name="maxAdvanceDays" type="number" min={1} className={a.input} defaultValue={x.maxAdvanceDays} required />
              </div>
              <div className={a.field}>
                <label htmlFor="x-cx">Free cancellation until (hours before)</label>
                <input id="x-cx" name="cancellationHours" type="number" min={0} className={a.input} defaultValue={x.cancellationHours} />
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Where">
          <div className={`${a.panelBody} ${a.form}`}>
            {placeholderAddress && <p className={`${a.notice} ${a.noticeWarn}`}>The exact address isn’t set yet. Confirmation emails will say it’s on its way until you add it.</p>}
            <div className={a.formRow}>
              <div className={a.field}>
                <label htmlFor="x-area">Neighbourhood (public)</label>
                <input id="x-area" name="locationArea" className={a.input} defaultValue={x.locationArea} />
              </div>
              <div className={a.field}>
                <label htmlFor="x-addr">Exact address (sent after booking)</label>
                <input id="x-addr" name="address" className={a.input} defaultValue={x.address} />
              </div>
            </div>
            <div className={a.field}>
              <label htmlFor="x-arr">Arrival instructions</label>
              <textarea id="x-arr" name="arrivalInstructions" className={a.textarea} defaultValue={x.arrivalInstructions} rows={3} placeholder="Buzz 4B, take the elevator…" />
            </div>
          </div>
        </Panel>

        <Panel title="Page details">
          <div className={`${a.panelBody} ${a.form}`}>
            <p className={a.hint}>One per line.</p>
            <div className={a.field}>
              <label htmlFor="x-hl">Highlights</label>
              <textarea id="x-hl" name="highlights" className={a.textarea} defaultValue={x.highlights.join("\n")} rows={4} />
            </div>
            <div className={a.formRow}>
              <div className={a.field}>
                <label htmlFor="x-incl">What’s included</label>
                <textarea id="x-incl" name="includes" className={a.textarea} defaultValue={x.includes.join("\n")} rows={4} />
              </div>
              <div className={a.field}>
                <label htmlFor="x-gtk">Good to know</label>
                <textarea id="x-gtk" name="goodToKnow" className={a.textarea} defaultValue={x.goodToKnow.join("\n")} rows={4} />
              </div>
            </div>
            {x.media.length > 0 && (
              <div className={a.field}>
                <span className={a.label}>Photos</span>
                <div className={e.media}>
                  {x.media.slice(0, 8).map((m) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={m.src} src={m.src} alt={m.alt} loading="lazy" />
                  ))}
                </div>
                <span className={a.hint}>Photos are managed in the site’s media library.</span>
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Connections">
          <div className={`${a.panelBody} ${a.form}`}>
            <div className={a.formRow}>
              <div className={a.field}>
                <label htmlFor="x-cal">Cal.com event type ID</label>
                <input id="x-cal" name="calEventTypeId" inputMode="numeric" className={a.input} defaultValue={x.calEventTypeId ?? ""} placeholder="Not connected" />
                <span className={a.hint}>Links this experience to your shared Google Calendar through Cal.com.</span>
              </div>
              <div className={a.field}>
                <label htmlFor="x-air">Airbnb listing link</label>
                <input id="x-air" name="airbnbUrl" type="url" className={a.input} defaultValue={x.airbnbUrl ?? ""} placeholder="https://www.airbnb.com/experiences/…" />
              </div>
            </div>
          </div>
        </Panel>

        <div className={e.save}>
          <InlineMessage />
          <SubmitButton pendingText="Saving…">Save changes</SubmitButton>
        </div>
      </ActionForm>

      <Panel title="Add-ons" count={extras.length || undefined} className={a.section}>
        <p className={`${a.hint} ${a.panelBody}`} style={{ paddingBottom: 0 }}>
          Extras guests can add at checkout. Add-ons marked “all experiences” show on every booking.
        </p>
        {extras.length === 0 ? (
          <Empty>No add-ons yet.</Empty>
        ) : (
          <ul className={a.list}>
            {extras.map((ad) => (
              <li key={ad.id}>
                <details>
                  <summary className={a.listRow} style={{ cursor: "pointer", listStyle: "none" }}>
                    <span className={a.listMain}>
                      <span className={a.listTitle}>{ad.name}</span>{" "}
                      {!ad.active && <Pill tone="neutral">Off</Pill>} {ad.experienceId === null && <Pill tone="info">All experiences</Pill>}
                      <span className={a.listMeta} style={{ display: "block" }}>
                        {formatMoney(ad.priceCents)} {ad.pricing === "per_guest" ? "per guest" : "per booking"}
                        {ad.description ? ` · ${ad.description}` : ""}
                      </span>
                    </span>
                    <span className={`${a.small} ${a.muted}`}>
                      Edit <Icon name="right" size={12} />
                    </span>
                  </summary>
                  <div style={{ paddingTop: 12 }}>
                    <AddonForm addon={ad} experienceId={x.id} />
                    <ActionForm action={deleteAddonAction} className={a.row}>
                      <input type="hidden" name="id" value={ad.id} />
                      <ConfirmSubmit className={`${a.btn} ${a.btnSm} ${a.btnGhost}`} confirmLabel="Delete add-on">
                        Delete
                      </ConfirmSubmit>
                    </ActionForm>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
        <details className={a.disclosure}>
          <summary>New add-on</summary>
          <div className={a.disclosureBody}>
            <AddonForm experienceId={x.id} />
          </div>
        </details>
      </Panel>
    </div>
  );
}

function AddonForm({
  addon,
  experienceId,
}: {
  addon?: { id: string; name: string; description: string; priceCents: number; pricing: string; active: boolean; experienceId: string | null };
  experienceId: string;
}) {
  const p = addon?.id ?? "new";
  return (
    <ActionForm action={saveAddonAction} resetOnSuccess={!addon}>
      {addon && <input type="hidden" name="id" value={addon.id} />}
      <div className={a.formRow}>
        <div className={a.field}>
          <label htmlFor={`ad-n-${p}`}>Name</label>
          <input id={`ad-n-${p}`} name="name" className={a.input} defaultValue={addon?.name} required placeholder="Extra hour of mixing" />
        </div>
        <div className={a.formRow} style={{ gap: 8 }}>
          <div className={a.field}>
            <label htmlFor={`ad-p-${p}`}>Price ($)</label>
            <input id={`ad-p-${p}`} name="price" inputMode="decimal" className={a.input} defaultValue={addon ? dollars(addon.priceCents) : ""} required />
          </div>
          <div className={a.field}>
            <label htmlFor={`ad-pr-${p}`}>Charged</label>
            <select id={`ad-pr-${p}`} name="pricing" className={a.select} defaultValue={addon?.pricing ?? "per_booking"}>
              <option value="per_booking">Per booking</option>
              <option value="per_guest">Per guest</option>
            </select>
          </div>
        </div>
      </div>
      <div className={a.field}>
        <label htmlFor={`ad-d-${p}`}>Description</label>
        <input id={`ad-d-${p}`} name="description" className={a.input} defaultValue={addon?.description} maxLength={300} />
      </div>
      <div className={a.row}>
        <label className={a.check}>
          <input type="checkbox" name="experienceId" value={experienceId} defaultChecked={addon ? addon.experienceId !== null : true} />
          <span>Only for this experience</span>
        </label>
        <label className={a.check}>
          <input type="checkbox" name="active" defaultChecked={addon?.active ?? true} />
          <span>Offered</span>
        </label>
      </div>
      <div className={a.formFoot}>
        <SubmitButton className={`${a.btn} ${addon ? "" : a.btnPrimary}`} pendingText="Saving…">
          {addon ? "Save add-on" : "Add"}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
