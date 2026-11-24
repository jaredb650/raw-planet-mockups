import Link from "next/link";
import a from "./admin.module.css";

export function GiftTabs({ current }: { current: "cards" | "promos" }) {
  return (
    <nav className={a.tabs} aria-label="Gift cards and promo codes">
      <Link href="/admin/gift-cards" className={`${a.tab} ${current === "cards" ? a.tabActive : ""}`} aria-current={current === "cards" ? "page" : undefined}>
        Gift cards
      </Link>
      <Link href="/admin/promos" className={`${a.tab} ${current === "promos" ? a.tabActive : ""}`} aria-current={current === "promos" ? "page" : undefined}>
        Promo codes
      </Link>
    </nav>
  );
}
