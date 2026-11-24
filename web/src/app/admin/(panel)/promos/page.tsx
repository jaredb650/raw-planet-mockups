import { asc, desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { experiences, promoCodes, type PromoCode } from "@/lib/db/schema";
import { addDaysKey, fmt, localDateKey } from "@/lib/time";
import { formatMoney } from "@/lib/money";
import { PageHeader, Panel, Empty } from "@/components/admin/PageHeader";
import { ActionForm, ConfirmSubmit, SubmitButton } from "@/components/admin/ActionForm";
import { CopyButton } from "@/components/admin/CopyButton";
import { GiftTabs } from "@/components/admin/GiftTabs";
import { Pill } from "@/components/admin/Pill";
import { deletePromoAction, savePromoAction, togglePromoAction } from "./actions";
import a from "@/components/admin/admin.module.css";

export const metadata = { title: "Promo codes" };

function state(p: PromoCode, now: Date): { label: string; tone: "success" | "neutral" | "warning" | "danger" } {
  if (!p.active) return { label: "Off", tone: "neutral" };
  if (p.validUntil && now > p.validUntil) return { label: "Expired", tone: "neutral" };
  if (p.validFrom && now < p.validFrom) return { label: "Scheduled", tone: "warning" };
  if (p.maxRedemptions != null && p.redemptions >= p.maxRedemptions) return { label: "Used up", tone: "neutral" };
  return { label: "Live", tone: "success" };
}

export default async function PromosPage() {
  await requireAdmin();
  const db = await getDb();
  const now = new Date();
  const [rows, exps] = await Promise.all([
    db.select().from(promoCodes).orderBy(desc(promoCodes.active), desc(promoCodes.createdAt)),
    db.select({ id: experiences.id, name: experiences.shortName }).from(experiences).orderBy(asc(experiences.sortOrder)),
  ]);
  const expName = (id: string) => exps.find((e) => e.id === id)?.name ?? "removed";

  return (
    <div className={a.page}>
      <PageHeader title="Gift cards & promos" sub="Gift cards guests bought, cards you gave away, and discount codes." />
      <GiftTabs current="promos" />

      <div className={a.split}>
        <Panel title="Codes" count={rows.length || undefined}>
          {rows.length === 0 ? (
            <Empty>No promo codes yet.</Empty>
          ) : (
            <ul className={a.list}>
              {rows.map((p) => {
                const s = state(p, now);
                return (
                  <li key={p.id}>
                    <div className={a.listRow}>
                      <div className={a.listMain}>
                        <div className={a.row} style={{ gap: 8 }}>
                          <span className={a.code} style={{ fontSize: 15 }}>
                            {p.code}
                          </span>
                          <Pill tone={s.tone}>{s.label}</Pill>
                        </div>
                        <div className={a.listMeta}>
                          <strong style={{ color: "var(--ink)" }}>{p.kind === "percent" ? `${p.value}% off` : `${formatMoney(p.value)} off`}</strong>
                          {p.minSubtotalCents ? ` · over ${formatMoney(p.minSubtotalCents)}` : ""}
                          {p.experienceIds?.length ? ` · ${p.experienceIds.map(expName).join(", ")} only` : ""}
                          {p.validUntil ? ` · until ${fmt(new Date(p.validUntil.getTime() - 1), "MMM d, yyyy")}` : ""}
                        </div>
                        <div className={a.listMeta}>
                          Used {p.redemptions}
                          {p.maxRedemptions != null ? ` of ${p.maxRedemptions}` : ""} time{p.redemptions === 1 ? "" : "s"}
                          {p.description ? ` · ${p.description}` : ""}
                        </div>
                      </div>
                      <CopyButton text={p.code} label="Copy" className={`${a.btn} ${a.btnSm} ${a.btnGhost}`} />
                    </div>
                    <details style={{ marginTop: 6 }}>
                      <summary className={`${a.small} ${a.muted}`} style={{ cursor: "pointer" }}>
                        Edit
                      </summary>
                      <div style={{ paddingTop: 12, display: "grid", gap: 12 }}>
                        <PromoForm promo={p} exps={exps} />
                        <div className={a.row}>
                          <ActionForm action={togglePromoAction} className={a.row} hideMessage>
                            <input type="hidden" name="id" value={p.id} />
                            <input type="hidden" name="active" value={p.active ? "false" : "true"} />
                            <SubmitButton className={`${a.btn} ${a.btnSm}`}>{p.active ? "Turn off" : "Turn on"}</SubmitButton>
                          </ActionForm>
                          {p.redemptions === 0 && (
                            <ActionForm action={deletePromoAction} className={a.row}>
                              <input type="hidden" name="id" value={p.id} />
                              <ConfirmSubmit className={`${a.btn} ${a.btnSm} ${a.btnGhost}`} confirmLabel="Delete code">
                                Delete
                              </ConfirmSubmit>
                            </ActionForm>
                          )}
                        </div>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="New code">
          <div className={a.panelBody}>
            <PromoForm exps={exps} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function PromoForm({ promo, exps }: { promo?: PromoCode; exps: { id: string; name: string }[] }) {
  const k = promo?.id ?? "new";
  const until = promo?.validUntil ? addDaysKey(localDateKey(promo.validUntil), -1) : "";
  return (
    <ActionForm action={savePromoAction} resetOnSuccess={!promo}>
      {promo && <input type="hidden" name="id" value={promo.id} />}
      <div className={a.field}>
        <label htmlFor={`pc-code-${k}`}>Code</label>
        <input id={`pc-code-${k}`} name="code" className={`${a.input} ${a.code}`} defaultValue={promo?.code} placeholder="SPRING20" required autoCapitalize="characters" autoComplete="off" style={{ textTransform: "uppercase" }} />
      </div>
      <div className={a.formRow}>
        <div className={a.field}>
          <label htmlFor={`pc-pct-${k}`}>Percent off</label>
          <input id={`pc-pct-${k}`} name="percent" inputMode="numeric" className={a.input} defaultValue={promo?.kind === "percent" ? promo.value : ""} placeholder="e.g. 10" />
        </div>
        <div className={a.field}>
          <label htmlFor={`pc-amt-${k}`}>or amount off ($)</label>
          <input id={`pc-amt-${k}`} name="amount" inputMode="decimal" className={a.input} defaultValue={promo?.kind === "fixed" ? (promo.value / 100).toFixed(0) : ""} placeholder="e.g. 25" />
        </div>
      </div>
      <div className={a.formRow}>
        <div className={a.field}>
          <label htmlFor={`pc-from-${k}`}>Starts</label>
          <input id={`pc-from-${k}`} name="validFrom" type="date" className={a.input} defaultValue={promo?.validFrom ? localDateKey(promo.validFrom) : ""} />
        </div>
        <div className={a.field}>
          <label htmlFor={`pc-until-${k}`}>Ends (last day)</label>
          <input id={`pc-until-${k}`} name="validUntil" type="date" className={a.input} defaultValue={until} />
        </div>
      </div>
      <div className={a.formRow}>
        <div className={a.field}>
          <label htmlFor={`pc-max-${k}`}>Max uses</label>
          <input id={`pc-max-${k}`} name="maxRedemptions" inputMode="numeric" className={a.input} defaultValue={promo?.maxRedemptions ?? ""} placeholder="Unlimited" />
        </div>
        <div className={a.field}>
          <label htmlFor={`pc-min-${k}`}>Minimum spend ($)</label>
          <input id={`pc-min-${k}`} name="minSubtotal" inputMode="decimal" className={a.input} defaultValue={promo?.minSubtotalCents ? (promo.minSubtotalCents / 100).toFixed(0) : ""} placeholder="None" />
        </div>
      </div>
      <fieldset className={a.fieldset}>
        <legend className={a.label} style={{ fontSize: 13.5 }}>
          Works on <span className={a.muted} style={{ fontWeight: 400 }}>(none ticked = everything)</span>
        </legend>
        {exps.map((e) => (
          <label key={e.id} className={a.check}>
            <input type="checkbox" name="experienceIds" value={e.id} defaultChecked={promo?.experienceIds?.includes(e.id)} />
            <span>{e.name}</span>
          </label>
        ))}
      </fieldset>
      <div className={a.field}>
        <label htmlFor={`pc-desc-${k}`}>Note (only you see it)</label>
        <input id={`pc-desc-${k}`} name="description" className={a.input} defaultValue={promo?.description} placeholder="Instagram giveaway" />
      </div>
      <label className={a.check}>
        <input type="checkbox" name="active" defaultChecked={promo?.active ?? true} />
        <span>Active</span>
      </label>
      <div className={a.formFoot}>
        <SubmitButton className={`${a.btn} ${promo ? "" : a.btnPrimary}`} pendingText="Saving…">
          {promo ? "Save" : "Create code"}
        </SubmitButton>
      </div>
    </ActionForm>
  );
}
